// Safe exact response cache. Only single-turn, non-personal questions are cached,
// keyed by tenant + app + model + system prompt + messages + generation params.
import { createHash } from "crypto";
import type { TenantContext } from "./auth";
import type { AnthropicRequest, AnthropicResponse } from "./schema";

type Entry = { response: AnthropicResponse; cost_myr: number | null };

const g = globalThis as unknown as { __tokenguardCache?: Map<string, Entry> };
const cache: Map<string, Entry> = (g.__tokenguardCache ??= new Map());

// Questions about the asker's own data must never get a shared answer.
// Generic "how do I ..." FAQs stay cacheable.
const PERSONAL =
  /\b(my|mine|i have|i've|i'm|am i|do i have|balance|salary|payslip|tenure)\b/i;

function textOf(content: AnthropicRequest["messages"][number]["content"]): string {
  return typeof content === "string" ? content : content.map((b) => b.text).join("\n");
}

export type Eligibility = { eligible: true } | { eligible: false; reason: string };

export function cacheEligibility(req: AnthropicRequest, approved: boolean): Eligibility {
  if (!approved) return { eligible: false, reason: "exact cache not approved" };
  if (req.messages.length !== 1) return { eligible: false, reason: "multi-turn conversation" };
  if (PERSONAL.test(textOf(req.messages[0].content))) {
    return { eligible: false, reason: "personalised question" };
  }
  return { eligible: true };
}

export function cacheKey(req: AnthropicRequest, tenant: TenantContext): string {
  const canonical = JSON.stringify([
    tenant.tenant_id,
    tenant.app_id,
    req.model,
    req.system ?? null,
    req.messages.map((m) => [m.role, textOf(m.content)]),
    req.max_tokens,
    req.temperature ?? null,
    req.top_p ?? null,
    req.top_k ?? null,
    req.stop_sequences ?? null,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

export function lookup(key: string): Entry | undefined {
  return cache.get(key);
}

export function store(key: string, entry: Entry): void {
  cache.set(key, entry);
}
