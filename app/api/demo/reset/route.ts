// POST /api/demo/reset — start a rehearsal from the same state every time:
// default settings, simulated history only, empty cache, no alerts or policy log.
// Only available in demo mode (simulated history seeded).
import { clearCache } from "@/lib/cache";
import { defaultSource } from "@/lib/forecast";
import { refreshSnapshot } from "@/lib/risk";
import { resetStore } from "@/lib/store";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function POST() {
  if (defaultSource() !== "simulated") {
    return Response.json({ error: "Demo reset is only available in demo mode" }, { status: 403 });
  }
  resetStore();
  clearCache();
  const snapshot = refreshSnapshot(TENANT_ID); // recreate the early-warning alert straight away
  return Response.json({ reset: true, risk_level: snapshot.risk_level });
}
