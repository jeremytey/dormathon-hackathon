// Suggested monthly budget: median of completed past months + a buffer. Plain code, no LLM.
// A suggestion only: it is applied when the user saves settings with
// budget_source "suggested_accepted". It is never the forecast itself.
import { dailySeries } from "./forecast";
import type { BudgetSuggestion } from "./schema";
import { localDate } from "./time";

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function suggestBudget(
  tenantId: string,
  source: "real" | "simulated",
  bufferPct: number,
  now = new Date(),
): BudgetSuggestion {
  const today = localDate(now.toISOString());
  const currentMonth = today.slice(0, 7);
  const { series } = dailySeries(tenantId, source, today);

  // A month counts only if every one of its days is in the history (no partial first month).
  const byMonth = new Map<string, { days: number; total: number }>();
  for (const { date, cost } of series) {
    const month = date.slice(0, 7);
    if (month === currentMonth) continue;
    const row = byMonth.get(month) ?? { days: 0, total: 0 };
    row.days += 1;
    row.total += cost;
    byMonth.set(month, row);
  }
  const completed = [...byMonth.entries()]
    .filter(([month, r]) => r.days === daysInMonth(month))
    .map(([month, r]) => ({ month, total_myr: Math.round(r.total * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const limitations = [
    "Based only on past complete months; does not include growth this month (see the forecast).",
    "A suggestion only: it is not applied until you accept it in settings.",
  ];
  if (source === "simulated") limitations.push("Calculated from simulated demo history, not real usage.");

  if (completed.length === 0) {
    return {
      suggested_budget_myr: null,
      basis: "median_completed_months",
      completed_months: [],
      buffer_pct: bufferPct,
      source,
      limitations: ["No complete past month of history yet; no suggestion made.", ...limitations.slice(1)],
    };
  }
  const totals = completed.map((c) => c.total_myr).sort((a, b) => a - b);
  const mid = Math.floor(totals.length / 2);
  const median = totals.length % 2 ? totals[mid] : (totals[mid - 1] + totals[mid]) / 2;
  // Round up to a whole ringgit so the suggestion reads cleanly.
  const suggested = Math.ceil(median * (1 + bufferPct / 100));
  if (completed.length < 3) limitations.push(`Only ${completed.length} complete month(s) of history; low confidence.`);

  return {
    suggested_budget_myr: suggested,
    basis: "median_completed_months",
    completed_months: completed,
    buffer_pct: bufferPct,
    source,
    limitations,
  };
}
