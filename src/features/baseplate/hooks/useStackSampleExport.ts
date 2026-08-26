/**
 * Hook for exporting a stack-print fit sample: a single tower of two 1×1 plates
 * (bottom upright, one flipped on top, separated by the configured air gap) so
 * makers can dial in the separation before committing to a full stacked print.
 *
 * Reuses the normal baseplate export (a clean, feature-stripped 1×1 plate) and
 * the same tower-baking soup as the full stack export — just pinned to 2 copies.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { mm, STACK_PRINT_DEFAULT_GAP_MM } from '@/core/types';
import type { StackPrintParams } from '@/core/types';
import { export3MF, buildSTLBuffer } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildThreeMFPrintSettings } from '@/shared/generation/stlTo3mf';
import { isErr, getUserMessage } from '@/core/result';
import { useTranslation } from '@/i18n';
import { useSampleExport } from '@/shared/hooks/useSampleExport';
import type { SampleExportContext, UseSampleExportReturn } from '@/shared/hooks/useSampleExport';
import { buildFullParams } from '../utils/buildFullParams';
import { buildStackExportSoup } from '../utils/stackExport';
import {
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  triggerDownload,
} from '@/shared/generation/exportUtils';

/** Default download name when the dialog isn't given a custom one. */
export const STACK_SAMPLE_BASE_NAME = 'stack-fit-sample';

export function useStackSampleExport(): UseSampleExportReturn {
  const t = useTranslation();

  const { gridUnitMm, baseplateParams } = useLayoutStore(
    useShallow((state) => ({
      gridUnitMm: state.layout.gridUnitMm,
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  const download = useCallback(
    async ({ bridge, format, baseName, printSettings }: SampleExportContext) => {
      const gapMm = mm(baseplateParams.stackPrint?.gapMm ?? STACK_PRINT_DEFAULT_GAP_MM);
      const stack: StackPrintParams = { enabled: true, gapMm };

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
        printSettings.nozzleSizeMm
      );

      const result = await bridge.exportBaseplate(sampleParams, 'stl');
      const parsed = parseSTLBinary(result.data);
      if (isErr(parsed)) throw new Error(getUserMessage(parsed.error));

      // Two plates: bottom upright + one flipped, separated by the air gap.
      const soup = buildStackExportSoup(parsed.value.vertices, parsed.value.normals, 2, stack);

      if (format === '3mf') {
        const blob = export3MF(soup.vertices, soup.normals, {
          name: baseName,
          printSettings: buildThreeMFPrintSettings(printSettings),
        });
        triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS['3mf']}`);
        return;
      }

      // STEP has no stacking notion; fall back to a baked STL tower.
      const buffer = buildSTLBuffer(soup.vertices, soup.normals, baseName);
      const blob = new Blob([buffer], { type: FORMAT_MIME_TYPES.stl });
      triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS.stl}`);
    },
    [gridUnitMm, baseplateParams]
  );

  return useSampleExport({
    defaultBaseName: STACK_SAMPLE_BASE_NAME,
    notReadyMessage: t('baseplate.exportNotReady'),
    failureMessage: t('baseplate.stackPrint.sampleExportFailed'),
    enabled: baseplateParams.stackPrint?.enabled === true,
    download,
  });
}
