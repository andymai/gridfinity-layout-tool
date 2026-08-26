/**
 * First-run state for the /baseplate page.
 *
 * Mirrors the bin designer's useDesignerFirstRun: a one-time quickstart
 * card and a one-time post-export bridge to the layout editor, both
 * localStorage-flagged.
 */

import { useCallback } from 'react';
import { getDeviceType, trackEvent } from '@/shared/analytics/posthog';
import { createLocalStorageFlagStore } from '@/shared/hooks/createLocalStorageFlagStore';
import { isDevRuntime } from '@/shared/utils/devRuntime';

export type QuickstartDismissMethod = 'got_it' | 'first_edit' | 'escape';

const store = createLocalStorageFlagStore({
  quickstartSeen: 'gridfinity-baseplate-quickstart-seen',
  plannerBridgeSeen: 'gridfinity-baseplate-planner-bridge-seen',
});

/**
 * Re-read flags from localStorage into the module cache and notify subscribers.
 * @internal — test utility only
 */
export const syncBaseplateFirstRunFlags = store.sync;

/**
 * Consume the quickstart on a genuine param edit. Callable from plain
 * functions (the panel's updateBaseplateParams choke point). Mobile never
 * renders the card, so mobile edits must not consume the flag or emit a
 * dismissal for UI that was never shown.
 */
export function dismissBaseplateQuickstartOnEdit(): void {
  if (isDevRuntime()) return;
  if (store.get().quickstartSeen) return;
  if (getDeviceType() === 'mobile') return;
  store.setFlag('quickstartSeen');
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
  const flags = store.useFlags();

  const isDev = isDevRuntime();

  const shouldShowQuickstart = !isDev && !flags.quickstartSeen;
  const shouldOfferPlannerBridge = !isDev && !flags.plannerBridgeSeen;

  const markQuickstartSeen = useCallback(
    (method: QuickstartDismissMethod) => {
      if (flags.quickstartSeen) return;
      store.setFlag('quickstartSeen');
      trackEvent('baseplate_quickstart_dismissed', { method });
    },
    [flags.quickstartSeen]
  );

  const markPlannerBridgeSeen = useCallback(() => {
    if (flags.plannerBridgeSeen) return;
    store.setFlag('plannerBridgeSeen');
  }, [flags.plannerBridgeSeen]);

  return {
    shouldShowQuickstart,
    markQuickstartSeen,
    shouldOfferPlannerBridge,
    markPlannerBridgeSeen,
  };
}
