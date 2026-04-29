/**
 * Export hook for the bin designer.
 *
 * Manages export lifecycle: generates high-quality mesh via worker,
 * triggers browser download, and computes live print estimates.
 *
 * Supports STL (binary mesh), STEP (exact BREP), and 3MF (mesh + metadata).
 * When a bin has removable dividers, they are automatically included:
 * - 3MF: multiple named objects (bin + per-axis dividers) in one file
 * - STEP: compound assembly with bin + divider parts
 * - STL: ZIP archive with separate files per piece
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { calcMaxGridUnits } from '@/core/constants';
import { getActiveBridge, workerPoolManager } from '@/shared/generation/bridge';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import { getSplitPieceCount, getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { export3MF, export3MFMultiObject } from '@/shared/generation/export';
import { parseSTLBinary } from '@/features/bin-designer/utils/stlParser';
import { isErr, getUserMessage } from '@/core/result';
import type { ThreeMFColorConfig, ThreeMFObject } from '@/shared/generation/export';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { isFeatureEnabled } from '@/shared/hooks/useFeatureFlag';
import { buildTriangleMaterialIndices } from '@/features/bin-designer/utils/materialMapping';
import type { ExportFileNameConfig, ExportFileFormat } from '@/features/bin-designer/types';
import type { PrintEstimate } from '@/features/bin-designer/utils/printEstimates';
import { shouldGenerateLid } from '@/features/bin-designer/utils/lidCompatibility';

/** Map piece labels from the worker to descriptive display names for 3MF/STEP. */
function formatPieceDisplayName(
  label: string,
  params: { width: number; depth: number; height: number }
): string {
  const dims = `${params.width}x${params.depth}x${params.height}`;
  switch (label) {
    case 'bin':
      return `Bin ${dims}`;
    case 'lid':
      return `Lid ${dims}`;
    case 'divider-horizontal':
      return 'Divider Horizontal';
    case 'divider-vertical':
      return 'Divider Vertical';
    case 'assembly':
      return `Bin ${dims} Assembly`;
    default:
      return label;
  }
}

interface UseExportReturn {
  /** Whether a main bin or split export is currently in progress */
  readonly isExportingBin: boolean;
  /** Whether any export is currently in progress */
  readonly isExporting: boolean;
  /** Whether mesh data is available for export (bridge active + mesh exists) */
  readonly canExport: boolean;
  /** Current print estimates based on params */
  readonly estimates: PrintEstimate;
  /** Download bin (and dividers if present) in the specified format */
  readonly downloadBin: (
    format: ExportFileFormat,
    config: ExportFileNameConfig,
    designName?: string
  ) => Promise<void>;
  /** Whether the bin has exportable dividers (used for display extension) */
  readonly hasDividers: boolean;
  /** Whether the bin exceeds print bed and needs splitting */
  readonly needsSplit: boolean;
  /** Number of pieces the bin would be split into */
  readonly splitPieceCount: number;
  /** Maximum grid units that fit on the print bed */
  readonly maxGridUnits: { width: number; depth: number };
  /** Trigger split export download as ZIP via worker bridge */
  readonly downloadSplit: (
    format: ExportFileFormat,
    config: ExportFileNameConfig,
    designName?: string
  ) => Promise<void>;
}

