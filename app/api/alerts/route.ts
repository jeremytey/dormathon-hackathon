// GET /api/alerts — alert history, newest first (deduplicated).
import { connection } from "next/server";
import { currentSnapshot } from "@/lib/risk";
import { listAlerts } from "@/lib/store";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET() {
  await connection(); // alerts change with usage; never prerender
  currentSnapshot(TENANT_ID); // make sure alerts reflect a recent snapshot
  return Response.json(listAlerts(TENANT_ID));
}
