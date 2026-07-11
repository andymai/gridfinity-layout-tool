import { apiFetch } from './apiFetch';
import {
  enqueue as outboxEnqueue,
  getDue as outboxGetDue,
  getAll as outboxGetAll,
  markFailure as outboxMarkFailure,
  markSuccess as outboxMarkSuccess,
  rescheduleWithoutAttempt as outboxRescheduleWithoutAttempt,
  type OutboxEntry,
} from './outbox';
import { parseRetryAfter, rateLimitedBackoffMs } from './retryAfter';
import { useSyncStatusStore } from './status';
import type { AdapterChange, SyncAdapter, SyncAdapters, SyncKind } from './adapters/types';

type ConflictReason = 'remote-newer' | 'deleted-elsewhere' | 'quota' | 'gave-up';

export type EngineEvent =
  | { type: 'sync-error'; reason: ConflictReason; kind: SyncKind; id: string; message?: string }
  | { type: 'remote-replaced-local'; kind: SyncKind; id: string };

export type EngineEventListener = (event: EngineEvent) => void;

interface EngineState {
  adapters: SyncAdapters;
  unsubscribers: Array<() => void>;
  /** Per-(kind, id) in-flight push promise — serializes writes for the same item. */
  inFlight: Map<string, Promise<void>>;
  /** External listeners (toast surface installs one). */
  listeners: Set<EngineEventListener>;
  drainTimer: ReturnType<typeof setTimeout> | null;
  /** Set to true while `stop()` is tearing down — drainer skips its tail. */
  stopping: boolean;
  /**
   * Per-(kind, id) count of consecutive 429s without a server-provided
   * Retry-After. Drives `rateLimitedBackoffMs`'s exponent. Distinct from
   * `OutboxEntry.attempts` — that field is intentionally not bumped for
   * rate-limit responses so they don't burn the gave-up budget. Cleared
   * on any non-429 outcome for the same item.
   */
  rateLimitedRetries: Map<string, number>;
}

let state: EngineState | null = null;

/** Idempotent. Boot site (PR 4d) calls this on sign-in, `stop()` on sign-out. */
export function start(adapters: SyncAdapters): void {
  if (state !== null) return;
  const s: EngineState = {
    adapters,
    unsubscribers: [],
    inFlight: new Map(),
    listeners: new Set(),
    drainTimer: null,
    stopping: false,
    rateLimitedRetries: new Map(),
  };
  state = s;

  for (const kind of Object.keys(adapters) as SyncKind[]) {
    const adapter = adapters[kind];
    s.unsubscribers.push(
      adapter.subscribe((change) => {
        onLocalChange(s, kind, change).catch((error: unknown) =>
          reportUncaught('onLocalChange', error)
        );
      })
    );
  }

  rehydrate(s).catch((error: unknown) => reportUncaught('rehydrate', error));
}

export function stop(): void {
  if (state === null) return;
  state.stopping = true;
  for (const off of state.unsubscribers) off();
  if (state.drainTimer !== null) clearTimeout(state.drainTimer);
  state.listeners.clear();
  state = null;
  useSyncStatusStore.getState().reset();
}

export function onEngineEvent(listener: EngineEventListener): () => void {
  if (state === null) return () => {};
  state.listeners.add(listener);
  return () => state?.listeners.delete(listener);
}

/** Force a drain pass; returns when the in-flight pass completes. */
export async function flushNow(): Promise<void> {
  if (state === null) return;
  await drain(state);
}

export async function getPendingEntries(): Promise<OutboxEntry[]> {
  return outboxGetAll();
}

async function onLocalChange(s: EngineState, kind: SyncKind, change: AdapterChange): Promise<void> {
  if (s.stopping) return;
  await outboxEnqueue({
    kind,
    id: change.id,
    modifiedAt: change.modifiedAt,
    op: change.kind,
  });
  await syncStatusFromOutbox();
  scheduleDrain(s, 0);
}

function scheduleDrain(s: EngineState, delayMs: number): void {
  if (s.drainTimer !== null) clearTimeout(s.drainTimer);
  s.drainTimer = setTimeout(
    () => {
      s.drainTimer = null;
      drain(s).catch((error: unknown) => reportUncaught('drain', error));
    },
    Math.max(0, delayMs)
  );
}

