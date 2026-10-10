// Risk and policy rules. Plain code, no LLM.
// Actual % and forecast % are compared separately; the higher risk wins (never added).
import type { Forecast, RiskLevel, RiskSnapshot, Settings } from "./schema";

const ORDER: RiskLevel[] = ["normal", "preventive", "high", "critical"];
const higher = (a: RiskLevel, b: RiskLevel) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);
export const atLeast = (level: RiskLevel, min: RiskLevel) => ORDER.indexOf(level) >= ORDER.indexOf(min);

// A forecast over the predictive threshold is an early warning at "high" risk.
const PREDICTIVE_LEVEL: RiskLevel = "high";

export function actualLevel(pct: number, t: Settings["actual_thresholds"]): RiskLevel {
  if (pct >= t.critical) return "critical";
  if (pct >= t.high) return "high";
  if (pct >= t.preventive) return "preventive";
  return "normal";
}

export type RiskEvaluation = Omit<RiskSnapshot, "computed_at" | "policy_log">;

export function evaluateRisk(settings: Settings, f: Forecast): RiskEvaluation {
  const actual = actualLevel(f.actual_budget_pct, settings.actual_thresholds);
  const predictive =
    f.predicted_budget_pct !== null && f.predicted_budget_pct >= settings.predictive_threshold_pct;
  const level = predictive ? higher(actual, PREDICTIVE_LEVEL) : actual;

  const reasons: string[] = [];
  if (actual !== "normal") {
    reasons.push(`Actual spend RM${f.actual_spend_myr} is ${f.actual_budget_pct}% of the RM${f.budget_myr} budget (${actual} threshold).`);
  }
  if (predictive) {
    reasons.push(
      `Forecast month-end RM${f.predicted_month_end_myr} is ${f.predicted_budget_pct}% of budget` +
        (f.projected_crossing_date ? `, crossing the budget on ${f.projected_crossing_date}.` : "."),
    );
  }

  // Output cap: always_on applies it when approved; adaptive only at high risk; manual never.
  const capWanted =
    settings.mode === "always_on" || (settings.mode === "adaptive" && atLeast(level, "high"));
  const capOn = settings.output_cap_approved && capWanted;

  const recommendations: string[] = [];
  if (atLeast(level, "high") && !capOn) {
    recommendations.push(
      settings.output_cap_approved
        ? `Switch to Adaptive mode so the approved reply cap (${settings.output_cap_tokens} tokens) can turn on.`
        : `Approve the reply cap (${settings.output_cap_tokens} tokens) so Adaptive mode can use it at high risk.`,
    );
  }
  if (!settings.exact_cache_approved) recommendations.push("Approve the exact FAQ cache to avoid paying for repeated questions.");

  return {
    source: f.source,
    mode: settings.mode,
    actual_budget_pct: f.actual_budget_pct,
    predicted_budget_pct: f.predicted_budget_pct,
    actual_level: actual,
    predictive_triggered: predictive,
    risk_level: level,
    reasons,
    active_policies: {
      exact_cache: settings.exact_cache_approved,
      output_cap_tokens: capOn ? settings.output_cap_tokens : null,
    },
    recommendations,
    hard_stop_active: settings.hard_stop_enabled && f.actual_budget_pct >= 100,
  };
}
