/**
 * First-run state for the /designer page.
 *
 * Two one-time experiences, mirroring the cutout quickstart pattern:
 * - Quickstart card: shown until dismissed or the user makes their first edit
 * - Planner bridge: a one-time post-export toast pointing at the drawer planner
 */

import { useCallback, useSyncExternalStore } from 'react';
import { trackEvent } from '@/shared/analytics/posthog';

const QUICKSTART_KEY = 'gridfinity-designer-quickstart-seen';
const PLANNER_BRIDGE_KEY = 'gridfinity-designer-planner-bridge-seen';

export type QuickstartDismissMethod = 'got_it' | 'first_edit' | 'escape';

type FirstRunFlags = {
  quickstartSeen: boolean;
  plannerBridgeSeen: boolean;
};

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

function readFlags(): FirstRunFlags {
  return {
    quickstartSeen: safeGetItem(QUICKSTART_KEY) === 'true',
    plannerBridgeSeen: safeGetItem(PLANNER_BRIDGE_KEY) === 'true',
  };
}

let flagsCache: FirstRunFlags = readFlags();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  flagsCache = readFlags();
  for (const listener of listeners) {
    listener();
  }
}

function setFlag(key: string): void {
  safeSetItem(key, 'true');
  notifyListeners();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): FirstRunFlags {
  return flagsCache;
}

/**
 * Re-read flags from localStorage into the module cache and notify subscribers.
 * @internal — test utility only
 */
export function syncDesignerFirstRunFlags(): void {
  notifyListeners();
}

export interface UseDesignerFirstRunReturn {
  /** Whether the quickstart card should be shown */
  shouldShowQuickstart: boolean;
  /** Dismiss the quickstart card — records how it was dismissed */
  markQuickstartSeen: (method: QuickstartDismissMethod) => void;
  /** Whether the post-export planner bridge has not been offered yet */
  shouldOfferPlannerBridge: boolean;
  /** Mark the planner bridge as offered */
  markPlannerBridgeSeen: () => void;
}

export function useDesignerFirstRun(): UseDesignerFirstRunReturn {
  const flags = useSyncExternalStore(subscribe, getSnapshot);

  // Skip in dev mode (covers local dev and E2E tests against dev server).
  // Exclude Vitest so unit tests can still verify the logic.
  const isDev = import.meta.env.DEV && !import.meta.env.VITEST;

  const shouldShowQuickstart = !isDev && !flags.quickstartSeen;
  const shouldOfferPlannerBridge = !isDev && !flags.plannerBridgeSeen;

  const markQuickstartSeen = useCallback(
    (method: QuickstartDismissMethod) => {
      if (flags.quickstartSeen) return;
      setFlag(QUICKSTART_KEY);
      trackEvent('designer_quickstart_dismissed', { method });
    },
    [flags.quickstartSeen]
  );

  const markPlannerBridgeSeen = useCallback(() => {
    if (flags.plannerBridgeSeen) return;
    setFlag(PLANNER_BRIDGE_KEY);
  }, [flags.plannerBridgeSeen]);

  return {
    shouldShowQuickstart,
    markQuickstartSeen,
    shouldOfferPlannerBridge,
    markPlannerBridgeSeen,
  };
}
