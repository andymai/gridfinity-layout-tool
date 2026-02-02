/**
 * Export hook for the bin designer.
 *
 * Manages export lifecycle: generates high-quality mesh via worker,
 * triggers browser download, and computes live print estimates.
 *
 * STL export regenerates the mesh with fine tessellation settings
 * (0.01mm tolerance, 5° angular) for smooth rounded corners.
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
import type { ExportFileNameConfig } from '@/features/bin-designer/types';
import type { PrintEstimate } from '@/features/bin-designer/utils/printEstimates';

interface UseExportReturn {
  /** Whether an export is currently being generated */
  readonly isExporting: boolean;
  /** Whether mesh data is available for export (bridge active + mesh exists) */
  readonly canExport: boolean;
  /** Current print estimates based on params */
  readonly estimates: PrintEstimate;
  /** Trigger high-quality STL download via worker */
  readonly downloadSTL: (config: ExportFileNameConfig, designName?: string) => Promise<void>;
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

  /**
   * Download high-quality STL via worker bridge.
   * Regenerates mesh with fine tessellation (0.01mm, 5°) for smooth curves.
   */
  const downloadSTL = useCallback(
    async (config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) {
        return;
      }

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        // Generate high-quality STL via worker (0.01mm tolerance, 5° angular)
        const result = await bridge.exportBin(params, 'stl');

        // Use custom filename from config
        const fileName = generateFileName(params, 'stl', config, designName);

        const blob = new Blob([result.data], { type: 'application/sla' });
        url = URL.createObjectURL(blob);
        anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        if (anchor?.parentNode) anchor.parentNode.removeChild(anchor);
        if (url) URL.revokeObjectURL(url);
        setIsExporting(false);
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

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        const result = await bridge.exportDividers(params);

        const fileName = generateDividerFileName(params, config, designName);

        const blob = new Blob([result.data], { type: 'application/sla' });
        url = URL.createObjectURL(blob);
        anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        if (anchor?.parentNode) anchor.parentNode.removeChild(anchor);
        if (url) URL.revokeObjectURL(url);
        setIsExporting(false);
      }
    },
    [params]
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

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        const gridSizeMm = params.gridUnitMm;
        const cutPlanesX = getSplitPlanePositionsMm(params.width, maxGridUnits, gridSizeMm);
        const cutPlanesY = getSplitPlanePositionsMm(params.depth, maxGridUnits, gridSizeMm);

        const result = await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY);

        // Generate base filename (without extension)
        const baseName = generateFileName(params, 'stl', config, designName).replace(/\.stl$/, '');

        const blob = await packageSplitPiecesAsZip(result.pieces, baseName);
        url = URL.createObjectURL(blob);
        anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${baseName}_split.zip`;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        if (anchor?.parentNode) anchor.parentNode.removeChild(anchor);
        if (url) URL.revokeObjectURL(url);
        setIsExporting(false);
      }
    },
    [params, maxGridUnits]
  );

  return {
    isExporting,
    canExport,
    canExportDividers,
    estimates,
    downloadSTL,
    downloadDividersSTL,
    needsSplit,
    splitPieceCount,
    maxGridUnits,
    downloadSplitSTL,
  };
}
