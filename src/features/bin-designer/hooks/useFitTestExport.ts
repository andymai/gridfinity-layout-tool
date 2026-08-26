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

import { exportWithResilience } from '../utils/exportWithResilience';
import { useEngineReady } from '@/shared/hooks/useEngineReady';
import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/core/store/settings';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { getActiveBridge } from '@/shared/generation/bridge';
import { stlTo3MF } from '@/shared/generation/stlTo3mf';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { getErrorMessage } from '@/shared/utils/errors';
import { trackToolConverted } from '@/shared/analytics/posthog';
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
  const canExport = useEngineReady();

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
        // Through the same retry + worker-restart path the main export uses:
        // without it a wedged worker costs a toast per attempt and never
        // respawns for a user whose only export surface is this button. The
        // operation re-acquires the bridge so a restarted worker is picked up.
        const { result } = await exportWithResilience(() => {
          const liveBridge = getActiveBridge();
          if (!liveBridge) throw new Error('Bridge not available');
          return liveBridge.exportFitTest(params, workerFormat, {
            thicknessMm,
            stamp: { designName },
            bed,
          });
        });

        const printSettings = useSettingsStore.getState().settings.printSettings;
        const pieces =
          format === '3mf'
            ? await Promise.all(
                result.pieces.map(async (piece) => {
                  const blob = stlTo3MF(piece.data, printSettings, {
                    name: piece.label ? `${baseName}_${piece.label}` : baseName,
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
          // Named exactly what the dialog shows. The pieces inside carry the
          // split (`fit-test_A1.stl`), so nothing is lost by dropping a suffix
          // the filename field never knew about.
          triggerDownload(packagePiecesAsZip(pieces, baseName, extension), `${baseName}.zip`);
        }

        // The dialog warns about this from its own copy of the plan, but the
        // worker is what actually cut the card. Reporting its count too means a
        // caller that skipped the dialog's warning still cannot ship a card with
        // a seam through the hole being measured without saying so.
        if (result.blockedSeams > 0) {
          useToastStore
            .getState()
            .addToast(t('binDesigner.cutouts.fitTest.warnSeamThroughCutout'), 'info', 8000);
        }
        // A fit-test card is a printable file, which is what the conversion
        // funnel (and the feedback nudge's session gate) count.
        trackToolConverted('designer', {
          format,
          split: pieces.length > 1,
          piece_count: pieces.length,
        });
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
