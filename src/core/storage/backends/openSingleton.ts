/**
 * One open-and-cache singleton behind every IndexedDB database in the app.
 *
 * An accessor opens its database on first use and hands the same connection to
 * every later caller. Three properties the hand-rolled copies of this had in
 * different combinations, and that every caller now gets:
 *
 * - Concurrent `get()` calls share one in-flight open, so a burst of
 *   fire-and-forget writes cannot open several connections to the same name.
 * - A browser-initiated `close` (mobile tab eviction, a version change from
 *   another tab) drops the cached handle, so the next `get()` reopens instead
 *   of handing out a dead connection.
 * - A failed open rejects. Callers that treat "no database" as a cache miss
 *   pass `onUnavailable` to degrade to `null` instead.
 */

import { openDB } from 'idb';
import type { IDBPDatabase, OpenDBCallbacks } from 'idb';

type UpgradeCallback = NonNullable<OpenDBCallbacks<unknown>['upgrade']>;

export interface DbAccessorOptions {
  readonly name: string;
  readonly version: number;
  readonly upgrade: UpgradeCallback;
  /**
   * Resolve `null` instead of rejecting when the database cannot be opened
   * (private mode, disabled storage, a version the browser refuses). The
   * failure sticks: later `get()` calls resolve `null` without retrying.
   */
  readonly onUnavailable?: (error: unknown) => null;
}

export interface DbAccessor<TDb extends IDBPDatabase | null = IDBPDatabase> {
  get(): Promise<TDb>;
  /** Forget `db` if it is the cached connection, and close it. */
  invalidate(db: IDBPDatabase): void;
  /** Close and forget the cached connection; the next `get()` opens fresh. */
  close(): void;
}

export function createDbAccessor(
  options: DbAccessorOptions & { readonly onUnavailable: (error: unknown) => null }
): DbAccessor<IDBPDatabase | null>;
export function createDbAccessor(options: DbAccessorOptions): DbAccessor;
export function createDbAccessor(options: DbAccessorOptions): DbAccessor<IDBPDatabase | null> {
  const { name, version, upgrade, onUnavailable } = options;

  let instance: IDBPDatabase | null = null;
  let pending: Promise<IDBPDatabase | null> | null = null;
  let unavailable = false;
  // Bumped by close(): an open still in flight when it lands must not write
  // its result back into the state the caller just cleared.
  let generation = 0;

  async function open(): Promise<IDBPDatabase | null> {
    const openedAt = generation;
    let db: IDBPDatabase;
    try {
      db = await openDB(name, version, { upgrade });
    } catch (error: unknown) {
      if (!onUnavailable) throw error;
      if (openedAt === generation) unavailable = true;
      return onUnavailable(error);
    }

    db.addEventListener('close', () => {
      if (instance === db) instance = null;
    });
    if (openedAt === generation) instance = db;
    return db;
  }

  function get(): Promise<IDBPDatabase | null> {
    if (instance) return Promise.resolve(instance);
    if (unavailable) return Promise.resolve(null);
    if (pending) return pending;

    const inFlight: Promise<IDBPDatabase | null> = open().finally(() => {
      if (pending === inFlight) pending = null;
    });
    pending = inFlight;
    return inFlight;
  }

  function invalidate(db: IDBPDatabase): void {
    if (instance === db) instance = null;
    try {
      db.close();
    } catch {
      // Connection was already closing.
    }
  }

  function close(): void {
    generation += 1;
    pending = null;
    unavailable = false;
    const db = instance;
    instance = null;
    db?.close();
  }

  return { get, invalidate, close };
}
