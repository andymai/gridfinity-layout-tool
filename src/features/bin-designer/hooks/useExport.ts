/**
 * Export hook for the bin designer.
 *
 * Manages export lifecycle: generates high-quality mesh via worker,
 * triggers browser download, and computes live print estimates.
 *
 * Formats:
 * - STL: High-quality mesh via worker (forExport=true, 0.01mm tolerance)
 * - 3MF: High-quality mesh + metadata (via worker, 0.01mm tolerance)
 * - STEP: Exact BREP geometry via worker (lossless CAD interchange)
 *
 * All mesh exports regenerate with full BREP fidelity (5-section socket
 * profiles) and fine tessellation, ensuring print-ready geometry.
 */

import { useCallback, useMemo, useState } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { exportSTL, export3MF } from '@/shared/generation/export';
import { getActiveBridge } from '@/shared/generation/bridge';
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
  /** Whether the generation bridge is available for export */
  readonly canExport: boolean;
  /** Whether BREP export (STEP) is available */
  readonly canExportBREP: boolean;
  /** Current print estimates based on params */
  readonly estimates: PrintEstimate;
  /** Trigger STL download (generates high-quality mesh via worker) */
  readonly downloadSTL: (config: ExportFileNameConfig, designName?: string) => Promise<void>;
  /** Trigger 3MF download (generates high-quality mesh via worker, with thumbnail & metadata) */
  readonly download3MF: (config: ExportFileNameConfig, designName?: string) => Promise<void>;
  /** Trigger STEP download (exact BREP via worker, lossless) */
  readonly downloadSTEP: () => Promise<void>;
}

export function useExport(): UseExportReturn {
  const params = useDesignerStore((state) => state.params);

  const [isExporting, setIsExporting] = useState(false);

  // Export requires the generation bridge to be active
  const canExport = getActiveBridge() !== null;

  // BREP export uses the same bridge
  const canExportBREP = canExport;

  const estimates = useMemo(() => estimatePrint(params), [params]);

  const downloadSTL = useCallback(
    async (config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        // Generate high-quality mesh via worker
        const result = await bridge.generateForExport(params);
        const { vertices, normals } = result.mesh;

        const name = generateFileName(params, 'stl', config, designName);
        const blob = exportSTL(vertices, normals, name);

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
    [params]
  );

  const download3MF = useCallback(
    async (config: ExportFileNameConfig, designName?: string) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        // Generate high-quality mesh via worker
        const result = await bridge.generateForExport(params);
        const { vertices, normals } = result.mesh;

        const name = generateFileName(params, '3mf', config, designName);

        // Capture thumbnail from 3D preview (async canvas → PNG)
        const thumbnail = (await captureThumbnailPNG()) ?? undefined;

        const blob = export3MF(vertices, normals, {
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
    [params, estimates]
  );

  const downloadSTEP = useCallback(async () => {
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
  }, [params]);

  return {
    isExporting,
    canExport,
    canExportBREP,
    estimates,
    downloadSTL,
    download3MF,
    downloadSTEP,
  };
}
