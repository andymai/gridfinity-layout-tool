import { useCallback } from 'react';
import type { PlanView } from '@/agent/contract';
import { SHARED_PREVIEW_ID } from '@/core/constants';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useToastStore } from '@/core/store/toast';
import { useLayoutActivation } from '@/shared/hooks/useLayoutActivation';
import { useTranslation } from '@/i18n';

const PLAN_HASH = '#plan=';

/**
 * Opens a plan in the editor as a shared preview, as its `#plan=` link does
 * in a new tab, so the reader's own layouts do not change until they save it.
 */
export function useOpenPlan(): (plan: PlanView) => Promise<boolean> {
  const t = useTranslation();
  const { activateLayout } = useLayoutActivation();
  const setSharedLayoutPreview = useSharedPreviewStore((s) => s.setSharedLayoutPreview);
  const addToast = useToastStore((s) => s.addToast);
  return useCallback(
    async (plan: PlanView) => {
      const at = plan.link.indexOf(PLAN_HASH);
      if (at < 0) return false;
      const { importPlanLink } = await import('@/core/storage/planLinkImport');
      const { layout } = await importPlanLink(plan.link.slice(at + PLAN_HASH.length));
      if (layout === null) {
        addToast(t('askAi.plan.failed'), 'error');
        return false;
      }
      activateLayout(layout, SHARED_PREVIEW_ID, t('askAi.plan.opened', { name: layout.name }));
      setSharedLayoutPreview(
        layout,
        layout.name,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'plan'
      );
      return true;
    },
    [activateLayout, setSharedLayoutPreview, addToast, t]
  );
}
