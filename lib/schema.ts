// Frozen contract shared by Person A (gateway) and Person B (dashboard, seed data).
// Change only after telling the other person and updating build_pack/API_CONTRACT.md.
import { z } from "zod";

// ---------- Anthropic Messages API subset (non-streaming text only) ----------

const TextBlock = z.object({ type: z.literal("text"), text: z.string() });

export const AnthropicMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(TextBlock).min(1)]),
});

// .strict() rejects anything we don't support (tools, images, betas, output_config...)
// instead of silently dropping it.
export const AnthropicRequest = z
  .object({
    model: z.string().min(1),
    max_tokens: z.number().int().positive(),
    messages: z.array(AnthropicMessage).min(1),
    system: z.union([z.string(), z.array(TextBlock)]).optional(),
    temperature: z.number().min(0).max(1).optional(),
    top_p: z.number().optional(),
    top_k: z.number().int().optional(),
    stop_sequences: z.array(z.string()).optional(),
    stream: z.literal(false).optional(),
    metadata: z.object({ user_id: z.string().optional() }).optional(),
  })
  .strict();
export type AnthropicRequest = z.infer<typeof AnthropicRequest>;

export const AnthropicUsage = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_creation_input_tokens: z.number().int().nonnegative().nullable().optional(),
  cache_read_input_tokens: z.number().int().nonnegative().nullable().optional(),
});

export const AnthropicResponse = z.object({
  id: z.string(),
  type: z.literal("message"),
  role: z.literal("assistant"),
  content: z.array(TextBlock),
  model: z.string(),
  stop_reason: z.string().nullable(),
  stop_sequence: z.string().nullable(),
  usage: AnthropicUsage,
});
export type AnthropicResponse = z.infer<typeof AnthropicResponse>;

// ---------- Metering: one event per request outcome ----------
// Person B's seed script writes rows in exactly this shape (source: "simulated").

export const UsageEvent = z.object({
  request_id: z.string(),
  tenant_id: z.string(),
  app_id: z.string(),
  timestamp_utc: z.iso.datetime(),
  source: z.enum(["real", "simulated"]),
  provider: z.string(),
  model: z.string(),
  status: z.enum(["success", "cache_hit", "provider_error", "blocked"]),
  cache_type: z.enum(["miss", "exact_hit", "bypass"]),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  // null = model has no known price
  provider_cost_myr: z.number().nonnegative().nullable(),
  estimated_avoided_cost_myr: z.number().nonnegative().nullable(),
  usd_to_myr_rate: z.number().positive(),
  latency_ms: z.number().int().nonnegative(),
});
export type UsageEvent = z.infer<typeof UsageEvent>;

// ---------- Dashboard API responses ----------

// GET /api/usage/daily — one row per local date (Asia/Kuala_Lumpur) per source.
export const DailyUsage = z.object({
  local_date: z.string(), // YYYY-MM-DD
  source: z.enum(["real", "simulated"]),
  requests: z.number().int(),
  provider_cost_myr: z.number(),
  avoided_cost_myr: z.number(),
  input_tokens: z.number().int(),
  output_tokens: z.number().int(),
  exact_hits: z.number().int(),
  cache_hit_rate: z.number(), // exact_hits / requests
});
export type DailyUsage = z.infer<typeof DailyUsage>;

// GET /api/usage/summary — current billing month, real and simulated kept separate.
const SourceTotals = z.object({
  requests: z.number().int(),
  provider_cost_myr: z.number(),
  avoided_cost_myr: z.number(),
  exact_hits: z.number().int(),
});
export const UsageSummary = z.object({
  month: z.string(), // YYYY-MM
  timezone: z.string(),
  monthly_budget_myr: z.number(),
  real: SourceTotals,
  simulated: SourceTotals,
  actual_budget_pct: z.number(), // real spend / budget * 100
});
export type UsageSummary = z.infer<typeof UsageSummary>;

// GET /api/forecast — month-end projection. Numbers come from lib/forecast.ts (plain code).
// Forecast fields are null when there is not enough history (never a made-up number).
export const Forecast = z.object({
  as_of: z.iso.datetime(),
  period_start: z.string(), // YYYY-MM-DD
  period_end: z.string(),
  timezone: z.string(),
  source: z.enum(["real", "simulated"]),
  method: z.enum(["baseline_rolling_7d", "ridge"]), // whichever had lower holdout MAE
  model_version: z.string(),
  train_cutoff: z.string().nullable(), // last completed day used
  history_days: z.number().int(),
  fallback_reason: z.string().nullable(),
  budget_myr: z.number(),
  actual_spend_myr: z.number(), // month to date, including today so far
  actual_budget_pct: z.number(),
  daily_forecast_myr: z.number().nullable(), // prediction for today (first forecast day)
  predicted_remaining_myr: z.number().nullable(),
  predicted_month_end_myr: z.number().nullable(),
  predicted_budget_pct: z.number().nullable(),
  projected_overrun_myr: z.number().nullable(), // 0 when under budget
  projected_crossing_date: z.string().nullable(),
  // Chronological 80/20 backtest (oldest 80% train, newest 20% holdout), next-day MAE in MYR.
  n_train: z.number().int(),
  n_holdout: z.number().int(),
  backtest_mae_myr: z.number().nullable(), // MAE of the chosen method
  baseline_mae_myr: z.number().nullable(), // 7-day average
  ridge_mae_myr: z.number().nullable(),
  // Chart: every day of the current month; actual for past days, forecast for today onward.
  daily: z.array(
    z.object({
      date: z.string(),
      actual_myr: z.number().nullable(),
      forecast_myr: z.number().nullable(),
    }),
  ),
});
export type Forecast = z.infer<typeof Forecast>;

