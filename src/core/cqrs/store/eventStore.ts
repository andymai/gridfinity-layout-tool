/**
 * Event Store — Append-only IndexedDB persistence for domain events.
 *
 * Separate database from the main layout DB to isolate lifecycles.
 * Events are persisted asynchronously (fire-and-forget) — persistence
 * failures are logged but never block the command pipeline.
 */

import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { LayoutId } from '@/core/types';
import type { DomainEvent } from '../events';
import type { CorrelationId } from '../types';
import { eventBus } from '../bus/eventBus';
import { migrateEvent } from '../versioning';
import { enqueueForRetry, setRetryEventStore } from './retryQueue';
import { createLogger } from '@/core/logger';

const DB_NAME = 'gridfinity-events-db';
const DB_VERSION = 1;
const EVENTS_STORE = 'events';
const MAX_EVENTS_PER_AGGREGATE = 10_000;

// Database instance cache
let dbInstance: IDBPDatabase | null = null;
// In-flight open, shared so concurrent callers don't open duplicate connections
let openPromise: Promise<IDBPDatabase> | null = null;

async function openEventDb(): Promise<IDBPDatabase> {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const store = db.createObjectStore(EVENTS_STORE, { keyPath: 'meta.id' });
        store.createIndex('byAggregate', 'meta.aggregateId', { unique: false });
        store.createIndex('byTimestamp', 'meta.timestamp', { unique: false });
        store.createIndex('byCorrelation', 'meta.correlationId', { unique: false });
      }
    },
  });

  // Clear cached instance if the browser closes the connection unexpectedly
  // (tab eviction, version change from another tab, profile teardown).
  db.addEventListener('close', () => {
    if (dbInstance === db) {
      dbInstance = null;
    }
  });

  return db;
}

async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  // Dedupe concurrent opens — every user action triggers a fire-and-forget
  // append, so without this a burst of actions can open several connections.
  openPromise ??= openEventDb()
    .then((db) => {
      dbInstance = db;
      return db;
    })
    .finally(() => {
      openPromise = null;
    });

  return openPromise;
}

/**
 * True when an error means the connection/transaction we used is gone and a
 * fresh open will recover. Older WebKit/Safari auto-commit a transaction
 * between microtasks, and mobile background-tab eviction or a cross-tab version
 * change can tear the connection down while `dbInstance` still caches it — so
 * the transaction created on it has no in-progress transaction by the time the
 * request runs ("Attempt to get a record from database without an in-progress
 * transaction").
 */
function isConnectionLifetimeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'InvalidStateError' || error.name === 'TransactionInactiveError') {
    return true;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('in-progress transaction') ||
    message.includes('connection is closing') ||
    message.includes('transaction is not active') ||
    message.includes('transaction has finished')
  );
}

/**
 * Run a DB operation, retrying once with a freshly opened connection if the
 * cached one was closing. The operation MUST create its own transaction so the
 * retry gets a brand-new transaction rather than reusing a finished one.
 *
 * Every store method routes through here, so a stale cached connection
 * self-heals instead of silently throwing and dropping a CQRS event.
 */
async function withFreshDb<T>(operation: (db: IDBPDatabase) => Promise<T>): Promise<T> {
  const db = await getDb();
  try {
    return await operation(db);
  } catch (error: unknown) {
    if (!isConnectionLifetimeError(error)) throw error;

    // Drop the stale connection and re-open before the single retry.
    if (dbInstance === db) dbInstance = null;
    try {
      db.close();
    } catch {
      // Connection was already closing — nothing to do.
    }
    const fresh = await getDb();
    return operation(fresh);
  }
}

export interface EventStoreQuery {
  after?: number;
  before?: number;
  limit?: number;
}

export interface EventStore {
  /** Append events to the store */
  append(events: ReadonlyArray<DomainEvent>): Promise<void>;

  /** Get events for a specific layout aggregate */
  getByAggregate(aggregateId: LayoutId, query?: EventStoreQuery): Promise<DomainEvent[]>;

  /** Get events within a time range */
  getByTimeRange(start: number, end: number): Promise<DomainEvent[]>;

  /** Get all events for a correlation (single command execution) */
  getByCorrelation(correlationId: CorrelationId): Promise<DomainEvent[]>;

  /** Count events, optionally filtered by aggregate */
  count(aggregateId?: LayoutId): Promise<number>;

  /** Evict oldest events for an aggregate, keeping the most recent `keepCount` */
  evict(aggregateId: LayoutId, keepCount?: number): Promise<number>;

  /** Clear all events (for testing) */
  clear(): Promise<void>;
}

/**
 * Return true when two events with the same id represent the same fact.
 * Compares type, aggregateId, version, and payload shape — enough to tell
 * an idempotent retry (byte-identical) from a true id collision (same id,
 * different content) without a full deep-equal.
 */
function eventsMatch(a: DomainEvent, b: DomainEvent): boolean {
  if (a.type !== b.type) return false;
  if (a.meta.aggregateId !== b.meta.aggregateId) return false;
  if (a.meta.version !== b.meta.version) return false;
  return JSON.stringify(a.payload) === JSON.stringify(b.payload);
}

