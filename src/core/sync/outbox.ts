/**
 * Outbox — IndexedDB-backed pending-push queue for the sync engine.
 *
 * Local saves enqueue an entry here. The engine drains it by sending each
 * entry to `/api/sync/{kind}/[id]`; failures get exponential backoff and
 * stay in IndexedDB so they survive a reload.
 *
 * Why IndexedDB and not in-memory:
 *   - The user might close the tab between a save and a network round-trip.
 *   - Mobile browsers aggressively suspend tabs; in-memory state is lost.
 *   - We already have IDB in the codebase (cqrs eventStore, layouts, designs).
 *
 * Schema is intentionally minimal: one record per (kind, id) — newer
 * enqueues for the same item REPLACE the prior entry (we don't queue
 * intermediate states, we always push the latest local snapshot).
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { SyncKind } from './adapters/types';

export type { SyncKind };

const DB_NAME = 'gridfinity-sync-outbox-db';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';

/**
 * One pending push. The engine reads this, fetches the actual payload
 * via the adapter at push time (so we always send the latest local
 * snapshot, not a stale serialized copy), and PUTs to the server.
 */
export interface OutboxEntry {
  /** `${kind}:${id}` — primary key. Re-enqueuing the same item upserts. */
  key: string;
  kind: SyncKind;
  id: string;
  /**
   * Local mtime at enqueue time. Used as the `modifiedAt` we send to
   * the server. The server applies LWW against this value.
   */
  modifiedAt: number;
  /** `'put'` for create/update, `'delete'` for tombstone. */
  op: 'put' | 'delete';
  /** Number of failed pushes so far. 0 on first enqueue. */
  attempts: number;
  /** `Date.now() + backoffDelay` — drainer skips entries until this passes. */
  nextAttemptAt: number;
  /** When the entry was first added (for telemetry / debugging). */
  enqueuedAt: number;
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 5 * 60 * 1_000; // cap at 5 minutes
/**
 * Maximum push attempts before we give up on an entry. After this, the
 * caller should surface a permanent-failure toast and the user has to
 * re-edit (which re-enqueues with attempts=0).
 */
export const MAX_ATTEMPTS = 8;

let dbInstance: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(upgradeDb) {
      if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
        const store = upgradeDb.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('byNextAttempt', 'nextAttemptAt', { unique: false });
      }
    },
  });
  db.addEventListener('close', () => {
    if (dbInstance === db) dbInstance = null;
  });
  dbInstance = db;
  return dbInstance;
}

function entryKey(kind: SyncKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Compute the backoff delay for `attempts`. Exponential with cap:
 *   attempts=0 → 1s   (first retry)
 *   attempts=1 → 2s
 *   attempts=2 → 4s
 *   ...
 *   attempts=8+ → MAX_DELAY_MS
 */
export function backoffDelayMs(attempts: number): number {
  const raw = BASE_DELAY_MS * 2 ** Math.max(0, attempts);
  return Math.min(raw, MAX_DELAY_MS);
}

/**
 * Enqueue (or replace) a push for `(kind, id)`. The engine treats the
 * outbox as "what's the latest local snapshot we owe the server?", not
 * a history of every intermediate save — newer enqueues for the same
 * item supersede prior ones.
 *
 * Resets `attempts` to 0 and `nextAttemptAt` to now so the drainer
 * picks it up immediately (next user edit = retry signal too).
 */
export async function enqueue(input: {
  kind: SyncKind;
  id: string;
  modifiedAt: number;
  op: 'put' | 'delete';
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const entry: OutboxEntry = {
    key: entryKey(input.kind, input.id),
    kind: input.kind,
    id: input.id,
    modifiedAt: input.modifiedAt,
    op: input.op,
    attempts: 0,
    nextAttemptAt: now,
    enqueuedAt: now,
  };
  await db.put(STORE_NAME, entry);
}

/**
 * Read every outbox entry. Used by the engine's drainer and by the
 * pending-count selector for the status indicator.
 */
export async function getAll(): Promise<OutboxEntry[]> {
  const db = await getDb();
  return (await db.getAll(STORE_NAME)) as OutboxEntry[];
}

/**
 * Read entries whose `nextAttemptAt` has passed — i.e. entries the
 * drainer should attempt right now. Returned in oldest-first order
 * by `enqueuedAt` so retries don't starve fresh items.
 */
export async function getDue(now: number = Date.now()): Promise<OutboxEntry[]> {
  const all = await getAll();
  return all.filter((e) => e.nextAttemptAt <= now).sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}

/**
 * Mark a successful push. Removes the entry from the outbox. If a
 * newer enqueue arrived between our read and now (e.g. user edited
 * again while we were pushing), the second enqueue's `key` is the
 * same and our delete here would erase it — so callers MUST pass the
 * `modifiedAt` they pushed, and we only delete if the stored entry
 * still matches that mtime. Otherwise the newer enqueue stays.
 */
export async function markSuccess(
  kind: SyncKind,
  id: string,
  pushedModifiedAt: number
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const current = (await store.get(entryKey(kind, id))) as OutboxEntry | undefined;
  if (current && current.modifiedAt === pushedModifiedAt) {
    await store.delete(entryKey(kind, id));
  }
  await tx.done;
}

/**
 * Mark a failed push. Increments `attempts` and reschedules with
 * exponential backoff. If `attempts` reaches `MAX_ATTEMPTS`, the
 * entry is removed and the function returns `'gave-up'` so the
 * caller can surface a permanent-failure toast.
 */
export async function markFailure(kind: SyncKind, id: string): Promise<'rescheduled' | 'gave-up'> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const current = (await store.get(entryKey(kind, id))) as OutboxEntry | undefined;
  if (!current) {
    await tx.done;
    return 'rescheduled';
  }
  const nextAttempts = current.attempts + 1;
  if (nextAttempts >= MAX_ATTEMPTS) {
    await store.delete(current.key);
    await tx.done;
    return 'gave-up';
  }
  // Use the pre-increment value as the backoff index. With attempts=0
  // (no failures yet) the first failure schedules `backoffDelayMs(0) = 1s`,
  // matching the documented sequence (1s, 2s, 4s, ...).
  await store.put({
    ...current,
    attempts: nextAttempts,
    nextAttemptAt: Date.now() + backoffDelayMs(current.attempts),
  });
  await tx.done;
  return 'rescheduled';
}

/**
 * Remove an entry without success/failure semantics. Used when the
 * engine determines an entry is no longer applicable (e.g. user
 * signed out before we drained it).
 */
export async function discard(kind: SyncKind, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, entryKey(kind, id));
}

/**
 * Drop everything. Used on sign-out (PR 5) to prevent stale items
 * leaking into the next signed-in user's outbox if they sign in on
 * the same device.
 */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
}

/**
 * Test-only: forget the cached DB connection so the next call opens
 * fresh. Vitest's IndexedDB cleanup between tests is per-DB-name; we
 * still need to drop our cached `dbInstance`.
 */
export function __resetForTests(): void {
  dbInstance?.close();
  dbInstance = null;
}