export function useExport(): UseExportReturn {
  const { params, mesh } = useDesignerStore(
    useShallow((state) => ({
      params: state.params,
      mesh: state.generation.mesh,
    }))
  );

  const { printSettings, defaultPrintBedSize, defaultPrintBedDepth } = useSettingsStore(
    useShallow((s) => ({
      printSettings: s.settings.printSettings,
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultPrintBedDepth: s.settings.defaultPrintBedDepth,
    }))
  );

  const [isExportingBin, setIsExportingBin] = useState(false);
  const isExporting = isExportingBin;

  // Export requires both a preview mesh (to show UI) and an active bridge (to regenerate)
  const canExport =
    mesh !== null && mesh.vertices !== null && mesh.error === null && getActiveBridge() !== null;

  const hasDividers =
    params.style === 'slotted' && (params.slotConfig.x.enabled || params.slotConfig.y.enabled);
  const hasLid = shouldGenerateLid(params);

  const estimates = useMemo(() => estimatePrint(params, printSettings), [params, printSettings]);

  // Split detection — use params.gridUnitMm (the bin's actual grid unit)
  // rather than defaultGridUnitMm from settings, which may be stale
  const maxGrid = useMemo(
    () => calcMaxGridUnits(defaultPrintBedSize, params.gridUnitMm, defaultPrintBedDepth),
    [defaultPrintBedSize, defaultPrintBedDepth, params.gridUnitMm]
  );

  const needsSplit = params.width > maxGrid.width || params.depth > maxGrid.depth;

  const splitPieceCount = useMemo(
    () =>
      needsSplit ? getSplitPieceCount(params.width, params.depth, maxGrid.width, maxGrid.depth) : 1,
    [params.width, params.depth, maxGrid.width, maxGrid.depth, needsSplit]
  );

  /**
   * Download bin + dividers (if present) in the specified format.
   *
   * Uses the combined export worker message to get all pieces in one call.
   * Packaging varies by format:
   * - 3MF: multi-object file with named pieces
   * - STEP: compound assembly (single file)
   * - STL + no dividers: plain .stl
   * - STL + dividers: .zip with separate .stl files
   */
  const downloadBin = useCallback(
    async (format: ExportFileFormat, config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExportingBin(true);

      try {
        const fileName = generateFileName(params, format, config, designName);

        if (format === '3mf') {
          // Combined export as STL (worker doesn't know 3MF), then package on main thread
          const result = await bridge.exportCombined(params, 'stl');

          // Read print settings at call time to avoid capturing reactive values
          const currentPrintSettings = useSettingsStore.getState().settings.printSettings;
          const currentEstimates = estimatePrint(params, currentPrintSettings);

          const threeMFPrintSettings = {
            layerHeight: currentPrintSettings.layerHeightMm,
            infillPercent: currentPrintSettings.infillPercent,
            material: 'PLA' as const,
            supportRequired: false,
            estimatedMinutes: currentEstimates.printTimeMinutes,
            estimatedGrams: currentEstimates.gramsFilament,
          };

          const modelName =
            designName ?? `gridfinity-${params.width}x${params.depth}x${params.height}`;

          if (result.pieces.length === 1) {
            // Single piece (no dividers) — use existing single-object 3MF
            const parseResult = parseSTLBinary(result.pieces[0].data);
            if (isErr(parseResult)) {
              throw new Error(getUserMessage(parseResult.error));
            }
            const { vertices, normals } = parseResult.value;

            // Build multi-color config when Labs flag is enabled
            let colorConfig: ThreeMFColorConfig | undefined;
            // result.faceGroups & params.featureColors are typed as non-null
            // here, but the runtime guard is intentional belt-and-suspenders
            // against shape drift in the generation pipeline.
            /* eslint-disable @typescript-eslint/no-unnecessary-condition */
            if (
              isFeatureEnabled('multi_color_export') &&
              result.faceGroups &&
              params.featureColors
            ) {
              /* eslint-enable @typescript-eslint/no-unnecessary-condition */
              const triangleCount = vertices.length / 9;
              colorConfig =
                buildTriangleMaterialIndices(
                  result.faceGroups,
                  params.featureColors,
                  triangleCount
                ) ?? undefined;
            }

            const blob = export3MF(vertices, normals, {
              name: modelName,
              colorConfig,
              printSettings: threeMFPrintSettings,
            });
            triggerDownload(blob, fileName);
          } else {
            // Multiple pieces — multi-object 3MF
            const objects: ThreeMFObject[] = [];

            for (let i = 0; i < result.pieces.length; i++) {
              const piece = result.pieces[i];
              const parseResult = parseSTLBinary(piece.data);
              if (isErr(parseResult)) {
                throw new Error(getUserMessage(parseResult.error));
              }

              // Only apply color config to the bin piece (first piece)
              let colorConfig: ThreeMFColorConfig | undefined;
              // result.faceGroups & params.featureColors are typed as non-null
              // here, but the runtime guard mirrors the single-piece branch
              // above as belt-and-suspenders against pipeline shape drift.
              /* eslint-disable @typescript-eslint/no-unnecessary-condition */
              if (
                i === 0 &&
                isFeatureEnabled('multi_color_export') &&
                result.faceGroups &&
                params.featureColors
              ) {
                /* eslint-enable @typescript-eslint/no-unnecessary-condition */
                const triangleCount = parseResult.value.vertices.length / 9;
                colorConfig =
                  buildTriangleMaterialIndices(
                    result.faceGroups,
                    params.featureColors,
                    triangleCount
                  ) ?? undefined;
              }

              objects.push({
                vertices: parseResult.value.vertices,
                normals: parseResult.value.normals,
                name: formatPieceDisplayName(piece.label, params),
                colorConfig,
              });
            }

            const blob = export3MFMultiObject(objects, {
              name: modelName,
              printSettings: threeMFPrintSettings,
            });
            triggerDownload(blob, fileName);
          }
        } else if (format === 'step') {
          // STEP: worker returns compound assembly as single piece
          const result = await bridge.exportCombined(params, 'step');
          const blob = new Blob([result.pieces[0].data], { type: FORMAT_MIME_TYPES.step });
          triggerDownload(blob, fileName);
        } else {
          // STL
          const result = await bridge.exportCombined(params, 'stl');

          if (result.pieces.length === 1) {
            // Single-piece (no dividers, no lid) → plain STL
            const blob = new Blob([result.pieces[0].data], { type: FORMAT_MIME_TYPES.stl });
            triggerDownload(blob, fileName);
          } else {
            // Multi-piece (dividers and/or lid) → ZIP of separate STLs
            const baseName = fileName.replace(/\.stl$/, '');
            const zip = await packagePiecesAsZip(
              result.pieces.map((p) => ({ data: p.data, label: p.label })),
              baseName,
              '.stl'
            );
            triggerDownload(zip, `${baseName}.zip`);
          }
        }
      } finally {
        setIsExportingBin(false);
      }
    },
    [params]
  );

  /**
   * Download split export as ZIP via worker bridge.
   * Computes cut planes, sends to worker for boolean splitting,
   * then packages results into a ZIP archive.
   * When dividers are present, includes divider pieces in the ZIP.
   * Uses worker pool for parallel export when available.
   * Supports STL and 3MF formats (STEP is not supported for split export).
   * NOTE: Multi-color data is NOT propagated to split pieces — each piece
   * exports as single-color. Split + multi-color is a known gap.
   */
  const downloadSplit = useCallback(
    async (format: ExportFileFormat, config: ExportFileNameConfig, designName?: string) => {
      if (format === 'step') return; // STEP does not support split export

      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExportingBin(true);

      try {
        const gridSizeMm = params.gridUnitMm;
        const cutPlanesX = getSplitPlanePositionsMm(params.width, maxGrid.width, gridSizeMm);
        const cutPlanesY = getSplitPlanePositionsMm(params.depth, maxGrid.depth, gridSizeMm);
        const connectorConfig = params.splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG;
        const totalPieceCount = getSplitPieceCount(
          params.width,
          params.depth,
          maxGrid.width,
          maxGrid.depth
        );

        let result;
        let poolAcquired = false;
        try {
          const pool = await workerPoolManager.acquire();
          poolAcquired = true;
          if (pool.size > 1) {
            result = await pool.exportSplitBin(params, cutPlanesX, cutPlanesY, totalPieceCount, {
              splitConnectorConfig: connectorConfig,
            });
          } else {
            workerPoolManager.release();
            poolAcquired = false;
            result = await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY, {
              splitConnectorConfig: connectorConfig,
            });
          }
        } catch {
          if (poolAcquired) {
            workerPoolManager.release();
            poolAcquired = false;
          }
          // Pool unavailable — fall back to single bridge
          result = await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY, {
            splitConnectorConfig: connectorConfig,
          });
        } finally {
          if (poolAcquired) workerPoolManager.release();
        }

        // Generate base filename (without extension)
        const baseName = generateFileName(params, format, config, designName).replace(
          /\.[^.]+$/,
          ''
        );

        // Collect non-bin companion pieces (dividers, lid) — split export
        // produces only bin pieces, so any extras come from a parallel
        // combined export.
        const companionPieces: { data: ArrayBuffer; label: string }[] = [];
        if (hasDividers || hasLid) {
          const combinedResult = await bridge.exportCombined(params, 'stl');
          for (const piece of combinedResult.pieces) {
            if (piece.label !== 'bin') {
              companionPieces.push({ data: piece.data, label: piece.label });
            }
          }
        }

        if (format === '3mf') {
          // Convert each STL piece (split bin pieces + companion pieces) to 3MF
          const currentPrintSettings = useSettingsStore.getState().settings.printSettings;
          const currentEstimates = estimatePrint(params, currentPrintSettings);
          const threeMFPrintSettings = {
            layerHeight: currentPrintSettings.layerHeightMm,
            infillPercent: currentPrintSettings.infillPercent,
            material: 'PLA' as const,
            supportRequired: false,
            estimatedMinutes: currentEstimates.printTimeMinutes,
            estimatedGrams: currentEstimates.gramsFilament,
          };

          const allInputPieces = [
            ...result.pieces.map((p) => ({ data: p.data, label: p.label })),
            ...companionPieces,
          ];
          const convertedPieces: { data: ArrayBuffer; label: string }[] = [];
          for (const piece of allInputPieces) {
            const parseResult = parseSTLBinary(piece.data);
            if (isErr(parseResult)) {
              throw new Error(getUserMessage(parseResult.error));
            }
            const { vertices, normals } = parseResult.value;
            const blob = export3MF(vertices, normals, {
              name: `${baseName}_${piece.label}`,
              printSettings: threeMFPrintSettings,
            });
            convertedPieces.push({ data: await blob.arrayBuffer(), label: piece.label });
          }

          const zip = await packagePiecesAsZip(convertedPieces, baseName, '.3mf');
          triggerDownload(zip, `${baseName}_split.zip`);
        } else {
          // STL: package split pieces + companion pieces (dividers, lid) into ZIP
          const allPieces = [
            ...result.pieces.map((p) => ({ data: p.data, label: p.label })),
            ...companionPieces,
          ];
          const blob = await packagePiecesAsZip(allPieces, baseName, '.stl');
          triggerDownload(blob, `${baseName}_split.zip`);
        }
      } finally {
        setIsExportingBin(false);
      }
    },
    [params, maxGrid, hasDividers, hasLid]
  );

  return {
    isExporting,
    isExportingBin,
    canExport,
    hasDividers,
    estimates,
    downloadBin,
    needsSplit,
    splitPieceCount,
    maxGridUnits: maxGrid,
    downloadSplit,
  };
}
