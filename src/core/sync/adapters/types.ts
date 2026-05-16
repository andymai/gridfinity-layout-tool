/**
 * Storage adapters that the sync engine talks to.
 *
 * The engine never imports `LayoutManager` or `DesignerStorage` directly —
 * it depends only on these interfaces. Concrete implementations:
 *   - `LayoutAdapter`  — wraps `src/core/storage/LayoutManager` (lives in
 *                        `core/`, no boundary issue).
 *   - `DesignAdapter`  — wraps `src/features/bin-designer/storage/...`
 *                        (lives in `features/`, registered with the
 *                        engine at app-shell boot).
 *
 * This abstraction is what lets `core/` host the sync engine without
 * importing the bin-designer feature, satisfying the project's module
 * boundary rule (`src/core/` cannot import `src/features/`).
 */

import type { Layout } from '@/core/types';

/**
 * Common shape every synced item presents to the engine, regardless of
 * whether it's a Layout or a BinDesigner design.
 *
 * `modifiedAt` is always **ms since epoch** here. Adapters whose local
 * source-of-truth uses a different representation (e.g. ISO strings)
 * normalize at the adapter boundary so the engine doesn't have to care.
 */
export interface SyncableItem<T = unknown> {
  id: string;
  payload: T;
  modifiedAt: number;
}

/**
 * Event emitted by an adapter when local storage mutates. The engine
 * listens to these to decide what to enqueue in the outbox.
 *
 * `kind: 'put' | 'delete'`:
 *   - `put`    — created or updated locally; engine should push
 *   - `delete` — removed locally; engine should send DELETE
 *
 * For `put`, `modifiedAt` is the new local mtime. For `delete`, it's
 * the time the deletion happened (used as the tombstone's `deletedAt`
 * on the server).
 */
export interface AdapterChange {
  kind: 'put' | 'delete';
  id: string;
  modifiedAt: number;
}

export type AdapterChangeListener = (change: AdapterChange) => void;

/**
 * Generic storage adapter contract. Implementations expose a small CRUD
 * surface plus a `subscribe` method the engine uses to observe local
 * mutations.
 */
export interface SyncAdapter<T = unknown> {
  /** Read every live item. Used by the claim flow (PR 5) and audits. */
  list(): Promise<SyncableItem<T>[]>;

  /** Read one item by id. Returns `null` if absent. */
  get(id: string): Promise<SyncableItem<T> | null>;

  /**
   * Apply a remote change locally without firing the change listener
   * (the engine's own subscriber would otherwise echo the write back to
   * the cloud). Implementations must use a per-item flag or similar
   * suppression mechanism.
   */
  applyRemote(item: SyncableItem<T>): Promise<void>;

  /**
   * Remove an item locally without firing the change listener. Used by
   * the poller when it sees a remote tombstone newer than the local item.
   */
  applyRemoteDelete(id: string): Promise<void>;

  /**
   * Subscribe to local change events. Returns an unsubscribe function.
   * The engine installs exactly one listener per adapter at startup.
   */
  subscribe(listener: AdapterChangeListener): () => void;
}

/**
 * Designs sync as `{ name, params }` so the user-visible name survives
 * the cloud round-trip — mirroring how `Layout` already carries its
 * name as a top-level payload field. `params` is `unknown` here because
 * `BinParams` lives in `features/bin-designer/` and `core/` cannot
 * import it; the concrete `DesignAdapter` impl re-narrows it.
 */
export interface DesignSyncPayload {
  name: string;
  params: unknown;
}

export type LayoutAdapter = SyncAdapter<Layout>;
export type DesignAdapter = SyncAdapter<DesignSyncPayload>;

/**
 * Both adapters bundled together — what the engine takes at start time.
 * The shape lets the engine treat them uniformly while keeping the
 * `kind` distinction visible in logs and the outbox.
 *
 * `SyncKind = 'layouts' | 'designs'` — plural to match server endpoints
 * (`/api/sync/{kind}/[id]`) and Redis index keys (`users:{uid}:index:{kind}`).
 * The outbox uses the same plural form so there's no kind-translation
 * shim anywhere in the stack.
 */
export interface SyncAdapters {
  layouts: LayoutAdapter;
  designs: DesignAdapter;
}

export type SyncKind = keyof SyncAdapters;
