// Month-end spend forecast. Plain code, no LLM.
// Same method as Jo Ee's Python version (tokenguard-project/tokenguard/forecast.py):
//   features of day t -> predict t+1: cost_lag_1, cost_lag_7 (day t-6), cost_roll_7, target weekday;
//   chronological 80/20 split; 7-day-mean baseline vs Ridge on the same holdout; lower MAE wins.
// Two deliberate differences:
//   1. weekday is one-hot (7 columns) instead of a 0-6 number, so a linear model can learn weekends.
//   2. remaining days are predicted recursively (each prediction feeds the next day's lags)
//      instead of repeating tomorrow's prediction for the whole month.
import { dailyUsage } from "./metering";
import { fitRidge } from "./ridge";
import type { Forecast } from "./schema";
import { BILLING_TIMEZONE, localDate } from "./time";

const WINDOW = 7;
const MIN_HISTORY_DAYS = 7;
const TRAIN_FRACTION = 0.8;
const RIDGE_ALPHA = 1;
const MODEL_VERSION = "ridge-v1";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// Demo mode (simulated history seeded) defaults to the simulated series; never mixed with real.
export function defaultSource(): "real" | "simulated" {
  return process.env.SEED_SIMULATED === "0" ? "real" : "simulated";
}

// Completed days before `today` for one source, gaps filled with 0, plus today's spend so far.
export function dailySeries(tenantId: string, source: "real" | "simulated", today: string) {
  const byDate = new Map<string, number>();
  for (const row of dailyUsage(tenantId)) {
    if (row.source === source) byDate.set(row.local_date, row.provider_cost_myr);
  }
  const pastDates = [...byDate.keys()].filter((d) => d < today).sort();
  const series: { date: string; cost: number }[] = [];
  if (pastDates.length > 0) {
    for (let d = pastDates[0]; d < today; d = addDays(d, 1)) {
      series.push({ date: d, cost: byDate.get(d) ?? 0 });
    }
  }
  return { series, todaySoFar: byDate.get(today) ?? 0 };
}

// Features of day t for predicting the day after (`targetDate`). null = missing (imputed).
function features(costs: number[], t: number, targetDate: string): (number | null)[] {
  const full = t >= WINDOW - 1;
  const weekday = new Date(`${targetDate}T00:00:00Z`).getUTCDay();
  return [
    costs[t], // cost_lag_1
    full ? costs[t - WINDOW + 1] : null, // cost_lag_7 (same weekday as the target)
    full ? mean(costs.slice(t - WINDOW + 1, t + 1)) : null, // cost_roll_7
    ...Array.from({ length: 7 }, (_, d) => (d === weekday ? 1 : 0)), // target weekday one-hot
  ];
}

function mae(actual: number[], predicted: number[]): number {
  return mean(actual.map((a, i) => Math.abs(a - predicted[i])));
}

