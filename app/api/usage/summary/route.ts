// GET /api/usage/summary — current billing month totals vs budget.
import { connection } from "next/server";
import { usageSummary } from "@/lib/metering";
import { getSettings } from "@/lib/store";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET() {
  await connection(); // usage changes per request; never prerender
  return Response.json(usageSummary(TENANT_ID, getSettings(TENANT_ID).monthly_budget_myr));
}