function createEventStore(): EventStore {
  return {
    async append(events) {
      if (events.length === 0) return;

      await withFreshDb(async (db) => {
        const tx = db.transaction(EVENTS_STORE, 'readwrite');
        const store = tx.store;

        // Idempotent append-only semantics: if an event with the same id is
        // already persisted (retry-queue replaying after a connection drop
        // that ACKed on disk but rejected the promise), treat it as a no-op
        // instead of failing. But if the persisted event is actually
        // DIFFERENT — a real id collision — surface the problem loudly
        // rather than silently dropping one of the two events. `put` would
        // silently overwrite; plain `add` would mis-classify idempotent
        // retries as failures. Read-then-compare threads that needle.
        //
        // CRITICAL: issue every read up front in one Promise.all instead of
        // awaiting get()/add() per event across loop iterations. Interleaving
        // awaited IDB requests lets WebKit auto-commit the transaction between
        // microtasks, so the next iteration's get() throws "no in-progress
        // transaction". Keeping requests continuously pending holds the tx open.
        const existing = (await Promise.all(events.map((event) => store.get(event.meta.id)))) as (
          | DomainEvent
          | undefined
        )[];

        const writes: Promise<unknown>[] = [];
        const queuedIds = new Set<string>();
        events.forEach((event, i) => {
          const persisted = existing[i];
          if (persisted) {
            if (!eventsMatch(persisted, event)) {
              log.warn(
                'Event id collision: incoming event differs from persisted event with the same id',
                {
                  eventId: event.meta.id,
                  persistedType: persisted.type,
                  incomingType: event.type,
                }
              );
            }
            return;
          }
          // Guard against duplicate ids within a single batch — the up-front
          // reads all saw the pre-batch state, so a second add() of the same id
          // would throw a ConstraintError.
          if (queuedIds.has(event.meta.id)) return;
          queuedIds.add(event.meta.id);
          writes.push(store.add(event));
        });

        await Promise.all(writes);
        await tx.done;
      });
    },

    async getByAggregate(aggregateId, query = {}) {
      const allEvents = await withFreshDb(async (db) => {
        const tx = db.transaction(EVENTS_STORE, 'readonly');
        return (await tx.store.index('byAggregate').getAll(aggregateId)) as DomainEvent[];
      });

      let filtered = allEvents;
      const { after, before } = query;
      if (after !== undefined) {
        filtered = filtered.filter((e) => e.meta.timestamp > after);
      }
      if (before !== undefined) {
        filtered = filtered.filter((e) => e.meta.timestamp < before);
      }

      // Sort by version ascending
      filtered.sort((a, b) => a.meta.version - b.meta.version);

      if (query.limit !== undefined) {
        filtered = filtered.slice(0, query.limit);
      }

      return filtered.map(migrateEvent);
    },

    async getByTimeRange(start, end) {
      const range = IDBKeyRange.bound(start, end);
      const events = await withFreshDb(async (db) => {
        const tx = db.transaction(EVENTS_STORE, 'readonly');
        return (await tx.store.index('byTimestamp').getAll(range)) as DomainEvent[];
      });
      return events.map(migrateEvent);
    },

    async getByCorrelation(correlationId) {
      const events = await withFreshDb(async (db) => {
        const tx = db.transaction(EVENTS_STORE, 'readonly');
        return (await tx.store.index('byCorrelation').getAll(correlationId)) as DomainEvent[];
      });
      return events.map(migrateEvent);
    },

    async count(aggregateId) {
      return withFreshDb(async (db) => {
        const tx = db.transaction(EVENTS_STORE, 'readonly');
        if (aggregateId) {
          return tx.store.index('byAggregate').count(aggregateId);
        }
        return tx.store.count();
      });
    },

    async evict(aggregateId, keepCount = MAX_EVENTS_PER_AGGREGATE) {
      return withFreshDb(async (db) => {
        const readTx = db.transaction(EVENTS_STORE, 'readonly');
        const allEvents = (await readTx.store
          .index('byAggregate')
          .getAll(aggregateId)) as DomainEvent[];

        if (allEvents.length <= keepCount) return 0;

        // Sort by version ascending, evict oldest
        allEvents.sort((a, b) => a.meta.version - b.meta.version);
        const toEvict = allEvents.slice(0, allEvents.length - keepCount);

        // Batch the deletes in one Promise.all so the transaction stays alive —
        // awaiting delete() per event across the loop risks the same auto-commit
        // hazard as append().
        const tx = db.transaction(EVENTS_STORE, 'readwrite');
        await Promise.all(toEvict.map((event) => tx.store.delete(event.meta.id)));
        await tx.done;

        return toEvict.length;
      });
    },

    async clear() {
      await withFreshDb((db) => db.clear(EVENTS_STORE));
    },
  };
}

/** Singleton event store */
export const eventStore = createEventStore();

const log = createLogger('EventStore');

/**
 * Subscribe the event store to the event bus for automatic persistence.
 * Call once at app startup when CQRS is enabled.
 *
 * Failed appends are sent to the retry queue for exponential-backoff
 * retry (up to 3 attempts). The command pipeline is never blocked.
 */
export function connectEventStoreToBus(): () => void {
  setRetryEventStore(eventStore);

  return eventBus.subscribeAll((event) => {
    void (async () => {
      try {
        await eventStore.append([event]);
      } catch (appendError: unknown) {
        log.warn('Failed to persist event, enqueuing for retry', {
          eventType: event.type,
          eventId: event.meta.id,
          error: appendError instanceof Error ? appendError.message : String(appendError),
        });
        enqueueForRetry(event, appendError);
        return; // Skip eviction if append failed
      }

      // Eviction errors are non-critical — log but don't retry the event
      try {
        const count = await eventStore.count(event.meta.aggregateId);
        if (count > MAX_EVENTS_PER_AGGREGATE) {
          await eventStore.evict(event.meta.aggregateId);
        }
      } catch (evictionError: unknown) {
        log.warn('Event eviction check failed (non-critical)', {
          aggregateId: event.meta.aggregateId,
          error: evictionError instanceof Error ? evictionError.message : String(evictionError),
        });
      }
    })();
  });
}
