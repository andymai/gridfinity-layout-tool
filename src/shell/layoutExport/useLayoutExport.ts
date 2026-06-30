/**
 * Orchestrates a whole-layout export into a single ZIP.
 *
 * Lives in the shell (not a feature) because it composes three features —
 * design-linking (which bins are linked), bin-designer (loading designs +
 * naming), and baseplate (the baseplate builder) — which a feature may not
 * import. Acquires the bridge + worker pool once and runs bins then baseplate as
 * two sequential phases (the single bridge has one export slot), then packages
 * `bins/`, `baseplate/`, and `manifest.txt` and triggers the download.
 */

import { useCallback, useState } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { isOk, getUserMessage } from '@/core/result';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { getErrorMessage } from '@/shared/utils/errors';
import { bridgeManager, workerPoolManager } from '@/shared/generation/bridge';
import type { ExportFormat } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { packageFilesAsZip } from '@/shared/generation/zipExport';
import type { ZipBinaryFile, ZipTextFile } from '@/shared/generation/zipExport';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';
import { buildBaseplateExportPieces } from '@/features/baseplate';
import { loadDesign } from '@/features/bin-designer';
import { getLinkedDesignIds } from '@/features/design-linking';
import { planLayoutBinExport } from './planLayoutBinExport';
import type { LoadedDesign } from './planLayoutBinExport';
import { buildLayoutManifest } from './buildLayoutManifest';

type Progress = { current: number; total: number; label?: string } | null;

interface UseLayoutExportReturn {
  readonly isExporting: boolean;
  readonly exportProgress: Progress;
  /** Export the active layout's linked bins + baseplate as a ZIP named `${zipBaseName}.zip`. */
  readonly exportLayout: (format: ExportFileFormat, zipBaseName: string) => Promise<boolean>;
}

/** Convert STL bytes to 3MF bytes (the bridge emits STL only). */
async function stlTo3mf(
  stl: ArrayBuffer,
  name: string,
  printSettings: { layerHeightMm: number; infillPercent: number }
): Promise<ArrayBuffer> {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error(getUserMessage(parsed.error));
  const blob = export3MF(parsed.value.vertices, parsed.value.normals, {
    name,
    printSettings: {
      layerHeight: printSettings.layerHeightMm,
      infillPercent: printSettings.infillPercent,
      material: 'PLA',
      supportRequired: false,
      estimatedMinutes: 0,
      estimatedGrams: 0,
    },
  });
  return blob.arrayBuffer();
}

function baseNameOf(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');
}

