// In-memory store. Fine locally; resets on restart and is NOT shared between
// Vercel instances. Simulated history is regenerated on start, so it always shows;
// live events and saved settings can be lost. Swap for durable storage later.
import { DEFAULT_SETTINGS, type Settings, type UsageEvent } from "./schema";
import { simulatedEvents } from "./seed";

type Store = { events: Map<string, UsageEvent>; settings: Map<string, Settings> };

function createStore(): Store {
  const s: Store = { events: new Map(), settings: new Map() };
  // SEED_SIMULATED=0 starts empty (e.g. to test real-only views).
  if (process.env.SEED_SIMULATED !== "0") {
    for (const e of simulatedEvents("demo-tenant", "lumi")) s.events.set(e.request_id, e);
  }
  return s;
}

// Keep state across Next dev hot reloads.
const g = globalThis as unknown as { __tokenguardStore?: Store };
const store: Store = (g.__tokenguardStore ??= createStore());

// Idempotent on request_id.
export function addEvent(event: UsageEvent): void {
  if (!store.events.has(event.request_id)) store.events.set(event.request_id, event);
}

export function listEvents(tenantId: string): UsageEvent[] {
  return [...store.events.values()].filter((e) => e.tenant_id === tenantId);
}

export function getSettings(tenantId: string): Settings {
  return store.settings.get(tenantId) ?? DEFAULT_SETTINGS;
}

export function saveSettings(tenantId: string, settings: Settings): void {
  store.settings.set(tenantId, settings);
}