async function rehydrate(s: EngineState): Promise<void> {
  await syncStatusFromOutbox();
  scheduleDrain(s, 0);
}

async function drain(s: EngineState): Promise<void> {
  if (s.stopping) return;
  const due = await outboxGetDue();
  if (due.length === 0) {
    await syncStatusFromOutbox();
    return;
  }
  useSyncStatusStore.getState().beginSync();
  await Promise.all(due.map((entry) => pushOne(s, entry)));
  await syncStatusFromOutbox();
}

async function pushOne(s: EngineState, entry: OutboxEntry): Promise<void> {
  const key = `${entry.kind}:${entry.id}`;
  const existing = s.inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const kind: SyncKind = entry.kind;
    const adapter = s.adapters[kind];
    try {
      await sendOne(adapter, kind, entry, s);
    } finally {
      s.inFlight.delete(key);
    }
  })();
  s.inFlight.set(key, promise);
  await promise;
}

async function sendOne(
  adapter: SyncAdapter,
  kind: SyncKind,
  entry: OutboxEntry,
  s: EngineState
): Promise<void> {
  const url = `/api/sync/${kind}/${entry.id}`;

  if (entry.op === 'delete') {
    const res = await apiFetch(url, { method: 'DELETE' });
    if (res.ok || res.status === 404 || res.status === 410) {
      s.rateLimitedRetries.delete(`${entry.kind}:${entry.id}`);
      await markPushSucceeded(entry.kind, entry.id, entry.modifiedAt);
      return;
    }
    await handleFailure(res, kind, entry, s);
    return;
  }

  // Read the latest snapshot at push time so a fresh edit during the
  // enqueue→push window goes out instead of a stale copy.
  const latest = await adapter.get(entry.id);
  if (!latest) {
    await outboxMarkSuccess(entry.kind, entry.id, entry.modifiedAt);
    return;
  }

  const body =
    kind === 'layouts'
      ? { layout: latest.payload, modifiedAt: latest.modifiedAt }
      : kind === 'baseplates'
        ? { baseplate: latest.payload, modifiedAt: latest.modifiedAt }
        : { design: latest.payload, modifiedAt: latest.modifiedAt };

  const res = await apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    s.rateLimitedRetries.delete(`${entry.kind}:${entry.id}`);
    await markPushSucceeded(entry.kind, entry.id, latest.modifiedAt);
    return;
  }
  if (res.status === 409) {
    await handleConflict(adapter, kind, entry, res, s);
    return;
  }
  if (res.status === 410) {
    // Tombstone: the server says this item was deleted on another device
    // *after* our edit. Surface a toast and drop the outbox entry —
    // the user has to re-edit (which re-enqueues) to resurrect.
    emitEngineEvent(s, {
      type: 'sync-error',
      reason: 'deleted-elsewhere',
      kind,
      id: entry.id,
    });
    await outboxMarkSuccess(entry.kind, entry.id, latest.modifiedAt);
    return;
  }
  if (res.status === 413) {
    emitEngineEvent(s, {
      type: 'sync-error',
      reason: 'quota',
      kind,
      id: entry.id,
      message: await safeReadError(res),
    });
    await outboxMarkSuccess(entry.kind, entry.id, latest.modifiedAt);
    useSyncStatusStore.getState().reportError('Quota exceeded');
    return;
  }
  await handleFailure(res, kind, entry, s);
}

async function handleConflict(
  adapter: SyncAdapter,
  kind: SyncKind,
  entry: OutboxEntry,
  res: Response,
  s: EngineState
): Promise<void> {
  let stored: {
    layout?: unknown;
    design?: unknown;
    baseplate?: unknown;
    modifiedAt?: number;
  } | null;
  try {
    const body = (await res.json()) as {
      stored?: { layout?: unknown; design?: unknown; baseplate?: unknown; modifiedAt?: number };
    };
    stored = body.stored ?? null;
  } catch {
    stored = null;
  }
  if (stored && typeof stored.modifiedAt === 'number') {
    const payload =
      kind === 'layouts' ? stored.layout : kind === 'baseplates' ? stored.baseplate : stored.design;
    if (payload !== undefined) {
      await adapter.applyRemote({
        id: entry.id,
        payload,
        modifiedAt: stored.modifiedAt,
      });
      emitEngineEvent(s, { type: 'remote-replaced-local', kind, id: entry.id });
    }
  }
  await outboxMarkSuccess(entry.kind, entry.id, entry.modifiedAt);
}

