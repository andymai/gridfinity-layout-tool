/**
 * Saves the bin's shadow board through the user's export destination.
 *
 * Kept apart from the plan and the writers, so the geometry is testable
 * without the store or a download.
 */

import { useCallback } from 'react';
import { err, ok, type Result } from '@/core/result';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import { planShadowBoard, type ShadowBoardProblem } from './shadowBoardPlan';
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

/** Why an export saved nothing: the plan's problem, or a save that did not complete. */
export type ShadowBoardExportProblem = ShadowBoardProblem | 'notSaved';

/** Resolves once the file is saved locally; a problem with the plan is also shown as a toast. */
export function useShadowBoardExport(): (
  format: ShadowBoardFormat,
  clearance: boolean
) => Promise<Result<void, ShadowBoardExportProblem>> {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();
  return useCallback(
    async (format: ShadowBoardFormat, clearance: boolean) => {
      primeExportFolder();
      const { params, designName } = useDesignerStore.getState();
      const planned = planShadowBoard(params, { clearance });
      if (!planned.ok) {
        addToast(t(`binDesigner.shadowBoard.problem.${planned.error}`), 'error');
        return err(planned.error);
      }
      const plan = planned.value;
      const text =
        format === 'svg' ? shadowBoardSvg(plan, clearance) : shadowBoardDxf(plan, clearance);
      const saved = await deliverExport(
        new Blob([text], { type: MIME[format] }),
        shadowBoardFileName(designName, format)
      );
      if (!saved) return err('notSaved' as const);
      trackEvent('shadow_board_export', {
        format,
        clearance,
        opening_count: plan.openings.length,
      });
      return ok(undefined);
    },
    [addToast, t]
  );
}
