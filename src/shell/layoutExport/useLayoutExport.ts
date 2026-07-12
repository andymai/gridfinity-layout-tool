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
import type { ExportFormat, CombinedExportResult } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { packageFilesAsZip } from '@/shared/generation/zipExport';
import type { ZipBinaryFile, ZipTextFile } from '@/shared/generation/zipExport';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';
import { buildBaseplateExportPieces } from '@/features/baseplate';
import { loadDesign } from '@/features/bin-designer';
import type { BinParams } from '@/features/bin-designer';
// Deep import (not the barrel): the bin-designer barrel is eagerly loaded by App;
// this packaging only runs inside the lazy layout-export chunk.
import {
  buildBinDownloadPayload,
  buildThreeMFPrintSettings,
} from '@/features/bin-designer/utils/binDownloadHelpers';
import { getLinkedDesignIds } from '@/features/design-linking';
import { planLayoutBinExport } from './planLayoutBinExport';
import type { LoadedDesign } from './planLayoutBinExport';
import { buildLayoutManifest } from './buildLayoutManifest';

type Progress = { current: number; total: number; label?: string } | null;

interface UseLayoutExportReturn {
  readonly isExporting: boolean;
  readonly exportProgress: Progress;
  /** Export the active layout's linked bins + baseplate as a ZIP named `${zipBaseName}.zip`. */
  readonly exportLayout: (
    format: ExportFileFormat,
    zipBaseName: string,
    fileNameConfig: ExportFileNameConfig
  ) => Promise<boolean>;
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

/**
 * Flatten a combined export (body + lid + dividers) into ZIP files. STL emits a
 * file per piece (`<base>.stl` for the body, `<base>_<part>.stl` for the rest);
 * 3MF packs everything into one multi-object file and STEP into one compound —
 * reusing the bin designer's packaging so colours/orientation match.
 */
async function combinedFiles(
  result: CombinedExportResult,
  format: ExportFileFormat,
  basePath: string,
  params: BinParams,
  printSettings: { layerHeightMm: number; infillPercent: number }
): Promise<ZipBinaryFile[]> {
  if (format === 'stl') {
    const baseNoExt = basePath.replace(/\.[^.]+$/, '');
    return result.pieces.map((p) => ({
      path: p.label === 'bin' ? `${baseNoExt}.stl` : `${baseNoExt}_${p.label}.stl`,
      data: p.data,
    }));
  }

  const name = baseNameOf(basePath);
  const threeMFContext =
    format === '3mf'
      ? {
          modelName: name,
          threeMFPrintSettings: buildThreeMFPrintSettings(printSettings, {
            printTimeMinutes: 0,
            gramsFilament: 0,
          }),
        }
      : null;
  const { blob } = buildBinDownloadPayload(format, result, params, name, threeMFContext);
  return [{ path: basePath, data: await blob.arrayBuffer() }];
}

export function useLayoutExport(): UseLayoutExportReturn {
  const t = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<Progress>(null);

  const exportLayout = useCallback(
    async (
      format: ExportFileFormat,
      zipBaseName: string,
      fileNameConfig: ExportFileNameConfig
    ): Promise<boolean> => {
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

        // The dialog's custom name applies to the ZIP archive only; inner files
        // fall back to a descriptive style (a single custom name across many
        // files would just collide). Descriptive/compact pass straight through.
        const innerConfig: ExportFileNameConfig =
          fileNameConfig.style === 'custom'
            ? { style: 'descriptive', customName: '', format }
            : fileNameConfig;
        const plan = planLayoutBinExport(
          bins,
          loaded,
          format,
          innerConfig,
          printSettings,
          layout.drawer,
          layout.baseplateParams,
          layout.magnetAnchor
        );

        // Phase 1 — bins. The bridge emits STL/STEP only; 3MF + companion parts
        // are packaged here. Worker format: STEP stays STEP, STL and 3MF both
        // export STL geometry.
        const workerFormat: ExportFormat = format === 'step' ? 'step' : 'stl';
        const binTotal = plan.exportable.length;
        const binLabel = (current: number): string =>
          t('layoutExport.progress.bins', { current, total: binTotal });
        setExportProgress({ current: 0, total: binTotal, label: binLabel(0) });

        const binFiles: ZipBinaryFile[] = [];
        // Body-only designs export in parallel via the pool; designs with a lid
        // or removable dividers go through the (non-poolable) combined flow.
        const simple = plan.exportable.filter((e) => e.companions.length === 0);
        const companions = plan.exportable.filter((e) => e.companions.length > 0);
        let done = 0;

        if (simple.length > 0) {
          const params = simple.map((e) => e.params);
          let bytes: ArrayBuffer[];
          if (pool && !pool.isDestroyed && pool.size > 1) {
            const results = await pool.exportBins(params, workerFormat, (c) =>
              setExportProgress({ current: c, total: binTotal, label: binLabel(c) })
            );
            bytes = results.map((r) => r.data);
          } else {
            bytes = [];
            for (let i = 0; i < params.length; i++) {
              setExportProgress({ current: i, total: binTotal, label: binLabel(i) });
              bytes.push((await bridge.exportBin(params[i], workerFormat)).data);
            }
          }
          for (let i = 0; i < simple.length; i++) {
            const data =
              format === '3mf'
                ? await stlTo3mf(bytes[i], baseNameOf(simple[i].path), printSettings)
                : bytes[i];
            binFiles.push({ path: simple[i].path, data });
          }
          done = simple.length;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        for (const e of companions) {
          const result = await bridge.exportCombined(e.params, workerFormat);
          binFiles.push(...(await combinedFiles(result, format, e.path, e.params, printSettings)));
          done++;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        // Phase 2 — baseplate. A baseplate failure (e.g. a degenerate drawer)
        // must not lose a good bin export, so it degrades to a bins-only archive.
        const bp = await buildBaseplateExportPieces(bridge, pool, {
          baseplateParams: layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
          drawerWidth: layout.drawer.width,
          drawerDepth: layout.drawer.depth,
          drawerOutline: layout.drawer.outline,
          gridUnitMm: layout.gridUnitMm,
          magnetAnchor: layout.magnetAnchor,
          fractionalEdgeX: layout.drawer.fractionalEdgeX ?? 'end',
          fractionalEdgeY: layout.drawer.fractionalEdgeY ?? 'end',
          printBedWidthMm: layout.printBedSize,
          printBedDepthMm: layout.printBedDepth ?? layout.printBedSize,
          format,
          splitEnabled: true,
          fileNameConfig: innerConfig,
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
        }).catch(() => null);

        // Nothing usable — don't ship an empty archive.
        if (plan.exportable.length === 0 && !bp) {
          useToastStore.getState().addToast(t('layoutExport.nothingToExport'), 'error');
          return false;
        }

        // Assemble the archive.
        const binaryFiles: ZipBinaryFile[] = [
          ...binFiles,
          ...(bp
            ? bp.pieces.map((p) => ({
                path: `baseplate/${p.label ? `${bp.baseNameNoExt}_${p.label}` : bp.baseNameNoExt}${bp.extension}`,
                data: p.data,
              }))
            : []),
        ];

        const manifest = buildLayoutManifest({
          layoutName: layout.name,
          format,
          bins: plan.manifestBins,
          baseplate: bp
            ? {
                pieceCount: bp.pieces.length,
                guidePath: bp.guideText ? 'baseplate/print-guide.txt' : undefined,
              }
            : null,
          skipped: plan.skipped,
          totals: plan.totals,
        });

        const textFiles: ZipTextFile[] = [{ name: 'manifest.txt', content: manifest }];
        if (bp?.guideText) {
          textFiles.push({ name: 'baseplate/print-guide.txt', content: bp.guideText });
        }

        const zip = packageFilesAsZip(binaryFiles, textFiles);
        triggerDownload(zip, `${zipBaseName}.zip`);
        trackEvent('ui.layoutExported', { format: 'zip', fileFormat: format });

        // Report what actually made it into the archive.
        const addToast = useToastStore.getState().addToast;
        if (plan.exportable.length === 0) {
          addToast(t('layoutExport.baseplateOnly'), 'info');
        } else if (!bp) {
          addToast(t('layoutExport.binsOnly'), 'info');
        } else {
          addToast(t('layoutExport.success'), 'success');
        }
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
