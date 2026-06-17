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
import { export3MF, buildSTLBuffer } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildStackExportSoup } from '../utils/stackExport';
import { planPhysicalStacks, stackHeightCap } from '../utils/stackPrint';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import type { StackPrintParams } from '@/core/types';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { isErr, getUserMessage } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { groupPiecesByFingerprint } from '../utils/pieceFingerprint';
import { assignGroupNames } from '../utils/pieceNaming';
import { countConnectorKeys } from '../utils/connectorKeys';
import { generatePrintGuide, generateStackPrintNote } from '../utils/printGuide';
import { generateBaseplateFileName, toNamingParams } from '../utils/fileNaming';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import type { ExportFileFormat } from '@/shared/types/bin';

interface UseBaseplateExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly exportProgress: { current: number; total: number } | null;
  readonly downloadBaseplate: (
    format: ExportFileFormat,
    splitEnabled?: boolean
  ) => Promise<boolean>;
}

const FORMAT_EXTENSIONS: Record<ExportFileFormat, string> = {
  stl: '.stl',
  step: '.step',
  '3mf': '.3mf',
};

function printSettingsFor3MF() {
  const printSettings = useSettingsStore.getState().settings.printSettings;
  return {
    layerHeight: printSettings.layerHeightMm,
    infillPercent: printSettings.infillPercent,
    material: 'PLA',
    supportRequired: false,
    estimatedMinutes: 0,
    estimatedGrams: 0,
  };
}

/** Convert a single-plate STL to a single-instance 3MF (no stacking). */
function convertStlTo3mf(stlData: ArrayBuffer, name: string): Blob {
  const parseResult = parseSTLBinary(stlData);
  if (isErr(parseResult)) {
    throw new Error(getUserMessage(parseResult.error));
  }
  const { vertices, normals } = parseResult.value;
  return export3MF(vertices, normals, { name, printSettings: printSettingsFor3MF() });
}

/** Parse a binary STL into a triangle soup, or throw a user-facing error. */
function parseStlSoup(stlData: ArrayBuffer): { vertices: Float32Array; normals: Float32Array } {
  const parseResult = parseSTLBinary(stlData);
  if (isErr(parseResult)) {
    throw new Error(getUserMessage(parseResult.error));
  }
  return parseResult.value;
}

/**
 * Build a stacked file from an already-parsed single-plate soup: bakes `copies`
 * plates (bottom upright, the rest flipped, separated by an air gap) into real
 * geometry. Single-material in both STL and 3MF. The source is parsed once by
 * the caller so capped multi-tower exports don't re-parse the same mesh.
 */
