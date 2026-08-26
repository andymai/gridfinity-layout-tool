/**
 * Hook for exporting the baseplate as STL, STEP, or 3MF.
 *
 * Thin wrapper over the pure `buildBaseplateExportPieces` builder: reads the
 * layout/settings/page stores, builds the export pieces, then packages them as a
 * single download (one un-split plate) or a ZIP with a print guide.
 */

import { useEngineReady } from '@/shared/hooks/useEngineReady';
import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { effectiveGridUnitMmY } from '@/core/types';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { getActiveBridge, workerPoolManager } from '@/shared/generation/bridge';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import { useToastStore } from '@/core/store/toast';
import { trackToolConverted } from '@/shared/analytics/posthog';
import { getErrorMessage } from '@/shared/utils/errors';
import { useTranslation } from '@/i18n';
import type { ExportFileFormat } from '@/shared/types/bin';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildBaseplateExportPieces } from '../utils/buildBaseplateExportPieces';
import { useBaseplatePlannerBridge } from './useBaseplatePlannerBridge';

interface UseBaseplateExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly exportProgress: { current: number; total: number } | null;
  readonly downloadBaseplate: (
    format: ExportFileFormat,
    splitEnabled?: boolean
  ) => Promise<boolean>;
}

export function useBaseplateExport(): UseBaseplateExportReturn {
  const t = useTranslation();
  const offerPlannerBridge = useBaseplatePlannerBridge();

  const {
    drawerWidth,
    drawerDepth,
    drawerOutline,
    gridUnitMm,
    gridUnitMmY,
    magnetAnchor,
    fractionalEdgeX,
    fractionalEdgeY,
    gridShiftX,
    gridShiftY,
    baseplateParams,
    printBedSize,
    printBedDepth,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      drawerOutline: state.layout.drawer.outline,
      gridUnitMm: state.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(state.layout),
      magnetAnchor: state.layout.magnetAnchor,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      gridShiftX: state.layout.drawer.gridShiftX ?? 0,
      gridShiftY: state.layout.drawer.gridShiftY ?? 0,
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
      printBedSize: state.layout.printBedSize,
      printBedDepth: state.layout.printBedDepth,
    }))
  );

  const mesh = useBaseplatePageStore((s) => s.generation.mesh);
  const pieceMeshes = useBaseplatePageStore((s) => s.pieceMeshes);
  const tiling = useBaseplatePageStore((s) => s.tiling);
  const exportFileNameConfig = useBaseplatePageStore((s) => s.exportFileNameConfig);
  const exportProgress = useBaseplatePageStore((s) => s.exportProgress);
  const setExportProgress = useBaseplatePageStore((s) => s.setExportProgress);
  const [isExporting, setIsExporting] = useState(false);

  const hasSingleMesh = mesh !== null && mesh.vertices !== null && mesh.error === null;
  const hasSplitMeshes = pieceMeshes.length > 0;
  // A user-drawn split can place a seam that leaves a piece larger than
  // the bed. The preview still renders it — mid-edit feedback is the point — but
  // exporting would ship an STL the slicer refuses, so the button goes dead
  // until the plan is fixed or reset. Automatic plans never populate this except
  // when the bed cannot hold a single grid unit at all.
  const overBedPieceCount = tiling?.bedOverages.length ?? 0;
  const engineReady = useEngineReady();
  const canExport = (hasSingleMesh || hasSplitMeshes) && engineReady && overBedPieceCount === 0;

  const downloadBaseplate = useCallback(
    async (format: ExportFileFormat, splitEnabled = true) => {
      const bridge = getActiveBridge();
      if (!bridge) {
        useToastStore.getState().addToast(t('baseplate.exportNotReady'), 'error');
        return false;
      }

      setIsExporting(true);

      try {
        const printSettings = useSettingsStore.getState().settings.printSettings;
        const { pieces, guideText, assemblyImage, baseNameNoExt, extension, splitStats } =
          await buildBaseplateExportPieces(bridge, workerPoolManager.get(), {
            baseplateParams,
            drawerWidth,
            drawerDepth,
            drawerOutline,
            gridUnitMm,
            gridUnitMmY,
            magnetAnchor,
            fractionalEdgeX,
            fractionalEdgeY,
            gridShiftX,
            gridShiftY,
            printBedWidthMm: printBedSize,
            printBedDepthMm: printBedDepth ?? printBedSize,
            format,
            splitEnabled,
            fileNameConfig: exportFileNameConfig,
            printSettings: {
              nozzleSizeMm: printSettings.nozzleSizeMm,
              layerHeightMm: printSettings.layerHeightMm,
              infillPercent: printSettings.infillPercent,
              maxPrintHeightMm: printSettings.maxPrintHeightMm,
            },
            onProgress: setExportProgress,
          });

        // One un-split plate downloads directly; everything else is a ZIP with a guide.
        if (pieces.length === 1 && guideText === '') {
          triggerDownload(
            new Blob([pieces[0].data], { type: FORMAT_MIME_TYPES[format] }),
            `${baseNameNoExt}${extension}`
          );
        } else {
          const zip = packagePiecesAsZip(
            pieces,
            baseNameNoExt,
            extension,
            guideText ? [{ name: 'print-guide.txt', content: guideText }] : undefined,
            assemblyImage ? [{ path: 'assembly-map.png', data: assemblyImage }] : undefined
          );
          triggerDownload(zip, `${baseNameNoExt}.zip`);
        }

        trackToolConverted('baseplate', {
          format,
          split: pieces.length > 1,
          piece_count: pieces.length,
        });
        offerPlannerBridge();

        if (splitStats) {
          // The unstacked ZIP holds one file per slot (full set), so report the
          // piece count plainly. Stacking collapses identical slots into shared
          // towers, where the unique-vs-total split is the informative number.
          if (splitStats.stackEnabled && splitStats.uniqueCount < splitStats.totalPieces) {
            useToastStore.getState().addToast(
              t('baseplate.export.dedupSuccess', {
                unique: splitStats.uniqueCount,
                total: splitStats.totalPieces,
              }),
              'success'
            );
          } else {
            useToastStore
              .getState()
              .addToast(
                t('baseplate.export.splitSuccess', { count: splitStats.totalPieces }),
                'success'
              );
          }
        }

        return true;
      } catch (error: unknown) {
        useToastStore.getState().addToast(getErrorMessage(error, 'Export failed'), 'error');
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
      drawerOutline,
      gridUnitMm,
      gridUnitMmY,
      magnetAnchor,
      fractionalEdgeX,
      fractionalEdgeY,
      gridShiftX,
      gridShiftY,
      baseplateParams,
      printBedSize,
      printBedDepth,
      exportFileNameConfig,
      setExportProgress,
      offerPlannerBridge,
    ]
  );

  return {
    isExporting,
    canExport,
    exportProgress,
    downloadBaseplate,
  };
}
