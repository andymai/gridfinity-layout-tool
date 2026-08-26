/**
 * First-run state for the /designer page.
 *
 * Two one-time experiences, mirroring the cutout quickstart pattern:
 * - Quickstart card: shown until dismissed or the user makes their first edit
 * - Planner bridge: a one-time post-export toast pointing at the drawer planner
 */

import { useCallback } from 'react';
import { trackEvent } from '@/shared/analytics/posthog';
import { createLocalStorageFlagStore } from '@/shared/hooks/createLocalStorageFlagStore';
import { isDevRuntime } from '@/shared/utils/devRuntime';

export type QuickstartDismissMethod = 'got_it' | 'first_edit' | 'escape';

const store = createLocalStorageFlagStore({
  quickstartSeen: 'gridfinity-designer-quickstart-seen',
  plannerBridgeSeen: 'gridfinity-designer-planner-bridge-seen',
});

/**
 * Re-read flags from localStorage into the module cache and notify subscribers.
 * @internal — test utility only
 */
export const syncDesignerFirstRunFlags = store.sync;

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
  const flags = store.useFlags();

  const isDev = isDevRuntime();

  const shouldShowQuickstart = !isDev && !flags.quickstartSeen;
  const shouldOfferPlannerBridge = !isDev && !flags.plannerBridgeSeen;

  const markQuickstartSeen = useCallback(
    (method: QuickstartDismissMethod) => {
      if (flags.quickstartSeen) return;
      store.setFlag('quickstartSeen');
      trackEvent('designer_quickstart_dismissed', { method });
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
