/**
 * Export hook for the bin designer.
 *
 * Manages the STL export lifecycle: generates blob from mesh data,
 * triggers browser download, and computes live print estimates.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { exportSTL } from '@/features/generation/export/stlExporter';
import { export3MF } from '@/features/generation/export/threemfExporter';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import { captureThumbnailPNG } from '@/features/bin-designer/utils/thumbnail';
import type { FileNameStyle } from '@/features/bin-designer/utils/fileNaming';
import type { PrintEstimate } from '@/features/bin-designer/utils/printEstimates';

/** Supported export formats */
export type ExportFormat = 'stl' | '3mf';

interface UseExportReturn {
  /** Whether an export is currently being generated */
  readonly isExporting: boolean;
  /** Whether mesh data is available for export */
  readonly canExport: boolean;
  /** Current print estimates based on params */
  readonly estimates: PrintEstimate;
  /** Preview of the generated file name */
  readonly fileName: string;
  /** Trigger STL download */
  readonly downloadSTL: (nameStyle?: FileNameStyle) => void;
  /** Trigger 3MF download (with thumbnail & print settings) */
  readonly download3MF: (nameStyle?: FileNameStyle) => Promise<void>;
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

  const estimates = useMemo(() => estimatePrint(params), [params]);

  const fileName = useMemo(
    () => generateFileName(params, 'stl', 'descriptive'),
    [params]
  );

  const downloadSTL = useCallback(
    (nameStyle: FileNameStyle = 'descriptive') => {
      if (!canExport || !mesh?.vertices || !mesh?.normals) return;

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        const name = generateFileName(params, 'stl', nameStyle);
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
    async (nameStyle: FileNameStyle = 'descriptive') => {
      if (!canExport || !mesh?.vertices || !mesh?.normals) return;

      setIsExporting(true);

      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        const name = generateFileName(params, '3mf', nameStyle);

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

  return { isExporting, canExport, estimates, fileName, downloadSTL, download3MF };
}
