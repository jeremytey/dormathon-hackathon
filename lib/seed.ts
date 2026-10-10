// Deterministic SIMULATED usage history (every event has source: "simulated").
// Same seed -> same numbers on every start, so the demo is repeatable.
// Shape: ~120 days ending yesterday, growing spend, quiet weekends, two spikes.
// Tuned so the current month heads for roughly RM280 against an RM200 budget.
// Owner: Person B may retune; keep the UsageEvent shape.
import { costMyr, usdToMyrRate } from "./pricing";
import type { UsageEvent } from "./schema";
import { localDate } from "./time";

const DAYS = 120;
const START_DAILY_MYR = 3;
const END_DAILY_MYR = 10.5;
const SPIKE_DAYS_AGO = new Set([45, 18]);
const WEEKDAY_FACTOR = [0.4, 1.05, 1.1, 1.05, 1.0, 1.0, 0.5]; // Sun..Sat
const CACHE_HIT_SHARE = 0.12;

const MODEL = "claude-sonnet-5-5";
const INPUT_TOKENS = 2500;
const OUTPUT_TOKENS = 600;

// mulberry32: small seeded PRNG.
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulatedEvents(tenantId: string, appId: string, now = new Date()): UsageEvent[] {
  const rand = prng(42);
  const perRequest = costMyr(MODEL, INPUT_TOKENS, OUTPUT_TOKENS)!;
  const rate = usdToMyrRate();
  const events: UsageEvent[] = [];

  for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
    const date = localDate(new Date(now.getTime() - daysAgo * 86_400_000).toISOString());
    const weekday = new Date(`${date}T12:00:00+08:00`).getUTCDay();
    const trend = START_DAILY_MYR + (END_DAILY_MYR - START_DAILY_MYR) * ((DAYS - daysAgo) / (DAYS - 1));
    const noise = 0.9 + rand() * 0.2;
    const spike = SPIKE_DAYS_AGO.has(daysAgo) ? 2.5 : 1;
    const targetMyr = trend * WEEKDAY_FACTOR[weekday] * noise * spike;

    const misses = Math.max(1, Math.round(targetMyr / perRequest));
    const hits = Math.round(misses * CACHE_HIT_SHARE);
    for (let i = 0; i < misses + hits; i++) {
      const hit = i >= misses;
      const minute = Math.floor(rand() * 600); // 09:00–18:59 local
      const hh = String(9 + Math.floor(minute / 60)).padStart(2, "0");
      const mm = String(minute % 60).padStart(2, "0");
      events.push({
        request_id: `sim-${date}-${i}`,
        tenant_id: tenantId,
        app_id: appId,
        timestamp_utc: new Date(`${date}T${hh}:${mm}:00+08:00`).toISOString(),
        source: "simulated",
        provider: "simulated",
        model: MODEL,
        status: hit ? "cache_hit" : "success",
        cache_type: hit ? "exact_hit" : "miss",
        input_tokens: hit ? 0 : INPUT_TOKENS,
        output_tokens: hit ? 0 : OUTPUT_TOKENS,
        provider_cost_myr: hit ? 0 : perRequest,
        estimated_avoided_cost_myr: hit ? perRequest : 0,
        usd_to_myr_rate: rate,
        latency_ms: hit ? 15 : 900 + Math.floor(rand() * 1200),
      });
    }
  }
  return events;
}
