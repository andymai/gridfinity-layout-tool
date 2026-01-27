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
import { getActiveBridge } from '@/shared/generation/bridge';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
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
}

export function useExport(): UseExportReturn {
  const { params, mesh } = useDesignerStore(
    useShallow((state) => ({
      params: state.params,
      mesh: state.generation.mesh,
    }))
  );

  const [isExporting, setIsExporting] = useState(false);

  // Export requires both a preview mesh (to show UI) and an active bridge (to regenerate)
  const canExport =
    mesh !== null &&
    mesh.vertices !== null &&
    mesh.error === null &&
    getActiveBridge() !== null;

  const estimates = useMemo(() => estimatePrint(params), [params]);

  /**
   * Download high-quality STL via worker bridge.
   * Regenerates mesh with fine tessellation (0.01mm, 5°) for smooth curves.
   */
  const downloadSTL = useCallback(
    async (config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) {
        throw new Error('Export worker not available');
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

  return {
    isExporting,
    canExport,
    estimates,
    downloadSTL,
  };
}
