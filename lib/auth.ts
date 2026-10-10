// Gateway key auth. The client holds a scoped TokenGuard key, never the provider key.
import { timingSafeEqual } from "crypto";

export type TenantContext = { tenant_id: string; app_id: string };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Single demo tenant for now; a second tenant is added for the isolation test later.
export function resolveTenant(headers: Headers): TenantContext | null {
  const expected = process.env.GATEWAY_KEY;
  if (!expected) return null;
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = headers.get("x-api-key") ?? bearer;
  if (!key || !safeEqual(key, expected)) return null;
  return { tenant_id: "demo-tenant", app_id: "lumi" };
}
