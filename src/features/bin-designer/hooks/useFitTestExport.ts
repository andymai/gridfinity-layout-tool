/**
 * Export the cutout fit-test card: a thin slice of this design's own top, so a
 * maker can check that their parts drop into the openings before committing to
 * a whole bin.
 *
 * The design's live params ride along because the card IS the bin — it is cut
 * from the same solid the exporter ships, not rebuilt from the cutout list.
 *
 * An oversize card comes back as pieces and is packaged as a ZIP, matching how
 * a split bin downloads. The archive extension follows the piece format rather
 * than being assumed, because a `.stl`-named archive of STEP bytes downloads
 * perfectly happily (gotcha #20).
 */

import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/core/store/settings';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { isErr, getUserMessage } from '@/core/result';
import { getErrorMessage } from '@/shared/utils/errors';
import {
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  triggerDownload,
} from '@/shared/generation/exportUtils';
import type { ExportFileFormat } from '@/shared/types/bin';
import type { BedSize } from '@/shared/utils/fitTestPlan';

export const FIT_TEST_BASE_NAME = 'fit-test';

interface DownloadOptions {
  readonly format: ExportFileFormat;
  readonly thicknessMm: number;
  readonly baseName?: string;
  readonly bed?: BedSize;
}

interface UseFitTestExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  /** Resolves true on a completed download. */
  readonly downloadCard: (options: DownloadOptions) => Promise<boolean>;
}

export function useFitTestExport(): UseFitTestExportReturn {
  const t = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const canExport = getActiveBridge() !== null;

  const downloadCard = useCallback(
    async ({ format, thicknessMm, baseName = FIT_TEST_BASE_NAME, bed }: DownloadOptions) => {
      const bridge = getActiveBridge();
      if (!bridge) return false;

      setIsExporting(true);
      try {
        const { params, designName } = useDesignerStore.getState();
        // STEP is refused worker-side for mesh imprints; the request carries the
        // format the user picked and the worker is the authority on that rule.
        const workerFormat = format === '3mf' ? 'stl' : format;
        const result = await bridge.exportFitTest(params, workerFormat, {
          thicknessMm,
          stamp: { designName },
          bed,
        });

        const pieces =
          format === '3mf'
            ? await Promise.all(
                result.pieces.map(async (piece) => {
                  const parsed = parseSTLBinary(piece.data);
                  if (isErr(parsed)) throw new Error(getUserMessage(parsed.error));
                  const printSettings = useSettingsStore.getState().settings.printSettings;
                  const blob = export3MF(parsed.value.vertices, parsed.value.normals, {
                    name: piece.label ? `${baseName}_${piece.label}` : baseName,
                    printSettings: {
                      layerHeight: printSettings.layerHeightMm,
                      infillPercent: printSettings.infillPercent,
                      material: 'PLA',
                      supportRequired: false,
                      estimatedMinutes: 0,
                      estimatedGrams: 0,
                    },
                  });
                  return { data: await blob.arrayBuffer(), label: piece.label };
                })
              )
            : result.pieces.map((piece) => ({ data: piece.data, label: piece.label }));

        const extension = FORMAT_EXTENSIONS[format];
        if (pieces.length === 1) {
          const blob = new Blob([pieces[0].data], { type: FORMAT_MIME_TYPES[format] });
          triggerDownload(blob, `${baseName}${extension}`);
        } else {
          triggerDownload(packagePiecesAsZip(pieces, baseName, extension), `${baseName}_split.zip`);
        }
        return true;
      } catch (error: unknown) {
        useToastStore
          .getState()
          .addToast(getErrorMessage(error, t('binDesigner.cutouts.fitTest.exportFailed')), 'error');
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [t]
  );

  return { isExporting, canExport, downloadCard };
}
