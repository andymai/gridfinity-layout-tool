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
import { effectiveGridUnitMmY } from '@/core/types';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { isOk, getUserMessage } from '@/core/result';
import { useTranslation } from '@/i18n';
import { trackEvent, trackToolConverted } from '@/shared/analytics/posthog';
import { getErrorMessage } from '@/shared/utils/errors';
import { bridgeManager, workerPoolManager } from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import type { ExportFormat, CombinedExportResult } from '@/shared/generation/bridge';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
import { export3MF } from '@/shared/generation/export';
import type { FaceGroupData } from '@/shared/types/generation';
import type { FeatureColorConfig } from '@/shared/types/bin';
// Deep import (not the barrel): this code only runs inside the lazy
// layout-export chunk (same rationale as planLabelPlateExport's deep imports).
import { buildLabelPlateColorConfig } from '@/features/bin-designer/utils/labelPlateColors';
import { decodeMeshData } from '@/shared/generation/meshAsset';
import { parseSTLBinary } from '@/shared/generation/stlParser';
// Deep import: the STL builder lives in the worker-adjacent export module; the
// generation barrel would pull the whole bridge stack into this chunk.
import { buildSTLBufferFromIndexed } from '@/features/generation/export/stlExporter';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { packageFilesAsZip } from '@/shared/generation/zipExport';
import type { ZipBinaryFile, ZipTextFile } from '@/shared/generation/zipExport';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';
import { buildBaseplateExportPieces, BaseplateBedOverageError } from '@/features/baseplate';
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
import type { LoadedDesign, LayoutExportable, LayoutSplitPlan } from './planLayoutBinExport';
// Deep import (not the barrel): same lazy-chunk rationale as the helpers above.
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { planLabelPlateExport } from './planLabelPlateExport';
import { dedupeFileNames } from './dedupeFileNames';
import { snapTextDepthToLayers } from '@/shared/constants/labelPlates';
import type { LabelPlateExportSpec } from '@/shared/generation/bridge';
import { buildLayoutManifest } from './buildLayoutManifest';
import type { ManifestLabelGroup } from './buildLayoutManifest';

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

/** Convert STL bytes to 3MF bytes (the bridge emits STL only). `plateColors`
 *  adds label-plate paint_color zones (#2666) derived from the worker's face
 *  provenance against the parsed triangle count. */
