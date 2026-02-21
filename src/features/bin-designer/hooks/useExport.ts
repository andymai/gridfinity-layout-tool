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
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/features/bin-designer/utils/stlParser';
import { isErr, getUserMessage } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import type { ExportFileNameConfig, ExportFileFormat } from '@/features/bin-designer/types';
import type { PrintEstimate } from '@/features/bin-designer/utils/printEstimates';

/** MIME types for each export format */
const FORMAT_MIME_TYPES: Record<ExportFileFormat, string> = {
  stl: 'application/sla',
  step: 'application/step',
  '3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
};

interface UseExportReturn {
  /** Whether an export is currently being generated */
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
  /** Trigger split STL download as ZIP via worker bridge */
  readonly downloadSplitSTL: (config: ExportFileNameConfig, designName?: string) => Promise<void>;
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

  const [isExporting, setIsExporting] = useState(false);

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

  /** Trigger browser download from a Blob */
  const triggerDownload = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.parentNode?.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

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

      setIsExporting(true);

      try {
        const fileName = generateFileName(params, format, config, designName);

        if (format === '3mf') {
          // 3MF: get high-quality STL from worker, parse, then package as 3MF
          const stlResult = await bridge.exportBin(params, 'stl');
          const parseResult = parseSTLBinary(stlResult.data);
          if (isErr(parseResult)) {
            useToastStore.getState().addToast(getUserMessage(parseResult.error), 'error');
            return;
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
        setIsExporting(false);
      }
    },
    [params, triggerDownload]
  );

  /**
   * Download divider pieces as a combined STL via worker bridge.
   */
  const downloadDividersSTL = useCallback(
    async (config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExporting(true);

      try {
        const result = await bridge.exportDividers(params);
        const fileName = generateDividerFileName(params, config, designName);
        const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES.stl });
        triggerDownload(blob, fileName);
      } finally {
        setIsExporting(false);
      }
    },
    [params, triggerDownload]
  );

  /**
   * Download split STL as ZIP via worker bridge.
   * Computes cut planes, sends to worker for boolean splitting,
   * then packages results into a ZIP archive.
   */
  const downloadSplitSTL = useCallback(
    async (config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExporting(true);

      try {
        const gridSizeMm = params.gridUnitMm;
        const cutPlanesX = getSplitPlanePositionsMm(params.width, maxGridUnits, gridSizeMm);
        const cutPlanesY = getSplitPlanePositionsMm(params.depth, maxGridUnits, gridSizeMm);

        const result = await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY);

        // Generate base filename (without extension)
        const baseName = generateFileName(params, 'stl', config, designName).replace(/\.stl$/, '');

        const blob = await packageSplitPiecesAsZip(result.pieces, baseName);
        triggerDownload(blob, `${baseName}_split.zip`);
      } finally {
        setIsExporting(false);
      }
    },
    [params, maxGridUnits, triggerDownload]
  );

  return {
    isExporting,
    canExport,
    canExportDividers,
    estimates,
    downloadBin,
    downloadDividersSTL,
    needsSplit,
    splitPieceCount,
    maxGridUnits,
    downloadSplitSTL,
  };
}