async function handleFailure(
  res: Response,
  kind: SyncKind,
  entry: OutboxEntry,
  s: EngineState
): Promise<void> {
  // 429: don't burn the attempts budget on server throttling. `attempts`
  // stays at 0 so MAX_ATTEMPTS doesn't trip — but we still need an
  // escalating delay across consecutive 429s, so track that in a separate
  // per-(kind, id) counter on the engine state. `Retry-After` overrides
  // the counter entirely (server knows best).
  if (res.status === 429) {
    const key = `${entry.kind}:${entry.id}`;
    const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
    // `Retry-After: 0` would otherwise pass through `??` and re-fire immediately.
    let delayMs: number;
    if (retryAfter !== null && retryAfter > 0) {
      delayMs = retryAfter;
    } else {
      const prior = s.rateLimitedRetries.get(key) ?? 0;
      delayMs = rateLimitedBackoffMs(prior);
      s.rateLimitedRetries.set(key, prior + 1);
    }
    await outboxRescheduleWithoutAttempt(entry.kind, entry.id, delayMs);
    useSyncStatusStore.getState().reportOffline('Rate limited');
    scheduleDrain(s, delayMs);
    return;
  }
  // Any non-429 outcome for this item resets the rate-limit counter so
  // an unrelated transient failure doesn't carry yesterday's exponent.
  s.rateLimitedRetries.delete(`${entry.kind}:${entry.id}`);
  // 401 is handled by apiFetch (forced sign-out). Other 4xx gives up.
  // 5xx / network retries with backoff.
  const isClientError = res.status >= 400 && res.status < 500 && res.status !== 401;
  if (isClientError) {
    emitEngineEvent(s, {
      type: 'sync-error',
      reason: 'gave-up',
      kind,
      id: entry.id,
      message: await safeReadError(res),
    });
    await outboxMarkSuccess(entry.kind, entry.id, entry.modifiedAt);
    return;
  }
  const result = await outboxMarkFailure(entry.kind, entry.id);
  if (result === 'gave-up') {
    emitEngineEvent(s, {
      type: 'sync-error',
      reason: 'gave-up',
      kind,
      id: entry.id,
      message: `HTTP ${res.status}`,
    });
    useSyncStatusStore.getState().reportError(`Push failed: HTTP ${res.status}`);
    return;
  }
  useSyncStatusStore.getState().reportOffline(`HTTP ${res.status}`);
  scheduleDrain(s, 1_000);
}

/**
 * Refresh `pendingCount` BEFORE calling `succeed()` — the status store's
 * idle/syncing transition reads pendingCount, and without this it would
 * see a stale count and stick on 'syncing' after the last item drains.
 */
async function markPushSucceeded(kind: SyncKind, id: string, modifiedAt: number): Promise<void> {
  await outboxMarkSuccess(kind, id, modifiedAt);
  await syncStatusFromOutbox();
  useSyncStatusStore.getState().succeed();
}

async function safeReadError(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error;
  } catch {
    return undefined;
  }
}

// Route fire-and-forget rejections into the status store so the UI
// surfaces them instead of letting them escape as window.unhandledrejection.
function reportUncaught(label: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  useSyncStatusStore.getState().reportError(`${label}: ${message}`);
}

function emitEngineEvent(s: EngineState, event: EngineEvent): void {
  for (const listener of s.listeners) {
    try {
      listener(event);
    } catch {
      /* listener errors must not break the engine */
    }
  }
}

async function syncStatusFromOutbox(): Promise<void> {
  const all = await outboxGetAll();
  useSyncStatusStore.getState().setPendingCount(all.length);
}

// Test-only: peek at internal state.
export function __getEngineStateForTests(): EngineState | null {
  return state;
}
