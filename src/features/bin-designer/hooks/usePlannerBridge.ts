/**
 * One-time post-export bridge from the designer to the drawer planner.
 *
 * Offered at the moment of first success (a completed export) rather than
 * during first-run, so it never competes with learning the designer itself.
 */

import { useCallback } from 'react';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useTranslation } from '@/i18n';
import { useDesignerFirstRun } from './useDesignerFirstRun';

export function usePlannerBridge(): () => void {
  const t = useTranslation();
  const { shouldOfferPlannerBridge, markPlannerBridgeSeen } = useDesignerFirstRun();
  const { navigateToPlanner } = useDesignerRouting();

  return useCallback(() => {
    if (!shouldOfferPlannerBridge) return;
    markPlannerBridgeSeen();
    trackEvent('designer_planner_bridge', { action: 'shown' });
    useToastStore.getState().addToast({
      message: t('binDesigner.plannerBridge.message'),
      type: 'info',
      duration: 10000,
      action: {
        label: t('binDesigner.plannerBridge.action'),
        onClick: () => {
          trackEvent('designer_planner_bridge', { action: 'clicked' });
          navigateToPlanner();
        },
      },
    });
  }, [shouldOfferPlannerBridge, markPlannerBridgeSeen, navigateToPlanner, t]);
}
