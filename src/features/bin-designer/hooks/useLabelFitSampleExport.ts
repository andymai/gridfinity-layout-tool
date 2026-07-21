/**
 * Export the label-socket fit-calibration card (#2666 follow-up): a one-file
 * calibration print sweeping the socket clearance across a fit-offset ladder,
 * plus a nominal reference plate to click into each socket.
 *
 * The card is fully standard-defined — no design parameters ride along — so
 * the winning coupon's embossed offset maps 1:1 onto the design's
 * fit-offset field.
 */

import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isErr, getUserMessage } from '@/core/result';
import { getErrorMessage } from '@/shared/utils/errors';
import {
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  triggerDownload,
} from '@/shared/generation/exportUtils';
import type { ExportFileFormat } from '@/shared/types/bin';

export const LABEL_FIT_SAMPLE_BASE_NAME = 'label-fit-sample';

interface UseLabelFitSampleExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly downloadSample: (format: ExportFileFormat, baseName?: string) => Promise<boolean>;
}

export function useLabelFitSampleExport(): UseLabelFitSampleExportReturn {
  const t = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const canExport = getActiveBridge() !== null;

  const downloadSample = useCallback(
    async (format: ExportFileFormat, baseName: string = LABEL_FIT_SAMPLE_BASE_NAME) => {
      const bridge = getActiveBridge();
      if (!bridge) return false;

      setIsExporting(true);
      try {
        if (format === '3mf') {
          const stlResult = await bridge.exportLabelFitSample('stl');
          const parseResult = parseSTLBinary(stlResult.data);
          if (isErr(parseResult)) throw new Error(getUserMessage(parseResult.error));
          const printSettings = useSettingsStore.getState().settings.printSettings;
          const blob = export3MF(parseResult.value.vertices, parseResult.value.normals, {
            name: baseName,
            printSettings: {
              layerHeight: printSettings.layerHeightMm,
              infillPercent: printSettings.infillPercent,
              material: 'PLA',
              supportRequired: false,
              estimatedMinutes: 0,
              estimatedGrams: 0,
            },
          });
          triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS['3mf']}`);
        } else {
          const result = await bridge.exportLabelFitSample(format);
          const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
          triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS[format]}`);
        }
        return true;
      } catch (error: unknown) {
        useToastStore
          .getState()
          .addToast(getErrorMessage(error, t('binDesigner.fitSample.exportFailed')), 'error');
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [t]
  );

  return { isExporting, canExport, downloadSample };
}
