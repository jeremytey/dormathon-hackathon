// Month-end spend forecast. Plain code, no LLM: trailing 7-day mean of completed days.
import { dailyUsage } from "./metering";
import type { Forecast } from "./schema";
import { BILLING_TIMEZONE, localDate } from "./time";

const WINDOW = 7;
const BACKTEST_DAYS = 28;
const MODEL_VERSION = "baseline-v1";

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

  // Daily cost by date for this source, gaps filled with 0 between first day and yesterday.
  const byDate = new Map<string, number>();
  for (const row of dailyUsage(tenantId)) {
    if (row.source === source) byDate.set(row.local_date, row.provider_cost_myr);
  }
  const todaySoFar = byDate.get(today) ?? 0;
  const pastDates = [...byDate.keys()].filter((d) => d < today).sort();
  const series: { date: string; cost: number }[] = [];
  if (pastDates.length > 0) {
    for (let d = pastDates[0]; d < today; d = addDays(d, 1)) {
      series.push({ date: d, cost: byDate.get(d) ?? 0 });
    }
  }

  // Rolling one-day-ahead backtest: predict day i from the WINDOW days before it.
  let modelErr = 0;
  let naiveErr = 0;
  let backtestDays = 0;
  for (let i = Math.max(WINDOW, series.length - BACKTEST_DAYS); i < series.length; i++) {
    const predicted = mean(series.slice(i - WINDOW, i).map((s) => s.cost));
    modelErr += Math.abs(predicted - series[i].cost);
    naiveErr += Math.abs(series[i - 1].cost - series[i].cost);
    backtestDays++;
  }

  const completedThisMonth = series.filter((s) => s.date >= periodStart);
  const mtdCompleted = completedThisMonth.reduce((s, x) => s + x.cost, 0);
  const actual = mtdCompleted + todaySoFar;

  const recent = series.slice(-WINDOW).map((s) => s.cost);
  const fallbackReason =
    series.length === 0
      ? "No completed days of history; no forecast made."
      : series.length < WINDOW
        ? `Only ${series.length} completed days of history; averaged those instead of 7. Low confidence.`
        : null;
  const daily_forecast = recent.length > 0 ? Math.max(0, mean(recent)) : null;

  // Walk the month: actual for completed days, then projection from today.
  // Today counts as the larger of what's already spent and a normal day.
  let predictedRemaining: number | null = null;
  let crossing: string | null = null;
  let cumulative = 0;
  const daily: Forecast["daily"] = [];
  for (const s of completedThisMonth) {
    cumulative += s.cost;
    if (crossing === null && cumulative > budgetMyr) crossing = s.date;
    daily.push({ date: s.date, actual_myr: round2(s.cost), forecast_myr: null });
  }
  if (daily_forecast !== null) {
    predictedRemaining = 0;
    for (let d = today; d <= periodEnd; d = addDays(d, 1)) {
      const projected = d === today ? Math.max(todaySoFar, daily_forecast) : daily_forecast;
      predictedRemaining += d === today ? projected - todaySoFar : projected;
      cumulative += projected;
      if (crossing === null && cumulative > budgetMyr) crossing = d;
      daily.push({ date: d, actual_myr: d === today ? round2(todaySoFar) : null, forecast_myr: round2(projected) });
    }
  }
  const monthEnd = predictedRemaining === null ? null : actual + predictedRemaining;

  return {
    as_of: now.toISOString(),
    period_start: periodStart,
    period_end: periodEnd,
    timezone: BILLING_TIMEZONE,
    source,
    method: "rolling_7d_mean",
    model_version: MODEL_VERSION,
    train_cutoff: series.length > 0 ? series[series.length - 1].date : null,
    history_days: series.length,
    fallback_reason: fallbackReason,
    budget_myr: budgetMyr,
    actual_spend_myr: round2(actual),
    actual_budget_pct: round2((actual / budgetMyr) * 100),
    daily_forecast_myr: daily_forecast === null ? null : round2(daily_forecast),
    predicted_remaining_myr: predictedRemaining === null ? null : round2(predictedRemaining),
    predicted_month_end_myr: monthEnd === null ? null : round2(monthEnd),
    predicted_budget_pct: monthEnd === null ? null : round2((monthEnd / budgetMyr) * 100),
    projected_overrun_myr: monthEnd === null ? null : round2(Math.max(0, monthEnd - budgetMyr)),
    projected_crossing_date: crossing,
    backtest_days: backtestDays,
    backtest_mae_myr: backtestDays > 0 ? round2(modelErr / backtestDays) : null,
    naive_mae_myr: backtestDays > 0 ? round2(naiveErr / backtestDays) : null,
    daily,
  };
}
