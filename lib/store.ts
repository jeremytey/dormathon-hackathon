// In-memory usage store. Fine locally; resets on restart and is NOT shared between
// Vercel instances. Swap for durable storage before the live demo.
import type { UsageEvent } from "./schema";

type Store = { events: Map<string, UsageEvent> };

// Keep state across Next dev hot reloads.
const g = globalThis as unknown as { __tokenguardStore?: Store };
const store: Store = (g.__tokenguardStore ??= { events: new Map() });

// Idempotent on request_id.
export function addEvent(event: UsageEvent): void {
  if (!store.events.has(event.request_id)) store.events.set(event.request_id, event);
}

export function listEvents(tenantId: string): UsageEvent[] {
  return [...store.events.values()].filter((e) => e.tenant_id === tenantId);
}