function buildStackedFileBlob(
  source: { vertices: Float32Array; normals: Float32Array },
  name: string,
  copies: number,
  format: 'stl' | '3mf',
  stack: StackPrintParams
): Blob {
  const { vertices, normals } = source;
  const soup = buildStackExportSoup(vertices, normals, copies, stack);

  if (format === 'stl') {
    return new Blob([buildSTLBuffer(soup.vertices, soup.normals, name)], {
      type: FORMAT_MIME_TYPES.stl,
    });
  }

  return export3MF(soup.vertices, soup.normals, {
    name,
    printSettings: printSettingsFor3MF(),
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
        return false;
      }

      setIsExporting(true);

      // Stack-printing config (persisted in baseplateParams). STEP is a CAD
      // interchange format with no slicer stacking notion, so it never stacks.
      const stack = baseplateParams.stackPrint;
      const stackEnabled = stack?.enabled === true && format !== 'step';
      const stackCap = stackHeightCap(
        useSettingsStore.getState().settings.printSettings.maxPrintHeightMm,
        GRIDFINITY_SPEC.SOCKET_HEIGHT,
        stack?.gapMm ?? 0.2
      );

      try {
        const fullParams = buildFullParams(
          baseplateParams,
          drawerWidth,
          drawerDepth,
          gridUnitMm,
          fractionalEdgeX,
          fractionalEdgeY,
          useSettingsStore.getState().settings.printSettings.nozzleSizeMm
        );

        const baseName = generateBaseplateFileName(
          toNamingParams(fullParams),
          format,
          exportFileNameConfig
        );
        const baseNameNoExt = baseName.replace(/\.[^.]+$/, '');
        const extension = FORMAT_EXTENSIONS[format];

        if (tiling?.isSplit && splitEnabled) {
          // Multi-piece ZIP export: dedupe pieces by geometry fingerprint, then
          // generate + export only the unique shapes.
          const bridgeFormat = format === '3mf' ? 'stl' : format;
          const pool = workerPoolManager.get();

          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          const groupNames = assignGroupNames(groups, tiling.pieces);
          const uniqueGroups = [...groups.entries()];
          const uniqueCount = uniqueGroups.length;
          const totalPieces = tiling.pieces.length;

          setExportProgress({ current: 0, total: uniqueCount });

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

          // One file per unique shape. When stacking, each unique piece is baked
          // into towers of the quantity the drawer needs (group size), split into
          // multiple files when a stack exceeds the printable height cap.
          const pieces: { data: ArrayBuffer; label: string }[] = [];
          for (let i = 0; i < uniqueGroups.length; i++) {
            const [fp, group] = uniqueGroups[i];
            const name = groupNames.get(fp) ?? 'unknown';
            const stlData = uniqueExports[i];

            if (stack && stackEnabled) {
              const source = parseStlSoup(stlData);
              const towers = planPhysicalStacks(
                [{ label: name, quantity: group.indices.length }],
                stackCap
              );
              for (let s = 0; s < towers.length; s++) {
                const label = towers.length > 1 ? `${name}_${s + 1}` : name;
                const blob = buildStackedFileBlob(
                  source,
                  `${baseNameNoExt}_${label}`,
                  towers[s].copies,
                  format,
                  stack
                );
                pieces.push({ data: await blob.arrayBuffer(), label });
              }
            } else if (format === '3mf') {
              const blob = convertStlTo3mf(stlData, `${baseNameNoExt}_${name}`);
              pieces.push({ data: await blob.arrayBuffer(), label: name });
            } else {
              pieces.push({ data: stlData, label: name });
            }
          }

          // Dovetail key connectors ship a separate, identical key part hammered into
          // every seam junction — one STL, printed N times.
          const keyCount = countConnectorKeys(tiling, fullParams);
          if (keyCount > 0) {
            const keyResult = await bridge.exportConnectorKey(fullParams, bridgeFormat);
            let keyData = keyResult.data;
            if (format === '3mf') {
              // The key is a discrete part (one per seam junction, count in the
              // guide), not a plate — stacking never applies to it. It prints
              // flat on its own even when the plates are stacked into towers.
              const blob = convertStlTo3mf(keyData, `${baseNameNoExt}_key`);
              keyData = await blob.arrayBuffer();
            }
            pieces.push({ data: keyData, label: 'key' });
          }

          const guideText = generatePrintGuide({
            tiling,
            groups,
            groupNames,
            parentParams: fullParams,
            fileExtension: extension,
            baseFileName: baseNameNoExt,
            connectorKey:
              keyCount > 0
                ? { fileName: `${baseNameNoExt}_key${extension}`, count: keyCount }
                : undefined,
            stackPrint: stackEnabled ? stack : undefined,
            stackCap,
          });

          const zip = packagePiecesAsZip(pieces, baseNameNoExt, extension, [
            { name: 'print-guide.txt', content: guideText },
          ]);
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
        } else if (format === 'step') {
          // STEP: never stacked (CAD interchange, no slicer notion).
          const result = await bridge.exportBaseplate(fullParams, 'step');
          triggerDownload(new Blob([result.data], { type: FORMAT_MIME_TYPES.step }), baseName);
        } else if (stack && stackEnabled) {
          // Single piece, stacked into one tower (split under the height cap) —
          // a single tower downloads directly, several go in a ZIP.
          const stlResult = await bridge.exportBaseplate(fullParams, 'stl');
          const source = parseStlSoup(stlResult.data);
          const towers = planPhysicalStacks([{ label: 'plate', quantity: 1 }], stackCap);
          if (towers.length === 1) {
            const blob = buildStackedFileBlob(
              source,
              baseNameNoExt,
              towers[0].copies,
              format,
              stack
            );
            triggerDownload(blob, baseName);
          } else {
            const pieces: { data: ArrayBuffer; label: string }[] = [];
            for (let s = 0; s < towers.length; s++) {
              const label = `${s + 1}`;
              const blob = buildStackedFileBlob(
                source,
                `${baseNameNoExt}_${label}`,
                towers[s].copies,
                format,
                stack
              );
              pieces.push({ data: await blob.arrayBuffer(), label });
            }
            const zip = packagePiecesAsZip(pieces, baseNameNoExt, extension, [
              { name: 'print-guide.txt', content: generateStackPrintNote(stack) },
            ]);
            triggerDownload(zip, `${baseNameNoExt}.zip`);
          }
        } else {
          // Single piece, unstacked, STL or 3MF.
          const stlResult = await bridge.exportBaseplate(fullParams, 'stl');
          const blob =
            format === '3mf'
              ? convertStlTo3mf(stlResult.data, baseNameNoExt)
              : new Blob([stlResult.data], { type: FORMAT_MIME_TYPES.stl });
          triggerDownload(blob, baseName);
          // Single-file success is conveyed by the dialog's inline success view.
        }

        return true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Export failed';
        useToastStore.getState().addToast(message, 'error');
        return false;
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
