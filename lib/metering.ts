// Daily and monthly usage aggregates. Plain code, no LLM.
import { listEvents } from "./store";
import type { DailyUsage, UsageEvent, UsageSummary } from "./schema";
import { BILLING_TIMEZONE, localDate } from "./time";

export function dailyUsage(tenantId: string): DailyUsage[] {
  const rows = new Map<string, DailyUsage>();
  for (const e of listEvents(tenantId)) {
    const date = localDate(e.timestamp_utc);
    const key = `${date}|${e.source}`;
    const row = rows.get(key) ?? {
      local_date: date,
      source: e.source,
      requests: 0,
      provider_cost_myr: 0,
      avoided_cost_myr: 0,
      input_tokens: 0,
      output_tokens: 0,
      exact_hits: 0,
      cache_hit_rate: 0,
    };
    row.requests += 1;
    row.provider_cost_myr += e.provider_cost_myr ?? 0;
    row.avoided_cost_myr += e.estimated_avoided_cost_myr ?? 0;
    row.input_tokens += e.input_tokens;
    row.output_tokens += e.output_tokens;
    if (e.cache_type === "exact_hit") row.exact_hits += 1;
    row.cache_hit_rate = row.exact_hits / row.requests;
    rows.set(key, row);
  }
  return [...rows.values()].sort(
    (a, b) => a.local_date.localeCompare(b.local_date) || a.source.localeCompare(b.source),
  );
}

function totals(events: UsageEvent[]) {
  return {
    requests: events.length,
    provider_cost_myr: events.reduce((s, e) => s + (e.provider_cost_myr ?? 0), 0),
    avoided_cost_myr: events.reduce((s, e) => s + (e.estimated_avoided_cost_myr ?? 0), 0),
    exact_hits: events.filter((e) => e.cache_type === "exact_hit").length,
  };
}

export function usageSummary(tenantId: string, budgetMyr: number, now = new Date()): UsageSummary {
  const month = localDate(now.toISOString()).slice(0, 7);
  const inMonth = listEvents(tenantId).filter((e) => localDate(e.timestamp_utc).startsWith(month));
  const real = totals(inMonth.filter((e) => e.source === "real"));
  return {
    month,
    timezone: BILLING_TIMEZONE,
    monthly_budget_myr: budgetMyr,
    real,
    simulated: totals(inMonth.filter((e) => e.source === "simulated")),
    actual_budget_pct: (real.provider_cost_myr / budgetMyr) * 100,
  };
}