export function forecast(
  tenantId: string,
  source: "real" | "simulated",
  budgetMyr: number,
  now = new Date(),
): Forecast {
  const today = localDate(now.toISOString());
  const periodStart = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split("-").map(Number);
  const periodEnd = `${today.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;

  const { series, todaySoFar } = dailySeries(tenantId, source, today);
  const costs = series.map((s) => s.cost);

  // Supervised rows: day t (features) -> day t+1 (target), completed days only.
  const rows = series.slice(0, -1).map((_, t) => ({
    x: features(costs, t, series[t + 1].date),
    baseline: t >= WINDOW - 1 ? mean(costs.slice(t - WINDOW + 1, t + 1)) : costs[t],
    y: costs[t + 1],
  }));

  // Backtest + method selection.
  let method: Forecast["method"] = "baseline_rolling_7d";
  let fallbackReason: string | null = null;
  let baselineMae: number | null = null;
  let ridgeMae: number | null = null;
  let nTrain = 0;
  let nHoldout = 0;
  if (series.length === 0) {
    fallbackReason = "NO_HISTORY: no completed days of history; no forecast made.";
  } else if (series.length < MIN_HISTORY_DAYS || rows.length < 3) {
    fallbackReason = `SHORT_HISTORY: only ${series.length} completed days; used their average. Low confidence.`;
  } else {
    const split = Math.min(Math.max(Math.floor(rows.length * TRAIN_FRACTION), 1), rows.length - 1);
    const train = rows.slice(0, split);
    const holdout = rows.slice(split);
    nTrain = train.length;
    nHoldout = holdout.length;
    const actual = holdout.map((r) => r.y);
    baselineMae = mae(actual, holdout.map((r) => r.baseline));
    const model = fitRidge(train.map((r) => r.x), train.map((r) => r.y), RIDGE_ALPHA);
    ridgeMae = mae(actual, holdout.map((r) => Math.max(0, model.predict(r.x))));
    if (ridgeMae < baselineMae) method = "ridge";
    else if (ridgeMae > baselineMae) fallbackReason = "ML_PERFORMED_WORSE_THAN_BASELINE: using the 7-day average.";
    else fallbackReason = "ML_NO_IMPROVEMENT_OVER_BASELINE: using the 7-day average.";
  }

  // Daily prediction for the rest of the month.
  let predictNext: ((ext: number[], targetDate: string) => number) | null = null;
  if (method === "ridge") {
    const finalModel = fitRidge(rows.map((r) => r.x), rows.map((r) => r.y), RIDGE_ALPHA); // refit on all
    predictNext = (ext, d) => Math.max(0, finalModel.predict(features(ext, ext.length - 1, d)));
  } else if (series.length > 0) {
    const flat = Math.max(0, mean(costs.slice(-WINDOW)));
    predictNext = () => flat;
  }

  const completedThisMonth = series.filter((s) => s.date >= periodStart);
  const mtdCompleted = completedThisMonth.reduce((s, x) => s + x.cost, 0);
  const actualSpend = mtdCompleted + todaySoFar;

  // Walk the month: actual for completed days, then predictions from today.
  // Today counts as the larger of what's already spent and the prediction.
  let predictedRemaining: number | null = null;
  let firstPrediction: number | null = null;
  let crossing: string | null = null;
  let cumulative = 0;
  const daily: Forecast["daily"] = [];
  for (const s of completedThisMonth) {
    cumulative += s.cost;
    if (crossing === null && cumulative > budgetMyr) crossing = s.date;
    daily.push({ date: s.date, actual_myr: round2(s.cost), forecast_myr: null });
  }
  if (predictNext) {
    predictedRemaining = 0;
    const ext = [...costs];
    for (let d = today; d <= periodEnd; d = addDays(d, 1)) {
      const predicted = predictNext(ext, d);
      firstPrediction ??= predicted;
      const projected = d === today ? Math.max(todaySoFar, predicted) : predicted;
      ext.push(projected);
      predictedRemaining += d === today ? projected - todaySoFar : projected;
      cumulative += projected;
      if (crossing === null && cumulative > budgetMyr) crossing = d;
      daily.push({ date: d, actual_myr: d === today ? round2(todaySoFar) : null, forecast_myr: round2(projected) });
    }
  }
  const monthEnd = predictedRemaining === null ? null : actualSpend + predictedRemaining;
  const selectedMae = method === "ridge" ? ridgeMae : baselineMae;

  return {
    as_of: now.toISOString(),
    period_start: periodStart,
    period_end: periodEnd,
    timezone: BILLING_TIMEZONE,
    source,
    method,
    model_version: MODEL_VERSION,
    train_cutoff: series.length > 0 ? series[series.length - 1].date : null,
    history_days: series.length,
    fallback_reason: fallbackReason,
    budget_myr: budgetMyr,
    actual_spend_myr: round2(actualSpend),
    actual_budget_pct: round2((actualSpend / budgetMyr) * 100),
    daily_forecast_myr: firstPrediction === null ? null : round2(firstPrediction),
    predicted_remaining_myr: predictedRemaining === null ? null : round2(predictedRemaining),
    predicted_month_end_myr: monthEnd === null ? null : round2(monthEnd),
    predicted_budget_pct: monthEnd === null ? null : round2((monthEnd / budgetMyr) * 100),
    projected_overrun_myr: monthEnd === null ? null : round2(Math.max(0, monthEnd - budgetMyr)),
    projected_crossing_date: crossing,
    n_train: nTrain,
    n_holdout: nHoldout,
    backtest_mae_myr: selectedMae === null ? null : round2(selectedMae),
    baseline_mae_myr: baselineMae === null ? null : round2(baselineMae),
    ridge_mae_myr: ridgeMae === null ? null : round2(ridgeMae),
    daily,
  };
}
