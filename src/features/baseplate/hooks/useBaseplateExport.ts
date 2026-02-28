/**
 * Hook for exporting the baseplate as STL, STEP, or 3MF.
 *
 * Uses the shared ExportDialog configuration for filenames. When the baseplate
 * is split into multiple pieces, exports in parallel via the worker pool with
 * progress tracking. Falls back to sequential export if the pool is unavailable.
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
import { useBaseplatePageStore, getWorkerPool } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { pieceToBaseplateParams } from '../utils/splitPlanner';
import { generateBaseplateFileName, toNamingParams } from '../utils/fileNaming';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import type { ExportFileFormat } from '@/shared/types/bin';

interface UseBaseplateExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly exportProgress: { current: number; total: number } | null;
  readonly downloadBaseplate: (format: ExportFileFormat, splitEnabled?: boolean) => Promise<void>;
}

const FORMAT_EXTENSIONS: Record<ExportFileFormat, string> = {
  stl: '.stl',
  step: '.step',
  '3mf': '.3mf',
};

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
  const exportFileNameConfig = useBaseplatePageStore((s) => s.exportFileNameConfig);
  const exportProgress = useBaseplatePageStore((s) => s.exportProgress);
  const setExportProgress = useBaseplatePageStore((s) => s.setExportProgress);
  const [isExporting, setIsExporting] = useState(false);

  const hasSingleMesh = mesh !== null && mesh.vertices !== null && mesh.error === null;
  const hasSplitMeshes = pieceMeshes.length > 0;
  const canExport = (hasSingleMesh || hasSplitMeshes) && getActiveBridge() !== null;

  const downloadBaseplate = useCallback(
    async (format: ExportFileFormat, splitEnabled = true) => {
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

        const baseName = generateBaseplateFileName(
          toNamingParams(fullParams),
          format,
          exportFileNameConfig
        );
        const baseNameNoExt = baseName.replace(/\.[^.]+$/, '');
        const extension = FORMAT_EXTENSIONS[format];

        if (tiling?.isSplit && splitEnabled) {
          // Multi-piece ZIP export
          const bridgeFormat = format === '3mf' ? 'stl' : format;
          const pool = getWorkerPool();
          const total = tiling.pieces.length;
          setExportProgress({ current: 0, total });

          let pieces: { data: ArrayBuffer; label: string }[];

          if (pool && !pool.isDestroyed && pool.size > 1) {
            // Parallel export via worker pool
            const pieceParamsArray = tiling.pieces.map((piece) =>
              pieceToBaseplateParams(piece, fullParams)
            );
            const results = await pool.exportPieces(
              pieceParamsArray,
              bridgeFormat,
              (completed, pieceTotal) => {
                setExportProgress({ current: completed, total: pieceTotal });
              }
            );

            if (format === '3mf') {
              const convertedPieces: { data: ArrayBuffer; label: string }[] = [];
              for (let i = 0; i < results.length; i++) {
                const blob = convertStlTo3mf(
                  results[i].data,
                  `${baseNameNoExt}_${tiling.pieces[i].label}`
                );
                convertedPieces.push({
                  data: await blob.arrayBuffer(),
                  label: tiling.pieces[i].label,
                });
              }
              pieces = convertedPieces;
            } else {
              pieces = results.map((r, i) => ({
                data: r.data,
                label: tiling.pieces[i].label,
              }));
            }
          } else {
            // Sequential fallback
            pieces = [];
            for (let i = 0; i < tiling.pieces.length; i++) {
              const piece = tiling.pieces[i];
              setExportProgress({ current: i + 1, total });
              const pieceParams = pieceToBaseplateParams(piece, fullParams);
              const result = await bridge.exportBaseplate(pieceParams, bridgeFormat);

              if (format === '3mf') {
                const blob = convertStlTo3mf(result.data, `${baseNameNoExt}_${piece.label}`);
                pieces.push({ data: await blob.arrayBuffer(), label: piece.label });
              } else {
                pieces.push({ data: result.data, label: piece.label });
              }
            }
          }

          const zip = await packagePiecesAsZip(pieces, baseNameNoExt, extension);
          triggerDownload(zip, `${baseNameNoExt}.zip`);

          useToastStore
            .getState()
            .addToast(t('baseplate.export.splitSuccess', { count: total }), 'success');
        } else {
          // Single piece export
          if (format === '3mf') {
            const stlResult = await bridge.exportBaseplate(fullParams, 'stl');
            const blob = convertStlTo3mf(stlResult.data, baseNameNoExt);
            triggerDownload(blob, baseName);
          } else {
            const result = await bridge.exportBaseplate(fullParams, format);
            const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
            triggerDownload(blob, baseName);
          }

          useToastStore
            .getState()
            .addToast(t('baseplate.export.success', { format: format.toUpperCase() }), 'success');
        }

        // Auto-close the export dialog after successful download
        useBaseplatePageStore.getState().setExportDialogOpen(false);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Export failed';
        useToastStore.getState().addToast(message, 'error');
      } finally {
        setIsExporting(false);
        setExportProgress(null);
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
      exportFileNameConfig,
      setExportProgress,
    ]
  );

  return {
    isExporting,
    canExport,
    exportProgress,
    downloadBaseplate,
  };
}
