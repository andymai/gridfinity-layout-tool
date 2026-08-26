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
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { trackEvent, trackToolConverted } from '@/shared/analytics/posthog';
import { getErrorMessage } from '@/shared/utils/errors';
import { bridgeManager, workerPoolManager } from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import type { ExportFormat, CombinedExportResult } from '@/shared/generation/bridge';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
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
import {
  buildBaseplateExportPieces,
  BaseplateBedOverageError,
} from '@/features/baseplate/utils/buildBaseplateExportPieces';
import { loadDesign } from '@/features/bin-designer';
import type { BinParams } from '@/features/bin-designer';
// Deep import (not the barrel): the bin-designer barrel is eagerly loaded by App;
// this packaging only runs inside the lazy layout-export chunk.
import {
  buildBinDownloadPayload,
  buildMultiObject3MFObjects,
} from '@/features/bin-designer/utils/binDownloadHelpers';
import { buildThreeMFPrintSettings } from '@/shared/generation/stlTo3mf';
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
import { buildLayoutProjectFile, createProjectPartCollector } from './buildProjectFile';

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

function baseNameOf(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');
}

/**
 * Flatten a combined export (body + lid + dividers) into ZIP files. STL emits a
 * file per piece (`<base>.stl` for the body, `<base>_<part>.stl` for the rest);
 * 3MF packs everything into one multi-object file and STEP into one compound —
 * reusing the bin designer's packaging so colours/orientation match.
 */
/**
 * Format a part file can take. A whole-layout 3MF export is a PROJECT file, so
 * 3MF never reaches the per-part writers; naming that in the type keeps a dead
 * per-part 3MF branch from creeping back in.
 */
type PartFileFormat = Exclude<ExportFileFormat, '3mf'>;

