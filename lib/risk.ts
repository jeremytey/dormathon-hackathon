// Risk snapshot: forecast -> risk -> alerts -> policy changes, saved for the gateway to read.
// Recomputed at most once a minute (or when settings change), never per prompt.
import { randomUUID } from "crypto";
import { detectAnomalies } from "./anomaly";
import { dailySeries, defaultSource, forecast } from "./forecast";
import { evaluateRisk } from "./policy";
import type { Alert, RiskSnapshot } from "./schema";
import { addAlert, getSettings, getSnapshot, policyLog, saveSnapshot } from "./store";
import { localDate } from "./time";

const MAX_AGE_MS = 60_000;
const ANOMALY_LOOKBACK_DAYS = 30;

export function currentSnapshot(tenantId: string): RiskSnapshot {
  const snap = getSnapshot(tenantId);
  if (snap && Date.now() - Date.parse(snap.computed_at) < MAX_AGE_MS) return snap;
  return refreshSnapshot(tenantId);
}

export function refreshSnapshot(tenantId: string, now = new Date()): RiskSnapshot {
  const settings = getSettings(tenantId);
  const source = defaultSource();
  const f = forecast(tenantId, source, settings.monthly_budget_myr, now);
  const risk = evaluateRisk(settings, f);
  const period = f.period_start.slice(0, 7);
  const createdAt = now.toISOString();

  const alert = (a: Omit<Alert, "id" | "billing_period" | "source" | "created_at" | "acknowledged_at">) =>
    addAlert(tenantId, {
      id: randomUUID(),
      billing_period: period,
      source,
      created_at: createdAt,
      acknowledged_at: null,
      ...a,
    });

  if (risk.actual_level !== "normal") {
    alert({
      alert_type: "actual_threshold",
      severity: risk.actual_level,
      dedupe_key: `${period}:actual:${risk.actual_level}`,
      message: `Actual spend has reached ${f.actual_budget_pct}% of the RM${f.budget_myr} budget.`,
      recommendation: risk.recommendations[0] ?? null,
    });
  }
  if (risk.predictive_triggered) {
    alert({
      alert_type: "predictive_overrun",
      severity: "high",
      dedupe_key: `${period}:predictive`,
      message:
        `Early warning: forecast month-end spend is RM${f.predicted_month_end_myr} (${f.predicted_budget_pct}% of budget), ` +
        `an overrun of RM${f.projected_overrun_myr}` +
        (f.projected_crossing_date ? `, crossing the budget on ${f.projected_crossing_date}` : "") +
        `. Actual spend so far is only ${f.actual_budget_pct}%.`,
      recommendation: risk.recommendations[0] ?? null,
    });
  }
  if (risk.hard_stop_active) {
    alert({
      alert_type: "hard_stop",
      severity: "critical",
      dedupe_key: `${period}:hard_stop`,
      message: `Budget reached: hard stop is blocking new AI requests until the budget is raised or hard stop is turned off.`,
      recommendation: null,
    });
  }
  const { series } = dailySeries(tenantId, source, localDate(createdAt));
  const since = series[Math.max(0, series.length - ANOMALY_LOOKBACK_DAYS)]?.date ?? "";
  for (const a of detectAnomalies(series).filter((x) => x.date >= since)) {
    alert({
      alert_type: "anomaly",
      severity: "preventive",
      dedupe_key: `anomaly:${a.date}`,
      message: `${a.date}: ${a.explanation}`,
      recommendation: null,
    });
  }

  // Record output-cap activations/deactivations with the reason and forecast version.
  const log = policyLog(tenantId);
  const wasOn = getSnapshot(tenantId)?.active_policies.output_cap_tokens != null;
  const isOn = risk.active_policies.output_cap_tokens !== null;
  if (wasOn !== isOn) {
    log.push({
      timestamp: createdAt,
      policy: "output_cap",
      action: isOn ? "activated" : "deactivated",
      reason: isOn
        ? `${risk.mode} mode, risk ${risk.risk_level}: ${risk.reasons.join(" ") || "always on"}`
        : `${risk.mode} mode, risk ${risk.risk_level}: ` +
          (risk.mode === "manual"
            ? "manual mode only recommends, never changes policy automatically."
            : !settings.output_cap_approved
              ? "reply cap is not approved."
              : "risk is below high."),
      forecast_as_of: f.as_of,
    });
  }

  const snapshot: RiskSnapshot = { computed_at: createdAt, ...risk, policy_log: [...log] };
  saveSnapshot(tenantId, snapshot);
  return snapshot;
}
