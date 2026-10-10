// GET /api/budget/suggestion?buffer_pct=10 — suggested monthly budget from past complete months.
// To accept it, the dashboard PUTs /api/settings with this amount and budget_source "suggested_accepted".
import { connection } from "next/server";
import { suggestBudget } from "@/lib/budget";
import { defaultSource } from "@/lib/forecast";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET(request: Request) {
  await connection(); // history changes with usage; never prerender
  const param = new URL(request.url).searchParams.get("buffer_pct");
  const bufferPct = param === null ? 10 : Number(param);
  if (!Number.isFinite(bufferPct) || bufferPct < 0 || bufferPct > 100) {
    return Response.json({ error: "buffer_pct must be a number from 0 to 100" }, { status: 400 });
  }
  return Response.json(suggestBudget(TENANT_ID, defaultSource(), bufferPct));
}
