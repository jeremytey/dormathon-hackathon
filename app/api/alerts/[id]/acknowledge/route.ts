// POST /api/alerts/{id}/acknowledge — marks the alert as seen.
// Does NOT approve any policy, raise the budget, or override the hard stop.
import { acknowledgeAlert } from "@/lib/store";

// TODO(A): dashboard auth. Scoped to the single demo tenant for now.
const TENANT_ID = "demo-tenant";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const alert = acknowledgeAlert(TENANT_ID, id);
  if (!alert) return Response.json({ error: "Alert not found" }, { status: 404 });
  return Response.json(alert);
}
