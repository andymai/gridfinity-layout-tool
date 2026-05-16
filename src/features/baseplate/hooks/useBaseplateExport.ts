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
import { getActiveBridge, workerPoolManager } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { isErr, getUserMessage } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { groupPiecesByFingerprint } from '../utils/pieceFingerprint';
import { assignGroupNames } from '../utils/pieceNaming';
import { generatePrintGuide } from '../utils/printGuide';
import { generateBaseplateFileName, toNamingParams } from '../utils/fileNaming';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import type { ExportFileFormat } from '@/shared/types/bin';
import { resolveConnectorStyle } from '@/shared/types/bin';

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

function convertStlTo3mf(stlData: ArrayBuffer, name: string, stackCopies: number): Blob {
  const parseResult = parseSTLBinary(stlData);
  if (isErr(parseResult)) {
    throw new Error(getUserMessage(parseResult.error));
  }
  const { vertices, normals } = parseResult.value;
  const printSettings = useSettingsStore.getState().settings.printSettings;

  // Stacked instances reference the same mesh translated along Z; compute the
  // per-instance Z stride from the source mesh's bbox so each copy sits flush
  // on top of the one below it. A degenerate mesh (zero Z extent) would
  // produce a stride of 0 and silently overlap every copy at Z=0, so the
  // option is suppressed in that case and the export degrades to a single
  // instance instead.
  const zHeight = meshZExtent(vertices);
  const stack =
    stackCopies > 1 && zHeight > 0
      ? { count: stackCopies, zHeightMm: zHeight, spacingMm: 0 }
      : undefined;

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
    stack,
  });
}

function meshZExtent(vertices: Float32Array): number {
  if (vertices.length < 3) return 0;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    const z = vertices[i];
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const extent = maxZ - minZ;
  return Number.isFinite(extent) && extent > 0 ? extent : 0;
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
  const stackCopies = useBaseplatePageStore((s) => s.stackCopies);
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
          // Multi-piece ZIP export with deduplication
          const bridgeFormat = format === '3mf' ? 'stl' : format;
          const pool = workerPoolManager.get();

          // Deduplicate: group pieces by geometry fingerprint
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          const groupNames = assignGroupNames(groups, tiling.pieces);
          const uniqueGroups = [...groups.entries()];
          const uniqueCount = uniqueGroups.length;
          const totalPieces = tiling.pieces.length;

          setExportProgress({ current: 0, total: uniqueCount });

          // Generate only unique shapes
          const uniqueParams = uniqueGroups.map(([, g]) => g.params);
          let uniqueExports: ArrayBuffer[];

          if (pool && !pool.isDestroyed && pool.size > 1) {
            const results = await pool.exportBaseplates(
              uniqueParams,
              bridgeFormat,
              (completed, pieceTotal) =>
                setExportProgress({ current: completed, total: pieceTotal })
            );
            uniqueExports = results.map((r) => r.data);
          } else {
            uniqueExports = [];
            for (let i = 0; i < uniqueGroups.length; i++) {
              setExportProgress({ current: i + 1, total: uniqueCount });
              const result = await bridge.exportBaseplate(uniqueGroups[i][1].params, bridgeFormat);
              uniqueExports.push(result.data);
            }
          }

          // Build pieces array with role-based names (one file per unique shape)
          const pieces: { data: ArrayBuffer; label: string }[] = [];
          for (let i = 0; i < uniqueGroups.length; i++) {
            const [fp] = uniqueGroups[i];
            const name = groupNames.get(fp) ?? 'unknown';
            let data = uniqueExports[i];

            if (format === '3mf') {
              const blob = convertStlTo3mf(data, `${baseNameNoExt}_${name}`, stackCopies);
              data = await blob.arrayBuffer();
            }

            pieces.push({ data, label: name });
          }

          let snapClipFile: { name: string; data: ArrayBuffer } | null = null;
          if (resolveConnectorStyle(fullParams) === 'snap') {
            const clipFormat = format === '3mf' ? 'stl' : format;
            const clipResult = await bridge.exportSnapClip(clipFormat);
            const clipExt = clipFormat === 'step' ? '.step' : '.stl';
            snapClipFile = { name: `snap-clip${clipExt}`, data: clipResult.data };
          }

          const guideText = generatePrintGuide({
            tiling,
            groups,
            groupNames,
            parentParams: fullParams,
            fileExtension: extension,
            baseFileName: baseNameNoExt,
            snapClipFileName: snapClipFile?.name,
          });

          const extraFiles: { name: string; content: string | ArrayBuffer }[] = [
            { name: 'print-guide.txt', content: guideText },
          ];
          if (snapClipFile) {
            extraFiles.push({ name: snapClipFile.name, content: snapClipFile.data });
          }

          const zip = await packagePiecesAsZip(pieces, baseNameNoExt, extension, extraFiles);
          triggerDownload(zip, `${baseNameNoExt}.zip`);

          if (uniqueCount < totalPieces) {
            useToastStore
              .getState()
              .addToast(
                t('baseplate.export.dedupSuccess', { unique: uniqueCount, total: totalPieces }),
                'success'
              );
          } else {
            useToastStore
              .getState()
              .addToast(t('baseplate.export.splitSuccess', { count: totalPieces }), 'success');
          }
        } else {
          // Single piece export
          if (format === '3mf') {
            const stlResult = await bridge.exportBaseplate(fullParams, 'stl');
            const blob = convertStlTo3mf(stlResult.data, baseNameNoExt, stackCopies);
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
      stackCopies,
    ]
  );

  return {
    isExporting,
    canExport,
    exportProgress,
    downloadBaseplate,
  };
}
