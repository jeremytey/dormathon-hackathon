// GET /api/anomalies — every detected cost spike in the history.
import { connection } from "next/server";
import { detectAnomalies } from "@/lib/anomaly";
import { dailySeries, defaultSource } from "@/lib/forecast";
import { localDate } from "@/lib/time";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET() {
  await connection(); // history changes with usage; never prerender
  const { series } = dailySeries(TENANT_ID, defaultSource(), localDate(new Date().toISOString()));
  return Response.json(detectAnomalies(series));
}
