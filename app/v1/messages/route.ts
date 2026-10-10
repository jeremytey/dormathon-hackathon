// POST /v1/messages — Anthropic-compatible gateway for Lumi (non-streaming text subset).
import { randomUUID } from "crypto";
import { resolveTenant } from "@/lib/auth";
import { cacheEligibility, cacheKey, lookup, store } from "@/lib/cache";
import { costMyr, usdToMyrRate } from "@/lib/pricing";
import { callProvider } from "@/lib/provider";
import { currentSnapshot } from "@/lib/risk";
import { AnthropicRequest, type UsageEvent } from "@/lib/schema";
import { addEvent } from "@/lib/store";

function anthropicError(status: number, type: string, message: string) {
  return Response.json({ type: "error", error: { type, message } }, { status });
}

export async function POST(request: Request) {
  const started = Date.now();
  const tenant = resolveTenant(request.headers);
  if (!tenant) return anthropicError(401, "authentication_error", "Invalid TokenGuard gateway key");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return anthropicError(400, "invalid_request_error", "Body must be JSON");
  }

  const parsed = AnthropicRequest.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return anthropicError(
      400,
      "invalid_request_error",
      `Unsupported or invalid request (${issue.path.join(".") || "body"}): ${issue.message}`,
    );
  }

  // Policy comes from the saved risk snapshot (refreshed at most once a minute).
  const snapshot = currentSnapshot(tenant.tenant_id);
  const cap = snapshot.active_policies.output_cap_tokens;
  const req =
    cap !== null && parsed.data.max_tokens > cap ? { ...parsed.data, max_tokens: cap } : parsed.data;
  const policyHeaders = {
    "x-tokenguard-risk": snapshot.risk_level,
    "x-tokenguard-output-cap": cap === null ? "off" : String(cap),
  };

  const event = (fields: Partial<UsageEvent>): UsageEvent => ({
    request_id: randomUUID(),
    tenant_id: tenant.tenant_id,
    app_id: tenant.app_id,
    timestamp_utc: new Date().toISOString(),
    source: "real",
    provider: "anthropic",
    model: req.model,
    status: "success",
    cache_type: "miss",
    input_tokens: 0,
    output_tokens: 0,
    provider_cost_myr: 0,
    estimated_avoided_cost_myr: 0,
    usd_to_myr_rate: usdToMyrRate(),
    latency_ms: Date.now() - started,
    ...fields,
  });

  if (snapshot.hard_stop_active) {
    addEvent(event({ provider: "none", status: "blocked", cache_type: "bypass" }));
    // 403, not 429: the Anthropic SDK retries 429s, and a budget stop should not be retried.
    return anthropicError(
      403,
      "permission_error",
      "TokenGuard hard stop: the monthly AI budget is used up. Ask an admin to raise the budget or turn off hard stop.",
    );
  }

  const eligibility = cacheEligibility(req, snapshot.active_policies.exact_cache);
  const key = eligibility.eligible ? cacheKey(req, tenant) : null;

  const hit = key ? lookup(key) : undefined;
  if (hit) {
    addEvent(event({ status: "cache_hit", cache_type: "exact_hit", estimated_avoided_cost_myr: hit.cost_myr }));
    return Response.json(
      { ...hit.response, id: `msg_tg_${randomUUID()}`, usage: { input_tokens: 0, output_tokens: 0 } },
      { headers: { "x-tokenguard-cache": "exact_hit", ...policyHeaders } },
    );
  }

  const { response, mocked, fallback } = await callProvider(req);
  const { input_tokens, output_tokens } = response.usage;
  const cost = fallback ? 0 : costMyr(response.model, input_tokens, output_tokens);

  addEvent(
    event({
      provider: mocked ? "mock" : "anthropic",
      model: response.model,
      status: fallback ? "provider_error" : "success",
      cache_type: eligibility.eligible ? "miss" : "bypass",
      input_tokens: fallback ? 0 : input_tokens,
      output_tokens: fallback ? 0 : output_tokens,
      provider_cost_myr: cost,
    }),
  );
  if (key && !fallback) store(key, { response, cost_myr: cost });

  return Response.json(response, {
    headers: { "x-tokenguard-cache": eligibility.eligible ? "miss" : "bypass", ...policyHeaders },
  });
}