// GET /api/budget/suggestion — a suggestion, never applied automatically.
export const BudgetSuggestion = z.object({
  suggested_budget_myr: z.number().nullable(), // null when no complete past month
  basis: z.literal("median_completed_months"),
  completed_months: z.array(z.object({ month: z.string(), total_myr: z.number() })),
  buffer_pct: z.number(),
  source: z.enum(["real", "simulated"]),
  limitations: z.array(z.string()),
});
export type BudgetSuggestion = z.infer<typeof BudgetSuggestion>;

// ---------- Budget / policy settings ----------

export const Settings = z
  .object({
    monthly_budget_myr: z.number().positive(),
    budget_source: z.enum(["user_set", "suggested_accepted"]),
    mode: z.enum(["manual", "adaptive", "always_on"]),
    actual_thresholds: z.object({
      preventive: z.number(),
      high: z.number(),
      critical: z.number(),
    }),
    predictive_threshold_pct: z.number().positive(),
    exact_cache_approved: z.boolean(),
    // Output policy: cap reply length (max_tokens). Adaptive turns it on only at high risk,
    // and only if approved here; always_on applies it whenever approved; manual never does.
    output_cap_approved: z.boolean(),
    output_cap_tokens: z.number().int().positive(),
    hard_stop_enabled: z.boolean(),
  })
  .refine(
    ({ actual_thresholds: t }) =>
      0 < t.preventive && t.preventive < t.high && t.high < t.critical && t.critical <= 100,
    { message: "Thresholds must satisfy 0 < preventive < high < critical <= 100" },
  );
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  monthly_budget_myr: 200,
  budget_source: "user_set",
  mode: "adaptive",
  actual_thresholds: { preventive: 50, high: 75, critical: 90 },
  predictive_threshold_pct: 100,
  exact_cache_approved: true,
  output_cap_approved: false,
  output_cap_tokens: 300,
  hard_stop_enabled: false,
};

// ---------- Risk, policy, alerts ----------

export const RiskLevel = z.enum(["normal", "preventive", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const Alert = z.object({
  id: z.string(),
  billing_period: z.string(), // YYYY-MM
  alert_type: z.enum(["actual_threshold", "predictive_overrun", "anomaly", "hard_stop"]),
  severity: RiskLevel,
  dedupe_key: z.string(),
  message: z.string(),
  recommendation: z.string().nullable(),
  source: z.enum(["real", "simulated"]),
  created_at: z.iso.datetime(),
  // Acknowledged = someone saw it. NOT approval, NOT permission to exceed budget.
  acknowledged_at: z.iso.datetime().nullable(),
});
export type Alert = z.infer<typeof Alert>;

export const PolicyChange = z.object({
  timestamp: z.iso.datetime(),
  policy: z.literal("output_cap"),
  action: z.enum(["activated", "deactivated"]),
  reason: z.string(),
  forecast_as_of: z.iso.datetime(),
});
export type PolicyChange = z.infer<typeof PolicyChange>;

export const Anomaly = z.object({
  date: z.string(),
  observed_cost_myr: z.number(),
  trailing_mean_myr: z.number(), // prior 7 days, excluding this day
  ratio: z.number(),
  threshold_ratio: z.number(),
  explanation: z.string(),
});
export type Anomaly = z.infer<typeof Anomaly>;

// GET /api/risk — the saved snapshot the gateway reads (refreshed at most once a minute).
export const RiskSnapshot = z.object({
  computed_at: z.iso.datetime(),
  source: z.enum(["real", "simulated"]),
  mode: z.enum(["manual", "adaptive", "always_on"]),
  actual_budget_pct: z.number(),
  predicted_budget_pct: z.number().nullable(),
  actual_level: RiskLevel,
  predictive_triggered: z.boolean(),
  risk_level: RiskLevel, // higher of actual level and predictive trigger (never added together)
  reasons: z.array(z.string()),
  active_policies: z.object({
    exact_cache: z.boolean(),
    output_cap_tokens: z.number().int().nullable(),
  }),
  recommendations: z.array(z.string()),
  hard_stop_active: z.boolean(),
  policy_log: z.array(PolicyChange),
});
export type RiskSnapshot = z.infer<typeof RiskSnapshot>;
