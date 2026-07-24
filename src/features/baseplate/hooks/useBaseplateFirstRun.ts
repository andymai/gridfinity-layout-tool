/**
 * First-run state for the /baseplate page.
 *
 * Mirrors the bin designer's useDesignerFirstRun: a one-time quickstart
 * card and a one-time post-export bridge to the layout editor, both
 * localStorage-flagged.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { getDeviceType, trackEvent } from '@/shared/analytics/posthog';

const QUICKSTART_KEY = 'gridfinity-baseplate-quickstart-seen';
const PLANNER_BRIDGE_KEY = 'gridfinity-baseplate-planner-bridge-seen';

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

function isDevRuntime(): boolean {
  return import.meta.env.DEV && !import.meta.env.VITEST;
}

/**
 * Re-read flags from localStorage into the module cache and notify subscribers.
 * @internal — test utility only
 */
export function syncBaseplateFirstRunFlags(): void {
  notifyListeners();
}

/**
 * Consume the quickstart on a genuine param edit. Callable from plain
 * functions (the panel's updateBaseplateParams choke point). Mobile never
 * renders the card, so mobile edits must not consume the flag or emit a
 * dismissal for UI that was never shown.
 */
export function dismissBaseplateQuickstartOnEdit(): void {
  if (isDevRuntime()) return;
  if (flagsCache.quickstartSeen) return;
  if (getDeviceType() === 'mobile') return;
  setFlag(QUICKSTART_KEY);
  trackEvent('baseplate_quickstart_dismissed', { method: 'first_edit' });
}

export interface UseBaseplateFirstRunReturn {
  /** Whether the quickstart card should be shown */
  shouldShowQuickstart: boolean;
  /** Dismiss the quickstart card — records how it was dismissed */
  markQuickstartSeen: (method: QuickstartDismissMethod) => void;
  /** Whether the post-export planner bridge has not been offered yet */
  shouldOfferPlannerBridge: boolean;
  /** Mark the planner bridge as offered */
  markPlannerBridgeSeen: () => void;
}

export function useBaseplateFirstRun(): UseBaseplateFirstRunReturn {
  const flags = useSyncExternalStore(subscribe, getSnapshot);

  // Skip in dev mode (covers local dev and E2E tests against dev server).
  // Exclude Vitest so unit tests can still verify the logic.
  const isDev = isDevRuntime();

  const shouldShowQuickstart = !isDev && !flags.quickstartSeen;
  const shouldOfferPlannerBridge = !isDev && !flags.plannerBridgeSeen;

  const markQuickstartSeen = useCallback(
    (method: QuickstartDismissMethod) => {
      if (flags.quickstartSeen) return;
      setFlag(QUICKSTART_KEY);
      trackEvent('baseplate_quickstart_dismissed', { method });
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
