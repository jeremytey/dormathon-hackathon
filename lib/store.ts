// In-memory store. Fine locally; resets on restart and is NOT shared between
// Vercel instances. Simulated history is regenerated on start, so it always shows;
// live events and saved settings can be lost. Swap for durable storage later.
import {
  DEFAULT_SETTINGS,
  type Alert,
  type PolicyChange,
  type RiskSnapshot,
  type Settings,
  type UsageEvent,
} from "./schema";
import { simulatedEvents } from "./seed";

type Store = {
  events: Map<string, UsageEvent>;
  settings: Map<string, Settings>;
  snapshots: Map<string, RiskSnapshot>;
  alerts: Map<string, { tenant_id: string; alert: Alert }>; // keyed by alert id
  policyLog: Map<string, PolicyChange[]>;
};

function createStore(): Store {
  const s: Store = {
    events: new Map(),
    settings: new Map(),
    snapshots: new Map(),
    alerts: new Map(),
    policyLog: new Map(),
  };
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

export function getSnapshot(tenantId: string): RiskSnapshot | undefined {
  return store.snapshots.get(tenantId);
}

export function saveSnapshot(tenantId: string, snapshot: RiskSnapshot): void {
  store.snapshots.set(tenantId, snapshot);
}

export function policyLog(tenantId: string): PolicyChange[] {
  let log = store.policyLog.get(tenantId);
  if (!log) store.policyLog.set(tenantId, (log = []));
  return log;
}

// Deduped on dedupe_key: an alert that already exists is not created again.
export function addAlert(tenantId: string, alert: Alert): void {
  for (const a of store.alerts.values()) {
    if (a.tenant_id === tenantId && a.alert.dedupe_key === alert.dedupe_key) return;
  }
  store.alerts.set(alert.id, { tenant_id: tenantId, alert });
}

export function listAlerts(tenantId: string): Alert[] {
  return [...store.alerts.values()]
    .filter((a) => a.tenant_id === tenantId)
    .map((a) => a.alert)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// Records that the alert was seen. Changes nothing else.
export function acknowledgeAlert(tenantId: string, id: string): Alert | null {
  const a = store.alerts.get(id);
  if (!a || a.tenant_id !== tenantId) return null;
  a.alert.acknowledged_at ??= new Date().toISOString();
  return a.alert;
}

// Demo reset: back to the freshly seeded state (default settings, no live events,
// alerts, snapshots or policy log). Simulated history is regenerated.
export function resetStore(): void {
  const fresh = createStore();
  store.events = fresh.events;
  store.settings = fresh.settings;
  store.snapshots = fresh.snapshots;
  store.alerts = fresh.alerts;
  store.policyLog = fresh.policyLog;
}
