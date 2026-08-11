/**
 * Builds a "seen once" localStorage flag shared across every hook instance in
 * a tab, using the same `useSyncExternalStore` + module-level cache pattern as
 * `useOnboarding`.
 *
 * A factory rather than a copied module per workspace: each flag needs its own
 * key AND its own cache and listener set, so a plain shared hook taking a key
 * argument would have every workspace's overlay reading one cache.
 */

import { useCallback, useSyncExternalStore } from 'react';

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    /* storage unavailable */
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

export interface QuickstartFlag {
  /** Whether the overlay has been dismissed at least once. */
  seen: boolean;
  /** Mark it seen (persists to localStorage). */
  markSeen: () => void;
}

export function createQuickstartFlag(storageKey: string): () => QuickstartFlag {
  let cache = safeGetItem(storageKey) === 'true';
  const listeners = new Set<() => void>();

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const getSnapshot = (): boolean => cache;

  return function useQuickstartFlag(): QuickstartFlag {
    const seen = useSyncExternalStore(subscribe, getSnapshot);

    const markSeen = useCallback(() => {
      safeSetItem(storageKey, 'true');
      cache = safeGetItem(storageKey) === 'true';
      for (const listener of listeners) listener();
    }, []);

    return { seen, markSeen };
  };
}
