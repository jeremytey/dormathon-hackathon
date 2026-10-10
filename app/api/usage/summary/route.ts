// GET /api/usage/summary — current billing month totals vs budget.
import { connection } from "next/server";
import { usageSummary } from "@/lib/metering";
import { DEFAULT_SETTINGS } from "@/lib/schema";

// TODO(A): dashboard auth + saved settings. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET() {
  await connection(); // usage changes per request; never prerender
  return Response.json(usageSummary(TENANT_ID, DEFAULT_SETTINGS.monthly_budget_myr));
}