async function stlTo3mf(
  stl: ArrayBuffer,
  name: string,
  printSettings: { layerHeightMm: number; infillPercent: number },
  plateColors?: {
    faceGroups: readonly FaceGroupData[] | undefined;
    featureColors: FeatureColorConfig | undefined;
  }
): Promise<ArrayBuffer> {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error(getUserMessage(parsed.error));
  const colorConfig = plateColors
    ? buildLabelPlateColorConfig(
        plateColors.faceGroups,
        parsed.value.vertices.length / 9,
        plateColors.featureColors
      )
    : undefined;
  const blob = export3MF(parsed.value.vertices, parsed.value.normals, {
    name,
    colorConfig,
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

/**
 * Cut one oversized bin into bed-sized pieces and flatten them into ZIP files.
 *
 * Every piece becomes its own file — including under 3MF, unlike
 * `combinedFiles`. The pieces are separate prints that get joined afterwards,
 * so packing them into one multi-object 3MF would stack parts on the plate.
 * Companion parts (lid, dividers) come from a second, combined pass because the
 * split export emits body pieces only.
 *
 * Pieces go in their own `bins/<design>/` folder rather than sharing `bins/`
 * with a `_<label>` suffix. Names are deduped before suffixes exist, so a flat
 * `<base>_A1.stl` could collide with another design that generates exactly that
 * name — and `packageFilesAsZip` keys by path, so the loser would vanish from
 * the archive silently. A folder can't collide with a sibling file name, and it
 * also groups the parts a user prints as one job.
 */
async function splitFiles(
  bridge: GenerationBridge,
  exportable: LayoutExportable,
  split: LayoutSplitPlan,
  format: ExportFileFormat,
  printSettings: { layerHeightMm: number; infillPercent: number; nozzleSizeMm: number },
  workerFormat: ExportFormat
): Promise<ZipBinaryFile[]> {
  const params = withSocketNozzle(exportable.params, printSettings.nozzleSizeMm);
  const connectorConfig = {
    ...(exportable.params.splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG),
    nozzleSizeMm: printSettings.nozzleSizeMm,
  };
  const result = await bridge.exportSplitBin(params, split.cutPlanesX, split.cutPlanesY, {
    splitConnectorConfig: connectorConfig,
  });

  const baseNoExt = exportable.path.replace(/\.[^.]+$/, '');
  // Split and combined pieces carry different metadata (grid col/row vs none);
  // packaging only needs the bytes and the label.
  const pieces: { data: ArrayBuffer; label: string }[] = result.pieces.map((p) => ({
    data: p.data,
    label: p.label,
  }));

  if (exportable.companions.length > 0) {
    const combined = await bridge.exportCombined(params, workerFormat);
    // The body is already covered by the split pieces — take only the extras.
    for (const p of combined.pieces) {
      if (p.label !== 'bin') pieces.push({ data: p.data, label: p.label });
    }
  }

  const files: ZipBinaryFile[] = [];
  for (const piece of pieces) {
    const path = `${baseNoExt}/${piece.label}.${format}`;
    // Name the 3MF model after the design plus the piece, not the bare label —
    // "A1" alone in a slicer's object list says nothing about which bin it is.
    const data =
      format === '3mf'
        ? await stlTo3mf(piece.data, `${baseNameOf(baseNoExt)}_${piece.label}`, printSettings)
        : piece.data;
    files.push({ path, data });
  }
  return files;
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
        const plan = planLayoutBinExport({
          bins,
          loaded,
          format,
          fileNameConfig: innerConfig,
          printSettings,
          drawer: layout.drawer,
          baseplate: layout.baseplateParams,
          printBed: {
            widthMm: layout.printBedSize,
            depthMm: layout.printBedDepth ?? layout.printBedSize,
          },
          magnetAnchor: layout.magnetAnchor,
        });

        // Phase 1 — bins. The bridge emits STL/STEP only; 3MF + companion parts
        // are packaged here. Worker format: STEP stays STEP, STL and 3MF both
        // export STL geometry.
        const workerFormat: ExportFormat = format === 'step' ? 'step' : 'stl';
        const binTotal = plan.exportable.length + plan.meshExportable.length;
        const binLabel = (current: number): string =>
          t('layoutExport.progress.bins', { current, total: binTotal });
        setExportProgress({ current: 0, total: binTotal, label: binLabel(0) });

        const binFiles: ZipBinaryFile[] = [];
        // Three routes, in priority order: needing a cut wins over having
        // companions, since a split design gets its companions from a second
        // combined pass anyway. Of the bins that fit whole, body-only designs
        // export in parallel via the pool while designs with a lid or removable
        // dividers go through the (non-poolable) combined flow. Execution order
        // below is pool-first — the parallel batch should not wait behind the
        // sequential ones.
        const splits = plan.exportable.filter((e) => e.split !== null);
        const whole = plan.exportable.filter((e) => e.split === null);
        const simple = whole.filter((e) => e.companions.length === 0);
        const companions = whole.filter((e) => e.companions.length > 0);
        let done = 0;

        if (simple.length > 0) {
          // Scale each socket bin's pocket to the live nozzle (transient — never
          // persisted). No-op for non-socket designs.
          const params = simple.map((e) => withSocketNozzle(e.params, printSettings.nozzleSizeMm));
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
          const result = await bridge.exportCombined(
            withSocketNozzle(e.params, printSettings.nozzleSizeMm),
            workerFormat
          );
          binFiles.push(...(await combinedFiles(result, format, e.path, e.params, printSettings)));
          done++;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        // Oversized bins — cut into bed-sized pieces the same way the bin
        // designer's split export does, so the ZIP ships something printable
        // instead of one part that doesn't fit the machine (#3074).
        for (const e of splits) {
          if (!e.split) continue;
          binFiles.push(
            ...(await splitFiles(bridge, e, e.split, format, printSettings, workerFormat))
          );
          done++;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        // Phase 1.5 — imported-mesh designs: the stored asset IS the geometry,
        // decoded and re-serialized here on the main thread (no worker slot
        // needed). Plan already excludes these under STEP. A single corrupt
        // asset skips that design rather than aborting the whole archive.
        for (const m of plan.meshExportable) {
          const decoded = await decodeMeshData(m.asset.data);
          if (isOk(decoded)) {
            const stl = buildSTLBufferFromIndexed(
              decoded.value.positions,
              new Float32Array(0),
              decoded.value.indices,
              baseNameOf(m.path)
            );
            const data =
              format === '3mf' ? await stlTo3mf(stl, baseNameOf(m.path), printSettings) : stl;
            binFiles.push({ path: m.path, data });
          }
          done++;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        // Phase 1.7 — swappable label plates for socket-mode designs (#2666):
        // per-design bed-sized sheets in labels/. A plate failure must not
        // lose a good bin export, so it degrades to an archive without labels.
        const platePlan = planLabelPlateExport(
          bins,
          loaded,
          layout.printBedSize,
          layout.printBedDepth ?? layout.printBedSize,
          printSettings.nozzleSizeMm
        );
        const labelFiles: ZipBinaryFile[] = [];
        const manifestLabels: ManifestLabelGroup[] = [];
        if (platePlan.groups.length > 0) {
          try {
            const sheetNames = dedupeFileNames(
              platePlan.groups.flatMap((g) =>
                g.sheets.map(
                  (_, si) =>
                    `${
                      g.designName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '') || 'design'
                    }_plates_${si + 1}.${format}`
                )
              )
            );
            let nameIndex = 0;
            let sheetsDone = 0;
            const sheetTotal = platePlan.groups.reduce((sum, g) => sum + g.sheets.length, 0);
            const sheetLabel = (current: number): string =>
              t('layoutExport.progress.labels', { current, total: sheetTotal });
            if (sheetTotal > 0) {
              setExportProgress({ current: 0, total: sheetTotal, label: sheetLabel(0) });
            }
            for (const group of platePlan.groups) {
              const options = {
                textMode:
                  group.textDefaults.mode === 'emboss' ? ('emboss' as const) : ('deboss' as const),
                textDepthMm: snapTextDepthToLayers(
                  group.textDefaults.depth,
                  printSettings.layerHeightMm
                ),
                textDefaults: group.textDefaults,
                v1Channels: true,
              };
              const sheetPaths: string[] = [];
              for (const sheet of group.sheets) {
                const path = `labels/${sheetNames[nameIndex++]}`;
                const specs: LabelPlateExportSpec[] = sheet.map((p) => ({
                  widthU: p.widthU,
                  text: p.text,
                  icon: p.icon,
                  position: p.position,
                }));
                const result = await bridge.exportLabelPlates(specs, options, workerFormat);
                const data =
                  format === '3mf'
                    ? await stlTo3mf(result.data, baseNameOf(path), printSettings, {
                        faceGroups: result.faceGroups,
                        featureColors: group.featureColors,
                      })
                    : result.data;
                labelFiles.push({ path, data });
                sheetPaths.push(path);
                sheetsDone++;
                setExportProgress({
                  current: sheetsDone,
                  total: sheetTotal,
                  label: sheetLabel(sheetsDone),
                });
              }
              manifestLabels.push({
                designName: group.designName,
                sheetPaths,
                plates: group.manifestPlates,
                oversizedCount: group.oversizedCount,
              });
            }
          } catch {
            labelFiles.length = 0;
            manifestLabels.length = 0;
          }
        }

        // Phase 2 — baseplate. A baseplate failure (e.g. a degenerate drawer)
        // must not lose a good bin export, so it degrades to a bins-only archive.
        let baseplateError: unknown = null;
        const bp = await buildBaseplateExportPieces(bridge, pool, {
          baseplateParams: layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
          drawerWidth: layout.drawer.width,
          drawerDepth: layout.drawer.depth,
          drawerOutline: layout.drawer.outline,
          gridUnitMm: layout.gridUnitMm,
          gridUnitMmY: effectiveGridUnitMmY(layout),
          magnetAnchor: layout.magnetAnchor,
          fractionalEdgeX: layout.drawer.fractionalEdgeX ?? 'end',
          fractionalEdgeY: layout.drawer.fractionalEdgeY ?? 'end',
          gridShiftX: layout.drawer.gridShiftX ?? 0,
          gridShiftY: layout.drawer.gridShiftY ?? 0,
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
        }).catch((error: unknown) => {
          // Keep the reason: an over-bed custom split is a fixable user mistake,
          // and the generic bins-only notice would not say which pieces or why.
          baseplateError = error;
          return null;
        });

        // Nothing usable — don't ship an empty archive.
        if (plan.exportable.length === 0 && !bp) {
          useToastStore.getState().addToast(t('layoutExport.nothingToExport'), 'error');
          return false;
        }

        // Assemble the archive.
        const binaryFiles: ZipBinaryFile[] = [
          ...binFiles,
          ...labelFiles,
          ...(bp
            ? bp.pieces.map((p) => ({
                path: `baseplate/${p.label ? `${bp.baseNameNoExt}_${p.label}` : bp.baseNameNoExt}${bp.extension}`,
                data: p.data,
              }))
            : []),
          ...(bp?.assemblyImage
            ? [{ path: 'baseplate/assembly-map.png', data: bp.assemblyImage }]
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
                imagePath: bp.assemblyImage ? 'baseplate/assembly-map.png' : undefined,
              }
            : null,
          labels: manifestLabels.length > 0 ? manifestLabels : null,
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
        trackToolConverted('layout', { format, piece_count: binaryFiles.length });

        // Report what actually made it into the archive.
        const addToast = useToastStore.getState().addToast;
        if (plan.exportable.length === 0) {
          addToast(t('layoutExport.baseplateOnly'), 'info');
        } else if (!bp) {
          addToast(
            baseplateError instanceof BaseplateBedOverageError
              ? t('layoutExport.baseplateOverBed', {
                  pieces: baseplateError.pieceLabels.join(', '),
                })
              : t('layoutExport.binsOnly'),
            'info'
          );
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