async function combinedFiles(
  result: CombinedExportResult,
  format: PartFileFormat,
  basePath: string,
  params: BinParams
): Promise<ZipBinaryFile[]> {
  if (format === 'stl') {
    const baseNoExt = basePath.replace(/\.[^.]+$/, '');
    return result.pieces.map((p) => ({
      path: p.label === 'bin' ? `${baseNoExt}.stl` : `${baseNoExt}_${p.label}.stl`,
      data: p.data,
    }));
  }

  const { blob } = buildBinDownloadPayload(format, result, params, baseNameOf(basePath), null);
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
    format: workerFormat,
  });

  const baseNoExt = exportable.path.replace(/\.[^.]+$/, '');
  // Split and combined pieces carry different metadata (grid col/row vs none);
  // packaging only needs the bytes and the label.
  const pieces: { data: ArrayBuffer; label: string }[] = result.pieces.map((p) => ({
    data: p.data,
    label: p.label,
  }));

  if (exportable.companions.length > 0) {
    // `separatePieces` matters under STEP: the default compound assembly
    // bundles the bin in with its companions, and the body is already covered
    // by the split pieces above.
    const combined = await bridge.exportCombined(params, workerFormat, { separatePieces: true });
    // The body is already covered by the split pieces — take only the extras.
    for (const p of combined.pieces) {
      if (p.label !== 'bin') pieces.push({ data: p.data, label: p.label });
    }
  }

  return pieces.map((piece) => ({
    path: `${baseNoExt}/${piece.label}.${format}`,
    data: piece.data,
  }));
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

        // A whole-layout 3MF export is a slicer PROJECT: one file holding every
        // part, already packed onto build plates, instead of a pile of models
        // the user arranges by hand. Every phase below still produces plain
        // STL parts (`partFormat`); they are folded into the project file once
        // the file list is complete, so a new part type joins it for free.
        const projectMode = format === '3mf';
        const partFormat: ExportFileFormat = projectMode ? 'stl' : format;

        // Parts destined for the project file. A part joins this collector
        // INSTEAD of the archive, carrying whatever colorConfig its own builder
        // derived.
        const projectParts = createProjectPartCollector();

        // The dialog's custom name applies to the ZIP archive only; inner files
        // fall back to a descriptive style (a single custom name across many
        // files would just collide). Descriptive/compact pass straight through.
        const innerConfig: ExportFileNameConfig =
          fileNameConfig.style === 'custom'
            ? { style: 'descriptive', customName: '', format: partFormat }
            : fileNameConfig;
        const plan = planLayoutBinExport({
          bins,
          loaded,
          format: partFormat,
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
        const workerFormat: ExportFormat = partFormat === 'step' ? 'step' : 'stl';
        const binTotal =
          plan.exportable.length + plan.meshExportable.length + plan.itemExportable.length;
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
            if (projectMode) projectParts.addStl(baseNameOf(simple[i].path), bytes[i]);
            else binFiles.push({ path: simple[i].path, data: bytes[i] });
          }
          done = simple.length;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        for (const e of companions) {
          const result = await bridge.exportCombined(
            withSocketNozzle(e.params, printSettings.nozzleSizeMm),
            workerFormat
          );
          if (projectMode) {
            // Each companion is its own print, so they enter the packer as
            // independent parts rather than as one pre-arranged assembly.
            projectParts.addObjects(
              buildMultiObject3MFObjects(
                result.pieces,
                result.faceGroups,
                e.params,
                result.lidFaceGroups
              )
            );
          } else {
            binFiles.push(...(await combinedFiles(result, partFormat, e.path, e.params)));
          }
          done++;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        // Oversized bins — cut into bed-sized pieces the same way the bin
        // designer's split export does, so the ZIP ships something printable
        // instead of one part that doesn't fit the machine.
        for (const e of splits) {
          if (!e.split) continue;
          const pieces = await splitFiles(
            bridge,
            e,
            e.split,
            partFormat,
            printSettings,
            workerFormat
          );
          if (projectMode) {
            for (const piece of pieces) projectParts.addStl(baseNameOf(piece.path), piece.data);
          } else {
            binFiles.push(...pieces);
          }
          done++;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        // Failed per-design exports (corrupt mesh asset, worker item failure)
        // degrade to a partial archive; their paths drop out of the manifest,
        // totals, and outcome decisions below, and surface in one toast.
        const failedItemPaths = new Set<string>();

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
            if (projectMode) projectParts.addStl(baseNameOf(m.path), stl);
            else binFiles.push({ path: m.path, data: stl });
          } else {
            failedItemPaths.add(m.path);
          }
          done++;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }

        // Phase 1.6 — Workshop assemblies: generated in the worker via the
        // item export path (STEP carries exact BREP, so no format skip).
        for (const a of plan.itemExportable) {
          try {
            const result = await bridge.exportItem(a.item, workerFormat);
            if (projectMode) projectParts.addStl(baseNameOf(a.path), result.data);
            else binFiles.push({ path: a.path, data: result.data });
          } catch {
            failedItemPaths.add(a.path);
          }
          done++;
          setExportProgress({ current: done, total: binTotal, label: binLabel(done) });
        }
        if (failedItemPaths.size > 0) {
          useToastStore
            .getState()
            .addToast(
              failedItemPaths.size === 1
                ? t('layoutExport.itemsFailed.one')
                : t('layoutExport.itemsFailed.other', { count: failedItemPaths.size }),
              'error'
            );
        }

        // Estimates for parts that failed above must not survive into the
        // manifest totals or the 3MF print settings.
        const adjustedTotals = plan.manifestBins
          .filter((b) => failedItemPaths.has(b.path))
          .reduce(
            (acc, b) => ({
              filamentGrams: acc.filamentGrams - b.filamentGrams * b.quantity,
              printTimeMinutes: acc.printTimeMinutes - b.printTimeMinutes * b.quantity,
            }),
            { ...plan.totals }
          );

        // Phase 1.7 — swappable label plates for socket-mode designs:
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
                    }_plates_${si + 1}.${partFormat}`
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
                if (projectMode) {
                  const parsed = parseSTLBinary(result.data);
                  projectParts.addStl(
                    baseNameOf(path),
                    result.data,
                    isOk(parsed)
                      ? buildLabelPlateColorConfig(
                          result.faceGroups,
                          parsed.value.vertices.length / 9,
                          group.featureColors
                        )
                      : undefined
                  );
                } else {
                  labelFiles.push({ path, data: result.data });
                }
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
          format: partFormat,
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

        // Nothing usable — don't ship an empty archive. Meshes and assemblies
        // count: a layout of only those still has bin files worth shipping,
        // minus any item exports that failed above.
        const shippedParts = binTotal - failedItemPaths.size;
        if (shippedParts === 0 && !bp) {
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

        // Pack every collected part onto build plates and seal them into one
        // project file. The baseplate's pieces are gathered here rather than at
        // their phase because they are produced after it. Non-model artefacts
        // (the assembly map) ride along untouched, and a failure keeps whatever
        // individual parts exist rather than shipping an archive with no
        // geometry.
        let projectPlateCount = 0;
        let projectPartCount = 0;
        let projectOversize: readonly string[] = [];
        if (projectMode) {
          if (bp) {
            for (const piece of bp.pieces) {
              projectParts.addStl(
                piece.label ? `${bp.baseNameNoExt}_${piece.label}` : bp.baseNameNoExt,
                piece.data
              );
            }
          }
          try {
            const project = await buildLayoutProjectFile(projectParts.parts, {
              name: zipBaseName,
              bedWidthMm: layout.printBedSize,
              bedDepthMm: layout.printBedDepth ?? layout.printBedSize,
              printSettings: buildThreeMFPrintSettings(printSettings, {
                printTimeMinutes: adjustedTotals.printTimeMinutes,
                gramsFilament: adjustedTotals.filamentGrams,
              }),
            });
            if (project) {
              binaryFiles.length = 0;
              binaryFiles.push(
                { path: `${zipBaseName}.3mf`, data: project.data },
                ...(bp?.assemblyImage
                  ? [{ path: 'baseplate/assembly-map.png', data: bp.assemblyImage }]
                  : [])
              );
              projectPlateCount = project.plateCount;
              projectPartCount = project.partCount;
              projectOversize = project.oversizeNames;
            }
          } catch {
            // Keep the individual parts. A project file that failed to build is
            // a worse outcome than a ZIP of models the user arranges by hand,
            // but an archive with no geometry at all is worse than both.
          }
        }

        const manifest = buildLayoutManifest({
          layoutName: layout.name,
          format,
          bins: plan.manifestBins.filter((b) => !failedItemPaths.has(b.path)),
          baseplate: bp
            ? {
                pieceCount: bp.pieces.length,
                guidePath: bp.guideText ? 'baseplate/print-guide.txt' : undefined,
                imagePath: bp.assemblyImage ? 'baseplate/assembly-map.png' : undefined,
              }
            : null,
          labels: manifestLabels.length > 0 ? manifestLabels : null,
          project:
            projectPlateCount > 0
              ? {
                  fileName: `${zipBaseName}.3mf`,
                  plateCount: projectPlateCount,
                  partCount: projectPartCount,
                  oversizeNames: projectOversize,
                }
              : null,
          skipped: plan.skipped,
          totals: adjustedTotals,
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
        if (shippedParts === 0) {
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
