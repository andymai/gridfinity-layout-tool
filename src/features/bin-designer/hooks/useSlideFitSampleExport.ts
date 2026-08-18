/**
 * Export the sliding-tray fit-calibration card: a clearance ladder of rail
 * stubs plus one tray stub that runs in all of them, so a maker can find the
 * clearance their printer needs without printing a whole bin and tray.
 *
 * The design's own `slide` config rides along, because the coupon's rail
 * profile follows its shelf reach and thickness — the card should test the
 * shelf this design would actually carry, not a generic one.
 */

import { useEngineReady } from '@/shared/hooks/useEngineReady';
import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/core/store/settings';
import { useDesignerStore } from '@/features/bin-designer/store';
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

export const SLIDE_FIT_SAMPLE_BASE_NAME = 'slide-fit-sample';

interface UseSlideFitSampleExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly downloadSample: (format: ExportFileFormat, baseName?: string) => Promise<boolean>;
}

export function useSlideFitSampleExport(): UseSlideFitSampleExportReturn {
  const t = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const canExport = useEngineReady();

  const downloadSample = useCallback(
    async (format: ExportFileFormat, baseName: string = SLIDE_FIT_SAMPLE_BASE_NAME) => {
      const bridge = getActiveBridge();
      if (!bridge) return false;

      setIsExporting(true);
      try {
        const slide = useDesignerStore.getState().params.slide;
        if (format === '3mf') {
          const stlResult = await bridge.exportSlideFitSample('stl', slide);
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
          const result = await bridge.exportSlideFitSample(format, slide);
          const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
          triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS[format]}`);
        }
        return true;
      } catch (error: unknown) {
        useToastStore
          .getState()
          .addToast(
            getErrorMessage(error, t('binDesigner.slideTray.fitSample.exportFailed')),
            'error'
          );
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [t]
  );

  return { isExporting, canExport, downloadSample };
}
