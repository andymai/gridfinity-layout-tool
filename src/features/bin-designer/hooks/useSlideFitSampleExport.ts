/**
 * Export the sliding-tray fit-calibration card: a clearance ladder of rail
 * stubs plus one tray stub that runs in all of them, so a maker can find the
 * clearance their printer needs without printing a whole bin and tray.
 *
 * The design's own `slide` config rides along, because the coupon's rail
 * profile follows its shelf reach and thickness — the card should test the
 * shelf this design would actually carry, not a generic one.
 */

import { useCallback } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { downloadWorkerSample, useSampleExport } from '@/shared/hooks/useSampleExport';
import type { SampleExportContext, UseSampleExportReturn } from '@/shared/hooks/useSampleExport';

export const SLIDE_FIT_SAMPLE_BASE_NAME = 'slide-fit-sample';

export function useSlideFitSampleExport(): UseSampleExportReturn {
  const t = useTranslation();

  const download = useCallback(
    (context: SampleExportContext) =>
      downloadWorkerSample(context, (format) =>
        context.bridge.exportSlideFitSample(format, useDesignerStore.getState().params.slide)
      ),
    []
  );

  return useSampleExport({
    defaultBaseName: SLIDE_FIT_SAMPLE_BASE_NAME,
    notReadyMessage: t('binDesigner.exportNotReady'),
    failureMessage: t('binDesigner.slideTray.fitSample.exportFailed'),
    download,
  });
}
