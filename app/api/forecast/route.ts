// GET /api/forecast?source=simulated|real — month-end spend forecast.
// Default source is "simulated" while the demo history is seeded (demo mode), else "real".
// The two sources are never mixed; the response says which one it used.
import { connection } from "next/server";
import { defaultSource, forecast } from "@/lib/forecast";
import { getSettings } from "@/lib/store";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET(request: Request) {
  await connection(); // forecast changes with usage; never prerender
  const param = new URL(request.url).searchParams.get("source");
  if (param !== null && param !== "real" && param !== "simulated") {
    return Response.json({ error: "source must be real or simulated" }, { status: 400 });
  }
  const source = param ?? defaultSource();
  return Response.json(forecast(TENANT_ID, source, getSettings(TENANT_ID).monthly_budget_myr));
}
