/**
 * Export hook for the bin designer.
 *
 * Manages export lifecycle: generates file from mesh or BREP solid,
 * triggers browser download, and computes live print estimates.
 *
 * Formats:
 * - STL: Binary mesh from tessellated preview (fast, main-thread)
 * - 3MF: XML container with mesh + metadata (main-thread)
 * - STEP: Exact BREP geometry via worker (lossless CAD interchange)
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { exportSTL } from '@/features/generation/export/stlExporter';
import { export3MF } from '@/features/generation/export/threemfExporter';
import { getActiveBridge } from '@/features/generation/bridge';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import { captureThumbnailPNG } from '@/features/bin-designer/utils/thumbnail';
import type { ExportFileNameConfig } from '@/features/bin-designer/types';
import type { PrintEstimate } from '@/features/bin-designer/utils/printEstimates';

/** Supported export formats */
export type ExportFormat = 'stl' | '3mf' | 'step';

interface UseExportReturn {
  /** Whether an export is currently being generated */
  readonly isExporting: boolean;
  /** Whether mesh data is available for export */
  readonly canExport: boolean;
  /** Whether BREP export (STEP) is available */
  readonly canExportBREP: boolean;
  /** Current print estimates based on params */
  readonly estimates: PrintEstimate;
  /** Trigger STL download */
  readonly downloadSTL: (config: ExportFileNameConfig, designName?: string) => void;
  /** Trigger 3MF download (with thumbnail & print settings) */
  readonly download3MF: (config: ExportFileNameConfig, designName?: string) => Promise<void>;
  /** Trigger STEP download (exact BREP via worker, lossless) */
  readonly downloadSTEP: () => Promise<void>;
}

export function useExport(): UseExportReturn {
  const { params, mesh } = useDesignerStore(
    useShallow((state) => ({
      params: state.params,
      mesh: state.generation.mesh,
    }))
  );

  const [isExporting, setIsExporting] = useState(false);

  const canExport = mesh !== null &&
    mesh.vertices !== null &&
    mesh.normals !== null &&
    mesh.error === null;

  // BREP export requires the generation worker to be active
  const canExportBREP = canExport && getActiveBridge() !== null;

  const estimates = useMemo(() => estimatePrint(params), [params]);

  const downloadSTL = useCallback(
    (config: ExportFileNameConfig, designName?: string) => {
      if (!canExport || !mesh?.vertices || !mesh?.normals) return;

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        const name = generateFileName(params, 'stl', config, designName);
        const blob = exportSTL(mesh.vertices, mesh.normals, name);

        // Trigger browser download via hidden anchor
        url = URL.createObjectURL(blob);
        anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        if (anchor?.parentNode) anchor.parentNode.removeChild(anchor);
        if (url) URL.revokeObjectURL(url);
        setIsExporting(false);
      }
    },
    [canExport, mesh, params]
  );

  const download3MF = useCallback(
    async (config: ExportFileNameConfig, designName?: string) => {
      if (!canExport || !mesh?.vertices || !mesh?.normals) return;

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        const name = generateFileName(params, '3mf', config, designName);

        // Capture thumbnail from 3D preview (async canvas → PNG)
        const thumbnail = await captureThumbnailPNG() ?? undefined;

        const blob = export3MF(mesh.vertices, mesh.normals, {
          name: name.replace(/\.3mf$/, ''),
          thumbnail,
          printSettings: {
            layerHeight: 0.2,
            infillPercent: 15,
            material: 'PLA',
            supportRequired: false,
            estimatedMinutes: Math.round(estimates.printTimeMinutes),
            estimatedGrams: Math.round(estimates.gramsFilament),
          },
        });

        url = URL.createObjectURL(blob);
        anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        if (anchor?.parentNode) anchor.parentNode.removeChild(anchor);
        if (url) URL.revokeObjectURL(url);
        setIsExporting(false);
      }
    },
    [canExport, mesh, params, estimates]
  );

  const downloadSTEP = useCallback(
    async () => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        const result = await bridge.exportBin(params, 'step');

        const blob = new Blob([result.data], { type: 'application/step' });
        url = URL.createObjectURL(blob);
        anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = result.fileName;
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

  return { isExporting, canExport, canExportBREP, estimates, downloadSTL, download3MF, downloadSTEP };
}
