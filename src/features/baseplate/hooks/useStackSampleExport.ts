/**
 * Hook for exporting a stack-print fit sample: a single tower of two 1×1 plates
 * (bottom upright, one flipped on top, separated by the configured air gap) so
 * makers can dial in the separation before committing to a full stacked print.
 *
 * Reuses the normal baseplate export (a clean, feature-stripped 1×1 plate) and
 * the same tower-baking soup as the full stack export — just pinned to 2 copies.
 */

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { mm, STACK_PRINT_DEFAULT_GAP_MM } from '@/core/types';
import type { StackPrintParams } from '@/core/types';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF, buildSTLBuffer } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isErr, getUserMessage } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { getErrorMessage } from '@/shared/utils/errors';
import { useTranslation } from '@/i18n';
import { buildFullParams } from '../utils/buildFullParams';
import { buildStackExportSoup } from '../utils/stackExport';
import {
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  triggerDownload,
} from '@/shared/generation/exportUtils';
import type { ExportFileFormat } from '@/shared/types/bin';

/** Default download name when the dialog isn't given a custom one. */
export const STACK_SAMPLE_BASE_NAME = 'stack-fit-sample';

interface UseStackSampleExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly downloadSample: (format: ExportFileFormat, baseName?: string) => Promise<boolean>;
}

export function useStackSampleExport(): UseStackSampleExportReturn {
  const t = useTranslation();

  const { gridUnitMm, baseplateParams } = useLayoutStore(
    useShallow((state) => ({
      gridUnitMm: state.layout.gridUnitMm,
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  const [isExporting, setIsExporting] = useState(false);
  const canExport = getActiveBridge() !== null && baseplateParams.stackPrint?.enabled === true;

  const downloadSample = useCallback(
    async (format: ExportFileFormat, baseName: string = STACK_SAMPLE_BASE_NAME) => {
      const bridge = getActiveBridge();
      if (!bridge) {
        useToastStore.getState().addToast(t('baseplate.exportNotReady'), 'error');
        return false;
      }

      const gapMm = mm(baseplateParams.stackPrint?.gapMm ?? STACK_PRINT_DEFAULT_GAP_MM);
      const stack: StackPrintParams = { enabled: true, gapMm };

      setIsExporting(true);
      try {
        // A clean 1×1 plate: synced to a 1×1 drawer, no padding, stack-enabled so
        // buildFullParams strips connectors/magnets/rounding for uniform tiles.
        const sampleParams = buildFullParams(
          {
            ...baseplateParams,
            syncWithLayout: true,
            paddingLeft: mm(0),
            paddingRight: mm(0),
            paddingFront: mm(0),
            paddingBack: mm(0),
            overTile: false,
            stackPrint: stack,
          },
          1,
          1,
          gridUnitMm,
          'end',
          'end',
          useSettingsStore.getState().settings.printSettings.nozzleSizeMm
        );

        const result = await bridge.exportBaseplate(sampleParams, 'stl');
        const parsed = parseSTLBinary(result.data);
        if (isErr(parsed)) throw new Error(getUserMessage(parsed.error));

        // Two plates: bottom upright + one flipped, separated by the air gap.
        const soup = buildStackExportSoup(parsed.value.vertices, parsed.value.normals, 2, stack);

        if (format === '3mf') {
          const printSettings = useSettingsStore.getState().settings.printSettings;
          const blob = export3MF(soup.vertices, soup.normals, {
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
          // STEP has no stacking notion; fall back to a baked STL tower.
          const buffer = buildSTLBuffer(soup.vertices, soup.normals, baseName);
          const blob = new Blob([buffer], { type: FORMAT_MIME_TYPES.stl });
          triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS.stl}`);
        }
        return true;
      } catch (error: unknown) {
        useToastStore.getState().addToast(getErrorMessage(error, 'Export failed'), 'error');
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [t, gridUnitMm, baseplateParams]
  );

  return { isExporting, canExport, downloadSample };
}
