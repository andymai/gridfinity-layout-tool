/**
 * Hook for exporting the baseplate as STL, STEP, or 3MF.
 *
 * Builds full baseplate params from layout store, calls the generation bridge,
 * and triggers a browser download. When the baseplate is split into multiple
 * pieces, exports a ZIP archive of individually-named files.
 */

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { isErr, getUserMessage } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { pieceToBaseplateParams } from '../utils/splitPlanner';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import type { ExportFileFormat } from '@/shared/types/bin';

interface UseBaseplateExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly downloadBaseplate: (format: ExportFileFormat) => Promise<void>;
}

function convertStlTo3mf(stlData: ArrayBuffer, name: string): Blob {
  const parseResult = parseSTLBinary(stlData);
  if (isErr(parseResult)) {
    throw new Error(getUserMessage(parseResult.error));
  }
  const { vertices, normals } = parseResult.value;
  const printSettings = useSettingsStore.getState().settings.printSettings;
  return export3MF(vertices, normals, {
    name,
    printSettings: {
      layerHeight: printSettings.layerHeightMm,
      infillPercent: printSettings.infillPercent,
      material: 'PLA',
      supportRequired: false,
      estimatedMinutes: 0,
      estimatedGrams: 0,
    },
  });
}

export function useBaseplateExport(): UseBaseplateExportReturn {
  const t = useTranslation();
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

  const tiling = useBaseplatePageStore((s) => s.tiling);
  const mesh = useBaseplatePageStore((s) => s.generation.mesh);
  const pieceMeshes = useBaseplatePageStore((s) => s.pieceMeshes);

  const hasSingleMesh = mesh !== null && mesh.vertices !== null && mesh.error === null;
  const hasSplitMeshes = pieceMeshes.length > 0;
  const canExport = (hasSingleMesh || hasSplitMeshes) && getActiveBridge() !== null;

  const downloadBaseplate = useCallback(
    async (format: ExportFileFormat) => {
      const bridge = getActiveBridge();
      if (!bridge) {
        useToastStore.getState().addToast(t('baseplate.exportNotReady'), 'error');
        return;
      }

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
        const extensionMap: Record<ExportFileFormat, string> = {
          '3mf': '.3mf',
          step: '.step',
          stl: '.stl',
        };
        const extension = extensionMap[format];

        if (tiling?.isSplit) {
          // Multi-piece ZIP export
          const bridgeFormat = format === '3mf' ? 'stl' : format;
          const pieces: { data: ArrayBuffer; label: string }[] = [];

          for (const piece of tiling.pieces) {
            const pieceParams = pieceToBaseplateParams(piece, fullParams);
            const result = await bridge.exportBaseplate(pieceParams, bridgeFormat);

            if (format === '3mf') {
              const blob = convertStlTo3mf(result.data, `${baseName}_${piece.label}`);
              pieces.push({ data: await blob.arrayBuffer(), label: piece.label });
            } else {
              pieces.push({ data: result.data, label: piece.label });
            }
          }

          const zip = await packagePiecesAsZip(pieces, baseName, extension);
          triggerDownload(zip, `${baseName}.zip`);
        } else {
          // Single piece
          if (format === '3mf') {
            const stlResult = await bridge.exportBaseplate(fullParams, 'stl');
            const blob = convertStlTo3mf(stlResult.data, baseName);
            triggerDownload(blob, `${baseName}${extension}`);
          } else {
            const result = await bridge.exportBaseplate(fullParams, format);
            const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
            triggerDownload(blob, `${baseName}${extension}`);
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Export failed';
        useToastStore.getState().addToast(message, 'error');
      } finally {
        setIsExporting(false);
      }
    },
    [
      t,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY,
      baseplateParams,
      tiling,
    ]
  );

  return {
    isExporting,
    canExport,
    downloadBaseplate,
  };
}
