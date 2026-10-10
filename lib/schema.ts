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
  timestamp_utc: z.string().datetime(),
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
  hard_stop_enabled: false,
};
