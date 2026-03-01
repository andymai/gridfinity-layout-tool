/**
 * Manages the cutout editor quickstart overlay localStorage flag.
 *
 * Uses the same useSyncExternalStore + module-level cache pattern as
 * `useOnboarding` to share flag state across all hook instances in a tab.
 */

import { useCallback, useSyncExternalStore } from 'react';

const QUICKSTART_KEY = 'gridfinity-cutout-quickstart-seen';

// ── Reactive localStorage ──────────────────────────────────────────────────────

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

let cache = safeGetItem(QUICKSTART_KEY) === 'true';
const listeners = new Set<() => void>();

function notifyListeners(): void {
  cache = safeGetItem(QUICKSTART_KEY) === 'true';
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return cache;
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export interface UseCutoutQuickstartReturn {
  /** Whether the quickstart overlay has been dismissed at least once */
  quickstartSeen: boolean;
  /** Mark the quickstart as seen (persists to localStorage) */
  markQuickstartSeen: () => void;
}

export function useCutoutQuickstart(): UseCutoutQuickstartReturn {
  const quickstartSeen = useSyncExternalStore(subscribe, getSnapshot);

  const markQuickstartSeen = useCallback(() => {
    safeSetItem(QUICKSTART_KEY, 'true');
    notifyListeners();
  }, []);

  return { quickstartSeen, markQuickstartSeen };
}
