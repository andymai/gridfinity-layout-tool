/**
 * Store hook that saves a cutout selection as an SVG through the user's export
 * destination.
 *
 * Kept separate from serialization (cutoutsToSvg) so the geometry is testable
 * without the store or a DOM anchor.
 */

import { useCallback } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import type { Cutout } from '@/features/bin-designer/types';
import { cutoutsToSvg } from './cutoutsToSvg';
import { cutoutSvgFileName } from './cutoutSvgFileName';

export interface UseSvgExportReturn {
  /**
   * Save the given cutouts as one SVG. Resolves once the file is saved locally
   * (downloaded or written to the export folder), to false when there was
   * nothing to save. An upload to the export URL carries on afterwards.
   */
  readonly exportCutoutsAsSvg: (cutouts: readonly Cutout[]) => Promise<boolean>;
}

export function useSvgExport(): UseSvgExportReturn {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const exportCutoutsAsSvg = useCallback(
    async (cutouts: readonly Cutout[]): Promise<boolean> => {
      primeExportFolder();
      const svg = cutoutsToSvg(cutouts);
      if (!svg) {
        addToast(t('toast.svgExport.nothingToExport'), 'error');
        return false;
      }

      const { designName } = useDesignerStore.getState();
      await deliverExport(
        new Blob([svg], { type: 'image/svg+xml' }),
        cutoutSvgFileName(designName)
      );
      trackEvent('cutout_svg_export', { shape_count: cutouts.length });
      return true;
    },
    [addToast, t]
  );

  return { exportCutoutsAsSvg };
}
