/**
 * One-time post-export bridge from the baseplate generator to the layout
 * editor, offered at the moment of first success (a completed export).
 */

import { useCallback } from 'react';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import { useBaseplateRouting } from '@/shared/hooks/useBaseplateRouting';
import { useTranslation } from '@/i18n';
import { useBaseplateFirstRun } from './useBaseplateFirstRun';

export function useBaseplatePlannerBridge(): () => void {
  const t = useTranslation();
  const { shouldOfferPlannerBridge, markPlannerBridgeSeen } = useBaseplateFirstRun();
  const { navigateToPlanner } = useBaseplateRouting();

  return useCallback(() => {
    if (!shouldOfferPlannerBridge) return;
    markPlannerBridgeSeen();
    trackEvent('baseplate_planner_bridge', { action: 'shown' });
    useToastStore.getState().addToast({
      message: t('baseplate.plannerBridge.message'),
      type: 'info',
      duration: 10000,
      action: {
        label: t('baseplate.plannerBridge.action'),
        onClick: () => {
          trackEvent('baseplate_planner_bridge', { action: 'clicked' });
          navigateToPlanner();
        },
      },
    });
  }, [shouldOfferPlannerBridge, markPlannerBridgeSeen, navigateToPlanner, t]);
}
