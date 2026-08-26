/**
 * Export the label-socket fit-calibration card: a one-file
 * calibration print sweeping the socket clearance across a fit-offset ladder,
 * plus a nominal reference plate to click into each socket.
 *
 * No design parameters ride along, so the winning coupon's embossed offset
 * maps 1:1 onto the design's fit-offset field. The one print SETTING that does
 * ride along is the nozzle: coupons scale their nominal clearance to it
 * just like real sockets, so the offset transfers on that same nozzle.
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { downloadWorkerSample, useSampleExport } from '@/shared/hooks/useSampleExport';
import type { SampleExportContext, UseSampleExportReturn } from '@/shared/hooks/useSampleExport';

export const LABEL_FIT_SAMPLE_BASE_NAME = 'label-fit-sample';

export function useLabelFitSampleExport(): UseSampleExportReturn {
  const t = useTranslation();

  const download = useCallback(
    (context: SampleExportContext) =>
      downloadWorkerSample(context, (format) =>
        context.bridge.exportLabelFitSample(format, context.printSettings.nozzleSizeMm)
      ),
    []
  );

  return useSampleExport({
    defaultBaseName: LABEL_FIT_SAMPLE_BASE_NAME,
    notReadyMessage: t('binDesigner.exportNotReady'),
    failureMessage: t('binDesigner.fitSample.exportFailed'),
    download,
  });
}
