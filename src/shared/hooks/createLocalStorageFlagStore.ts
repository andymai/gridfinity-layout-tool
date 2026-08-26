/**
 * Builds a store of "seen once" localStorage flags shared across every hook
 * instance in a tab, using `useSyncExternalStore` over a module-level cache.
 *
 * A factory rather than a shared hook taking keys as arguments: each flag set
 * needs its own cache and listener set, so a plain hook would have every
 * caller reading one cache. Storage access is fault-tolerant — a blocked or
 * full localStorage degrades to in-memory flags for the tab's lifetime.
 */

import { useSyncExternalStore } from 'react';

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export interface LocalStorageFlagStore<K extends string> {
  /** Subscribe to the flags from a component. */
  useFlags: () => Readonly<Record<K, boolean>>;
  /** Current flags, readable from plain functions. */
  get: () => Readonly<Record<K, boolean>>;
  /** Persist a flag as set and notify all hook instances in the tab. */
  setFlag: (name: K) => void;
  /** Clear every flag (removes the storage keys) and notify. */
  reset: () => void;
  /** Re-read storage into the cache and notify. For tests that write storage directly. */
  sync: () => void;
}

export function createLocalStorageFlagStore<K extends string>(
  keys: Record<K, string>
): LocalStorageFlagStore<K> {
  const names = Object.keys(keys) as K[];

  function readFlags(): Readonly<Record<K, boolean>> {
    const flags = {} as Record<K, boolean>;
    for (const name of names) {
      flags[name] = safeGetItem(keys[name]) === 'true';
    }
    return flags;
  }

  let cache = readFlags();
  const listeners = new Set<() => void>();

  function notify(): void {
    cache = readFlags();
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot(): Readonly<Record<K, boolean>> {
    return cache;
  }

  return {
    useFlags: () => useSyncExternalStore(subscribe, getSnapshot),
    get: getSnapshot,
    setFlag: (name) => {
      safeSetItem(keys[name], 'true');
      notify();
    },
    reset: () => {
      for (const name of names) safeRemoveItem(keys[name]);
      notify();
    },
    sync: notify,
  };
}
