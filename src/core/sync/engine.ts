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
import type {
  AdapterChange,
  PushPlan,
  SyncAdapter,
  SyncAdapters,
  SyncKind,
} from './adapters/types';
import { MISSING_DEPENDENCY_STATUS, PAYLOAD_KEY, syncPutBody } from './payloadKey';

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
  /** When `drainTimer` fires, in ms since epoch; meaningless while it is null. */
  drainDueAt: number;
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
    drainDueAt: 0,
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
  if (state !== null) {
    state.stopping = true;
    for (const off of state.unsubscribers) off();
    if (state.drainTimer !== null) clearTimeout(state.drainTimer);
    state.listeners.clear();
    state = null;
  }
  // Also with no engine: the sign-in claim marks the status syncing before the
  // engine starts, and a cancelled claim leaves it for this teardown to clear.
  useSyncStatusStore.getState().reset();
}

export function onEngineEvent(listener: EngineEventListener): () => void {
  if (state === null) return () => {};
  state.listeners.add(listener);
  return () => state?.listeners.delete(listener);
}

/**
 * Force a drain pass. Resolves when it completes and never rejects: a drain
 * rejection (typically a network `TypeError: Failed to fetch`) is routed into
 * the status store the same way `scheduleDrain` does, not propagated. The
 * debounced-push and visibility-flush triggers call `void flushNow()`, so a
 * propagated rejection would otherwise escape as an unhandled promise rejection.
 */
export async function flushNow(): Promise<void> {
  if (state === null) return;
  try {
    await drain(state);
  } catch (error: unknown) {
    // Same label as scheduleDrain: to the user this is the same drain failure,
    // and lastError surfaces the label as a prefix.
    reportUncaught('drain', error);
  }
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

// One timer serves every entry, so it keeps the earliest deadline asked of it:
// a long throttle must not hold back an entry due sooner. Waking early costs a
// drain that finds nothing due and sleeps until the soonest entry.
function scheduleDrain(s: EngineState, delayMs: number): void {
  if (s.stopping) return;
  const wait = Math.max(0, delayMs);
  const dueAt = Date.now() + wait;
  if (s.drainTimer !== null) {
    if (s.drainDueAt <= dueAt) return;
    clearTimeout(s.drainTimer);
  }
  s.drainDueAt = dueAt;
  s.drainTimer = setTimeout(() => {
    s.drainTimer = null;
    drain(s).catch((error: unknown) => reportUncaught('drain', error));
  }, wait);
}

async function rehydrate(s: EngineState): Promise<void> {
  await syncStatusFromOutbox();
  scheduleDrain(s, 0);
}

async function drain(s: EngineState): Promise<void> {
  if (s.stopping) return;
  const due = await outboxGetDue();
  if (due.length > 0) {
    useSyncStatusStore.getState().beginSync();
    await Promise.all(due.map((entry) => pushOne(s, entry)));
  }
  await syncStatusFromOutbox();
  await wakeForNextDue(s);
}

// A backoff can put an entry further out than the drain its failure asked for,
// so a drain that leaves entries waiting sleeps until the soonest rather than
// leaving them to the next edit, or to a pending timer set for a later one.
async function wakeForNextDue(s: EngineState): Promise<void> {
  if (s.stopping) return;
  const waiting = await outboxGetAll();
  if (waiting.length === 0) return;
  scheduleDrain(s, Math.min(...waiting.map((entry) => entry.nextAttemptAt)) - Date.now());
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
    // A reply landing after the stop belongs to no running session.
    if (stopped(s)) return;
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
  // Planning can outlast the session (an inline fallback reads every mesh
  // file, and teardown fails an upload under way). Once stopped, neither its
  // push nor its failure belongs to the next account.
  const plan = await planPush(adapter, entry.id).catch((error: unknown) => {
    if (stopped(s)) return null;
    throw error;
  });
  if (stopped(s) || plan === null) return;
  if (plan.status === 'skip') {
    await outboxMarkSuccess(entry.kind, entry.id, entry.modifiedAt);
    return;
  }
  if (plan.status === 'defer') {
    await backOff(kind, entry, s, plan.reason);
    return;
  }
  if (plan.status === 'throttle') {
    await waitOutThrottle(entry, s, plan.retryAfterMs);
    return;
  }
  const latest = plan.item;

  const body = syncPutBody(kind, latest.payload, latest.modifiedAt);

  const res = await apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (stopped(s)) return;

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
  if (res.status === MISSING_DEPENDENCY_STATUS) adapter.onMissing?.(await readMissing(res));
  await handleFailure(res, kind, entry, s);
}

/** Read through a call: an await can flip it, which narrowing cannot see. */
function stopped(s: EngineState): boolean {
  return s.stopping;
}

async function planPush(adapter: SyncAdapter, id: string): Promise<PushPlan<unknown>> {
  if (adapter.preparePush) return adapter.preparePush(id);
  const item = await adapter.get(id);
  return item ? { status: 'send', item } : { status: 'skip' };
}

async function readMissing(res: Response): Promise<string[]> {
  try {
    const { missing } = (await res.json()) as { missing?: unknown };
    return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : [];
  } catch {
    return [];
  }
}

async function handleConflict(
  adapter: SyncAdapter,
  kind: SyncKind,
  entry: OutboxEntry,
  res: Response,
  s: EngineState
): Promise<void> {
  let stored: (Record<string, unknown> & { modifiedAt?: number }) | null;
  try {
    const body = (await res.json()) as {
      stored?: Record<string, unknown> & { modifiedAt?: number };
    };
    stored = body.stored ?? null;
  } catch {
    stored = null;
  }
  if (stored && typeof stored.modifiedAt === 'number') {
    const payload = stored[PAYLOAD_KEY[kind]];
    if (payload !== undefined) {
      await adapter.applyRemote({
        id: entry.id,
        payload,
        modifiedAt: stored.modifiedAt,
        ...(typeof stored.schemaVersion === 'number'
          ? { schemaVersion: stored.schemaVersion }
          : {}),
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
    await waitOutThrottle(entry, s, parseRetryAfter(res.headers.get('Retry-After')));
    return;
  }
  // Any non-429 outcome for this item resets the rate-limit counter so
  // an unrelated transient failure doesn't carry yesterday's exponent.
  s.rateLimitedRetries.delete(`${entry.kind}:${entry.id}`);
  // 401 is handled by apiFetch (forced sign-out). Other 4xx gives up, except a
  // missing dependency, which the adapter puts on the server before the retry.
  // 5xx / network retries with backoff.
  const isClientError =
    res.status >= 400 &&
    res.status < 500 &&
    res.status !== 401 &&
    res.status !== MISSING_DEPENDENCY_STATUS;
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
  await backOff(kind, entry, s, `HTTP ${res.status}`);
}

async function waitOutThrottle(
  entry: OutboxEntry,
  s: EngineState,
  retryAfter: number | null
): Promise<void> {
  const key = `${entry.kind}:${entry.id}`;
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
}

async function backOff(
  kind: SyncKind,
  entry: OutboxEntry,
  s: EngineState,
  reason: string
): Promise<void> {
  const result = await outboxMarkFailure(entry.kind, entry.id);
  if (result === 'gave-up') {
    emitEngineEvent(s, {
      type: 'sync-error',
      reason: 'gave-up',
      kind,
      id: entry.id,
      message: reason,
    });
    useSyncStatusStore.getState().reportError(`Push failed: ${reason}`);
    return;
  }
  useSyncStatusStore.getState().reportOffline(reason);
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
