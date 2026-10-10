// GET/PUT /api/settings — budget, mode, thresholds. Set from the dashboard.
import { connection } from "next/server";
import { refreshSnapshot } from "@/lib/risk";
import { Settings } from "@/lib/schema";
import { getSettings, saveSettings } from "@/lib/store";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function GET() {
  await connection(); // settings change at runtime; never prerender
  return Response.json(getSettings(TENANT_ID));
}

// Full replace: send the whole settings object.
export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = Settings.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid settings",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }
  saveSettings(TENANT_ID, parsed.data);
  refreshSnapshot(TENANT_ID); // new thresholds/mode apply to the next request
  return Response.json(parsed.data);
}
