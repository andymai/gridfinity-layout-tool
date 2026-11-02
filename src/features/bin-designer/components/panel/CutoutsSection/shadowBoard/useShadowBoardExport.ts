/**
 * Saves the bin's shadow board through the user's export destination.
 *
 * Kept apart from the plan and the writers, so the geometry is testable
 * without the store or a download.
 */

import { useCallback } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import { planShadowBoard } from './shadowBoardPlan';
import {
  shadowBoardDxf,
  shadowBoardFileName,
  shadowBoardSvg,
  type ShadowBoardFormat,
} from './shadowBoardFiles';

const MIME: Record<ShadowBoardFormat, string> = {
  svg: 'image/svg+xml',
  dxf: 'application/dxf',
};

/** Resolves once the file is saved locally, to false when the bin has no openings. */
export function useShadowBoardExport(): (
  format: ShadowBoardFormat,
  clearance: boolean
) => Promise<boolean> {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();
  return useCallback(
    async (format: ShadowBoardFormat, clearance: boolean): Promise<boolean> => {
      primeExportFolder();
      const { params, designName } = useDesignerStore.getState();
      const plan = planShadowBoard(params, { clearance });
      if (plan.openings.length === 0) {
        addToast(t('binDesigner.shadowBoard.nothing'), 'error');
        return false;
      }
      const text =
        format === 'svg' ? shadowBoardSvg(plan, clearance) : shadowBoardDxf(plan, clearance);
      const saved = await deliverExport(
        new Blob([text], { type: MIME[format] }),
        shadowBoardFileName(designName, format)
      );
      if (saved) {
        trackEvent('shadow_board_export', {
          format,
          clearance,
          opening_count: plan.openings.length,
        });
      }
      return saved;
    },
    [addToast, t]
  );
}
