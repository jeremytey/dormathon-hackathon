// GET /api/usage/daily — daily usage rows, real and simulated kept separate.
import { connection } from "next/server";
import { dailyUsage } from "@/lib/metering";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET() {
  await connection(); // usage changes per request; never prerender
  return Response.json(dailyUsage(TENANT_ID));
}
