/**
 * Export hook for the bin designer.
 *
 * Manages export lifecycle: generates high-quality mesh via worker,
 * triggers browser download, and computes live print estimates.
 *
 * Supports STL (binary mesh), STEP (exact BREP), and 3MF (mesh + metadata).
 * STL/STEP export goes directly through the BREP worker.
 * 3MF export uses worker-generated STL data, parses it back into mesh arrays,
 * then packages via threemfExporter with embedded print metadata.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { calcMaxGridUnits } from '@/core/constants';
import { getActiveBridge } from '@/shared/generation/bridge';
import {
  generateFileName,
  generateDividerFileName,
} from '@/features/bin-designer/utils/fileNaming';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import {
  getSplitPieceCount,
  getSplitPlanePositionsMm,
} from '@/features/bin-designer/utils/splitPositions';
import { packageSplitPiecesAsZip } from '@/features/bin-designer/utils/splitExport';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/features/bin-designer/utils/stlParser';
import { isErr, getUserMessage } from '@/core/result';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { ExportFileNameConfig, ExportFileFormat } from '@/features/bin-designer/types';
import type { PrintEstimate } from '@/features/bin-designer/utils/printEstimates';

interface UseExportReturn {
  /** Whether a main bin or split export is currently in progress */
  readonly isExportingBin: boolean;
  /** Whether a dividers export is currently in progress */
  readonly isExportingDividers: boolean;
  /** Whether any export is currently in progress */
  readonly isExporting: boolean;
  /** Whether mesh data is available for export (bridge active + mesh exists) */
  readonly canExport: boolean;
  /** Current print estimates based on params */
  readonly estimates: PrintEstimate;
  /** Download the bin in the specified format (STL, STEP, or 3MF) */
  readonly downloadBin: (
    format: ExportFileFormat,
    config: ExportFileNameConfig,
    designName?: string
  ) => Promise<void>;
  /** Trigger divider pieces STL download (slotted bins only) */
  readonly downloadDividersSTL: (
    config: ExportFileNameConfig,
    designName?: string
  ) => Promise<void>;
  /** Whether divider export is available */
  readonly canExportDividers: boolean;
  /** Whether the bin exceeds print bed and needs splitting */
  readonly needsSplit: boolean;
  /** Number of pieces the bin would be split into */
  readonly splitPieceCount: number;
  /** Maximum grid units that fit on the print bed */
  readonly maxGridUnits: number;
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

  const { printSettings, defaultPrintBedSize, defaultGridUnitMm } = useSettingsStore(
    useShallow((s) => ({
      printSettings: s.settings.printSettings,
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultGridUnitMm: s.settings.defaultGridUnitMm,
    }))
  );

  const [isExportingBin, setIsExportingBin] = useState(false);
  const [isExportingDividers, setIsExportingDividers] = useState(false);
  const isExporting = isExportingBin || isExportingDividers;

  // Export requires both a preview mesh (to show UI) and an active bridge (to regenerate)
  const canExport =
    mesh !== null && mesh.vertices !== null && mesh.error === null && getActiveBridge() !== null;

  const canExportDividers =
    canExport &&
    params.style === 'slotted' &&
    (params.slotConfig.x.enabled || params.slotConfig.y.enabled);

  const estimates = useMemo(() => estimatePrint(params, printSettings), [params, printSettings]);

  // Split detection
  const maxGridUnits = useMemo(
    () => calcMaxGridUnits(defaultPrintBedSize, defaultGridUnitMm),
    [defaultPrintBedSize, defaultGridUnitMm]
  );

  const needsSplit = params.width > maxGridUnits || params.depth > maxGridUnits;

  const splitPieceCount = useMemo(
    () => (needsSplit ? getSplitPieceCount(params.width, params.depth, maxGridUnits) : 1),
    [params.width, params.depth, maxGridUnits, needsSplit]
  );

  /**
   * Download the bin in the specified format.
   *
   * STL/STEP: Direct worker export via bridge.exportBin().
   * 3MF: Worker generates STL → parse into mesh arrays → package as 3MF with print metadata.
   */
  const downloadBin = useCallback(
    async (format: ExportFileFormat, config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExportingBin(true);

      try {
        const fileName = generateFileName(params, format, config, designName);

        if (format === '3mf') {
          // 3MF: get high-quality STL from worker, parse, then package as 3MF
          const stlResult = await bridge.exportBin(params, 'stl');
          const parseResult = parseSTLBinary(stlResult.data);
          if (isErr(parseResult)) {
            throw new Error(getUserMessage(parseResult.error));
          }
          const { vertices, normals } = parseResult.value;

          // Read print settings at call time to avoid capturing reactive values
          const currentPrintSettings = useSettingsStore.getState().settings.printSettings;
          const currentEstimates = estimatePrint(params, currentPrintSettings);

          const blob = export3MF(vertices, normals, {
            name: designName ?? `gridfinity-${params.width}x${params.depth}x${params.height}`,
            printSettings: {
              layerHeight: currentPrintSettings.layerHeightMm,
              infillPercent: currentPrintSettings.infillPercent,
              material: 'PLA',
              supportRequired: false,
              estimatedMinutes: currentEstimates.printTimeMinutes,
              estimatedGrams: currentEstimates.gramsFilament,
            },
          });

          triggerDownload(blob, fileName);
        } else {
          // STL or STEP: direct worker export
          const result = await bridge.exportBin(params, format);
          const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
          triggerDownload(blob, fileName);
        }
      } finally {
        setIsExportingBin(false);
      }
    },
    [params]
  );

  /**
   * Download divider pieces as a combined STL via worker bridge.
   */
  const downloadDividersSTL = useCallback(
    async (config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExportingDividers(true);

      try {
        const result = await bridge.exportDividers(params);
        const fileName = generateDividerFileName(params, config, designName);
        const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES.stl });
        triggerDownload(blob, fileName);
      } finally {
        setIsExportingDividers(false);
      }
    },
    [params]
  );

  /**
   * Download split export as ZIP via worker bridge.
   * Computes cut planes, sends to worker for boolean splitting,
   * then packages results into a ZIP archive.
   * Supports STL and 3MF formats (STEP is not supported for split export).
   */
  const downloadSplit = useCallback(
    async (format: ExportFileFormat, config: ExportFileNameConfig, designName?: string) => {
      if (format === 'step') return; // STEP does not support split export

      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExportingBin(true);

      try {
        const gridSizeMm = params.gridUnitMm;
        const cutPlanesX = getSplitPlanePositionsMm(params.width, maxGridUnits, gridSizeMm);
        const cutPlanesY = getSplitPlanePositionsMm(params.depth, maxGridUnits, gridSizeMm);

        const result = await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY, {
          splitConnectorConfig: params.splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG,
        });

        // Generate base filename (without extension)
        const baseName = generateFileName(params, format, config, designName).replace(
          /\.[^.]+$/,
          ''
        );

        if (format === '3mf') {
          // Convert each STL piece to 3MF before packaging
          const currentPrintSettings = useSettingsStore.getState().settings.printSettings;
          const currentEstimates = estimatePrint(params, currentPrintSettings);

          const convertedPieces: { data: ArrayBuffer; label: string }[] = [];
          for (const piece of result.pieces) {
            const parseResult = parseSTLBinary(piece.data);
            if (isErr(parseResult)) {
              throw new Error(getUserMessage(parseResult.error));
            }
            const { vertices, normals } = parseResult.value;
            const blob = export3MF(vertices, normals, {
              name: `${baseName}_${piece.label}`,
              printSettings: {
                layerHeight: currentPrintSettings.layerHeightMm,
                infillPercent: currentPrintSettings.infillPercent,
                material: 'PLA',
                supportRequired: false,
                estimatedMinutes: currentEstimates.printTimeMinutes,
                estimatedGrams: currentEstimates.gramsFilament,
              },
            });
            convertedPieces.push({ data: await blob.arrayBuffer(), label: piece.label });
          }

          const zip = await packagePiecesAsZip(convertedPieces, baseName, '.3mf');
          triggerDownload(zip, `${baseName}_split.zip`);
        } else {
          const blob = await packageSplitPiecesAsZip(result.pieces, baseName);
          triggerDownload(blob, `${baseName}_split.zip`);
        }
      } finally {
        setIsExportingBin(false);
      }
    },
    [params, maxGridUnits]
  );

  return {
    isExporting,
    isExportingBin,
    isExportingDividers,
    canExport,
    canExportDividers,
    estimates,
    downloadBin,
    downloadDividersSTL,
    needsSplit,
    splitPieceCount,
    maxGridUnits,
    downloadSplit,
  };
}
