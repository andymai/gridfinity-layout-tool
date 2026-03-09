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

const DB_NAME = 'gridfinity-events-db';
const DB_VERSION = 1;
const EVENTS_STORE = 'events';
const MAX_EVENTS_PER_AGGREGATE = 10_000;

// Database instance cache
let dbInstance: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const store = db.createObjectStore(EVENTS_STORE, { keyPath: 'meta.id' });
        store.createIndex('byAggregate', 'meta.aggregateId', { unique: false });
        store.createIndex('byTimestamp', 'meta.timestamp', { unique: false });
        store.createIndex('byCorrelation', 'meta.correlationId', { unique: false });
      }
    },
  });

  return dbInstance;
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

function createEventStore(): EventStore {
  return {
    async append(events) {
      const db = await getDb();
      const tx = db.transaction(EVENTS_STORE, 'readwrite');
      for (const event of events) {
        await tx.store.add(event);
      }
      await tx.done;
    },

    async getByAggregate(aggregateId, query = {}) {
      const db = await getDb();
      const index = db.transaction(EVENTS_STORE, 'readonly').store.index('byAggregate');
      const allEvents = await index.getAll(aggregateId);

      let filtered = allEvents as DomainEvent[];
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

      return filtered;
    },

    async getByTimeRange(start, end) {
      const db = await getDb();
      const index = db.transaction(EVENTS_STORE, 'readonly').store.index('byTimestamp');
      const range = IDBKeyRange.bound(start, end);
      return (await index.getAll(range)) as DomainEvent[];
    },

    async getByCorrelation(correlationId) {
      const db = await getDb();
      const index = db.transaction(EVENTS_STORE, 'readonly').store.index('byCorrelation');
      return (await index.getAll(correlationId)) as DomainEvent[];
    },

    async count(aggregateId) {
      const db = await getDb();
      if (aggregateId) {
        const index = db.transaction(EVENTS_STORE, 'readonly').store.index('byAggregate');
        return index.count(aggregateId);
      }
      return db.transaction(EVENTS_STORE, 'readonly').store.count();
    },

    async evict(aggregateId, keepCount = MAX_EVENTS_PER_AGGREGATE) {
      const db = await getDb();
      const index = db.transaction(EVENTS_STORE, 'readonly').store.index('byAggregate');
      const allEvents = (await index.getAll(aggregateId)) as DomainEvent[];

      if (allEvents.length <= keepCount) return 0;

      // Sort by version ascending, evict oldest
      allEvents.sort((a, b) => a.meta.version - b.meta.version);
      const toEvict = allEvents.slice(0, allEvents.length - keepCount);

      const tx = db.transaction(EVENTS_STORE, 'readwrite');
      for (const event of toEvict) {
        await tx.store.delete(event.meta.id);
      }
      await tx.done;

      return toEvict.length;
    },

    async clear() {
      const db = await getDb();
      await db.clear(EVENTS_STORE);
    },
  };
}

/** Singleton event store */
export const eventStore = createEventStore();

/**
 * Subscribe the event store to the event bus for automatic persistence.
 * Call once at app startup when CQRS is enabled.
 */
export function connectEventStoreToBus(): () => void {
  return eventBus.subscribeAll((event) => {
    void (async () => {
      await eventStore.append([event]);
      const count = await eventStore.count(event.meta.aggregateId);
      if (count > MAX_EVENTS_PER_AGGREGATE) {
        await eventStore.evict(event.meta.aggregateId);
      }
    })().catch((error: unknown) => {
      // eslint-disable-next-line no-console -- Critical infrastructure error logging
      console.debug('[EventStore] Failed to persist event:', error);
    });
  });
}

/** Reset the cached DB instance (for testing) */
export function resetEventStoreDb(): void {
  dbInstance = null;
}