export function useLayoutExport(): UseLayoutExportReturn {
  const t = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<Progress>(null);

  const exportLayout = useCallback(
    async (format: ExportFileFormat, zipBaseName: string): Promise<boolean> => {
      const layout = useLayoutStore.getState().layout;
      const printSettings = useSettingsStore.getState().settings.printSettings;
      const bins = layout.bins;
      const designIds = getLinkedDesignIds(bins);

      if (designIds.length === 0) {
        useToastStore.getState().addToast(t('layoutExport.noLinkedBins'), 'error');
        return false;
      }

      setIsExporting(true);
      setExportProgress(null);

      let bridge;
      try {
        bridge = await bridgeManager.acquire();
      } catch {
        useToastStore.getState().addToast(t('layoutExport.engineNotReady'), 'error');
        setIsExporting(false);
        return false;
      }

      let pool = null;
      try {
        try {
          pool = await workerPoolManager.acquire();
        } catch {
          pool = null;
        }

        // Resolve linked designs; failures become "missing" in the plan.
        const loaded: LoadedDesign[] = [];
        for (const id of designIds) {
          const res = await loadDesign(id);
          loaded.push({ id, design: isOk(res) ? res.value : null });
        }

        const fileNameConfig: ExportFileNameConfig = {
          style: 'descriptive',
          customName: '',
          format,
        };
        const plan = planLayoutBinExport(bins, loaded, format, fileNameConfig, printSettings);

        // Phase 1 — bins. The bridge emits STL/STEP; 3MF converts client-side.
        const binBridgeFormat: ExportFormat = format === '3mf' ? 'stl' : format;
        const binParams = plan.exportable.map((e) => e.params);
        const binTotal = binParams.length;
        const binLabel = (current: number): string =>
          t('layoutExport.progress.bins', { current, total: binTotal });
        setExportProgress({ current: 0, total: binTotal, label: binLabel(0) });

        let binBytes: ArrayBuffer[] = [];
        if (binTotal > 0) {
          if (pool && !pool.isDestroyed && pool.size > 1) {
            const results = await pool.exportBins(binParams, binBridgeFormat, (c) =>
              setExportProgress({ current: c, total: binTotal, label: binLabel(c) })
            );
            binBytes = results.map((r) => r.data);
          } else {
            for (let i = 0; i < binParams.length; i++) {
              setExportProgress({ current: i, total: binTotal, label: binLabel(i) });
              const res = await bridge.exportBin(binParams[i], binBridgeFormat);
              binBytes.push(res.data);
            }
            setExportProgress({ current: binTotal, total: binTotal, label: binLabel(binTotal) });
          }
        }

        const binFinal =
          format === '3mf'
            ? await Promise.all(
                binBytes.map((d, i) =>
                  stlTo3mf(d, baseNameOf(plan.exportable[i].path), printSettings)
                )
              )
            : binBytes;

        // Phase 2 — baseplate.
        const bp = await buildBaseplateExportPieces(bridge, pool, {
          baseplateParams: layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
          drawerWidth: layout.drawer.width,
          drawerDepth: layout.drawer.depth,
          gridUnitMm: layout.gridUnitMm,
          fractionalEdgeX: layout.drawer.fractionalEdgeX ?? 'end',
          fractionalEdgeY: layout.drawer.fractionalEdgeY ?? 'end',
          printBedWidthMm: layout.printBedSize,
          printBedDepthMm: layout.printBedDepth ?? layout.printBedSize,
          format,
          splitEnabled: true,
          fileNameConfig,
          printSettings: {
            nozzleSizeMm: printSettings.nozzleSizeMm,
            layerHeightMm: printSettings.layerHeightMm,
            infillPercent: printSettings.infillPercent,
            maxPrintHeightMm: printSettings.maxPrintHeightMm,
          },
          onProgress: (p) =>
            setExportProgress(
              p
                ? {
                    current: p.current,
                    total: p.total,
                    label: t('layoutExport.progress.baseplate', {
                      current: p.current,
                      total: p.total,
                    }),
                  }
                : null
            ),
        });

        // Assemble the archive.
        const binaryFiles: ZipBinaryFile[] = [
          ...plan.exportable.map((e, i) => ({ path: e.path, data: binFinal[i] })),
          ...bp.pieces.map((p) => ({
            path: `baseplate/${p.label ? `${bp.baseNameNoExt}_${p.label}` : bp.baseNameNoExt}${bp.extension}`,
            data: p.data,
          })),
        ];

        const manifest = buildLayoutManifest({
          layoutName: layout.name,
          format,
          bins: plan.manifestBins,
          baseplate: {
            pieceCount: bp.pieces.length,
            guidePath: bp.guideText ? 'baseplate/print-guide.txt' : undefined,
          },
          skipped: plan.skipped,
          totals: plan.totals,
        });

        const textFiles: ZipTextFile[] = [{ name: 'manifest.txt', content: manifest }];
        if (bp.guideText) {
          textFiles.push({ name: 'baseplate/print-guide.txt', content: bp.guideText });
        }

        const zip = packageFilesAsZip(binaryFiles, textFiles);
        triggerDownload(zip, `${zipBaseName}.zip`);
        trackEvent('ui.layoutExported', { format: 'zip', fileFormat: format });
        useToastStore
          .getState()
          .addToast(t('layoutExport.success', { count: plan.exportable.length }), 'success');
        return true;
      } catch (error: unknown) {
        useToastStore.getState().addToast(getErrorMessage(error, 'Export failed'), 'error');
        return false;
      } finally {
        if (pool) workerPoolManager.release();
        bridgeManager.release();
        setIsExporting(false);
        setExportProgress(null);
      }
    },
    [t]
  );

  return { isExporting, exportProgress, exportLayout };
}
