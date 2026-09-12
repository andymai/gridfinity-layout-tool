/**
 * Store hook that downloads a cutout selection as an SVG.
 *
 * Kept separate from serialization (cutoutsToSvg) so the geometry is testable
 * without the store or a DOM anchor.
 */

import { useCallback } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { triggerDownload } from '@/shared/generation/exportUtils';
import type { Cutout } from '@/features/bin-designer/types';
import { cutoutsToSvg } from './cutoutsToSvg';
import { cutoutSvgFileName } from './cutoutSvgFileName';

export interface UseSvgExportReturn {
  /** Download the given cutouts as one SVG. Returns whether a file was written. */
  readonly exportCutoutsAsSvg: (cutouts: readonly Cutout[]) => boolean;
}

export function useSvgExport(): UseSvgExportReturn {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const exportCutoutsAsSvg = useCallback(
    (cutouts: readonly Cutout[]): boolean => {
      const svg = cutoutsToSvg(cutouts);
      if (!svg) {
        addToast(t('toast.svgExport.nothingToExport'), 'error');
        return false;
      }

      const { designName } = useDesignerStore.getState();
      triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), cutoutSvgFileName(designName));
      trackEvent('cutout_svg_export', { shape_count: cutouts.length });
      return true;
    },
    [addToast, t]
  );

  return { exportCutoutsAsSvg };
}
