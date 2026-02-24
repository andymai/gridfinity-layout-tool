/**
 * Hook for exporting the baseplate as STL, STEP, or 3MF.
 *
 * Builds full baseplate params from layout store, calls the generation bridge,
 * and triggers a browser download.
 */

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isErr, getUserMessage } from '@/core/result';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import type { ExportFileFormat } from '@/shared/types/bin';

/** MIME types for each export format */
const FORMAT_MIME_TYPES: Record<string, string> = {
  stl: 'application/sla',
  step: 'application/step',
  '3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
};

interface UseBaseplateExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly downloadBaseplate: (format: ExportFileFormat) => Promise<void>;
}

/** Trigger browser download from a Blob */
function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.parentNode?.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function useBaseplateExport(): UseBaseplateExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    baseplateParams,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  const mesh = useBaseplatePageStore((s) => s.generation.mesh);
  const canExport =
    mesh !== null && mesh.vertices !== null && mesh.error === null && getActiveBridge() !== null;

  const downloadBaseplate = useCallback(
    async (format: ExportFileFormat) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setIsExporting(true);

      try {
        const fullParams = buildFullParams(
          baseplateParams,
          drawerWidth,
          drawerDepth,
          gridUnitMm,
          fractionalEdgeX,
          fractionalEdgeY
        );

        const baseName = `gridfinity-baseplate-${drawerWidth}x${drawerDepth}`;
        const extension = format === '3mf' ? '.3mf' : format === 'step' ? '.step' : '.stl';
        const fileName = `${baseName}${extension}`;

        // Bridge exportBaseplate expects 'stl' | 'step' format
        if (format === '3mf') {
          const stlResult = await bridge.exportBaseplate(fullParams, 'stl');
          const parseResult = parseSTLBinary(stlResult.data);
          if (isErr(parseResult)) {
            throw new Error(getUserMessage(parseResult.error));
          }
          const { vertices, normals } = parseResult.value;

          const currentPrintSettings = useSettingsStore.getState().settings.printSettings;
          const blob = export3MF(vertices, normals, {
            name: baseName,
            printSettings: {
              layerHeight: currentPrintSettings.layerHeightMm,
              infillPercent: currentPrintSettings.infillPercent,
              material: 'PLA',
              supportRequired: false,
              estimatedMinutes: 0,
              estimatedGrams: 0,
            },
          });

          triggerDownload(blob, fileName);
        } else {
          const result = await bridge.exportBaseplate(fullParams, format);
          const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
          triggerDownload(blob, fileName);
        }
      } finally {
        setIsExporting(false);
      }
    },
    [drawerWidth, drawerDepth, gridUnitMm, fractionalEdgeX, fractionalEdgeY, baseplateParams]
  );

  return {
    isExporting,
    canExport,
    downloadBaseplate,
  };
}
