/**
 * Export the divider fit sample: a short wall section with one slot cut as the
 * bin cuts it, plus a short divider piece with the design's piece fit.
 *
 * The design's live params ride along, because the slot follows its wall,
 * thickness, fit tolerance and floor groove, and the piece its piece fit.
 */

import { useCallback } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { downloadWorkerSample, useSampleExport } from '@/shared/hooks/useSampleExport';
import type { SampleExportContext, UseSampleExportReturn } from '@/shared/hooks/useSampleExport';
import { binHasWallSlots } from '@/shared/utils/wallSlots';

export const DIVIDER_FIT_SAMPLE_BASE_NAME = 'divider-fit-sample';

export function useDividerFitSampleExport(): UseSampleExportReturn {
  const t = useTranslation();
  const hasSlot = useDesignerStore((s) => binHasWallSlots(s.params));

  const download = useCallback(
    (context: SampleExportContext) =>
      downloadWorkerSample(context, (format) =>
        context.bridge.exportDividerFitSample(format, useDesignerStore.getState().params)
      ),
    []
  );

  return useSampleExport({
    defaultBaseName: DIVIDER_FIT_SAMPLE_BASE_NAME,
    notReadyMessage: t('binDesigner.exportNotReady'),
    failureMessage: t('binDesigner.dividerFitSample.exportFailed'),
    enabled: hasSlot,
    download,
  });
}
