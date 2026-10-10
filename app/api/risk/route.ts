// GET /api/risk — current risk level, reasons, active policies, recommendations, policy log.
import { connection } from "next/server";
import { currentSnapshot } from "@/lib/risk";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET() {
  await connection(); // risk changes with usage; never prerender
  return Response.json(currentSnapshot(TENANT_ID));
}
