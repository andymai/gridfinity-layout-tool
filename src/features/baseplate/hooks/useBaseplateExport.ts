/**
 * Hook for exporting the baseplate as STL, STEP, or 3MF.
 *
 * Thin wrapper over the pure `buildBaseplateExportPieces` builder: reads the
 * layout/settings/page stores, builds the export pieces, then packages them as a
 * single download (one un-split plate) or a ZIP with a print guide.
 */

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { getActiveBridge, workerPoolManager } from '@/shared/generation/bridge';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import { useToastStore } from '@/core/store/toast';
import { getErrorMessage } from '@/shared/utils/errors';
import { useTranslation } from '@/i18n';
import type { ExportFileFormat } from '@/shared/types/bin';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildBaseplateExportPieces } from '../utils/buildBaseplateExportPieces';

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

  const {
    drawerWidth,
    drawerDepth,
    drawerOutline,
    gridUnitMm,
    magnetAnchor,
    fractionalEdgeX,
    fractionalEdgeY,
    baseplateParams,
    printBedSize,
    printBedDepth,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      drawerOutline: state.layout.drawer.outline,
      gridUnitMm: state.layout.gridUnitMm,
      magnetAnchor: state.layout.magnetAnchor,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
      printBedSize: state.layout.printBedSize,
      printBedDepth: state.layout.printBedDepth,
    }))
  );

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

      try {
        const printSettings = useSettingsStore.getState().settings.printSettings;
        const { pieces, guideText, baseNameNoExt, extension, splitStats } =
          await buildBaseplateExportPieces(bridge, workerPoolManager.get(), {
            baseplateParams,
            drawerWidth,
            drawerDepth,
            drawerOutline,
            gridUnitMm,
            magnetAnchor,
            fractionalEdgeX,
            fractionalEdgeY,
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
            guideText ? [{ name: 'print-guide.txt', content: guideText }] : undefined
          );
          triggerDownload(zip, `${baseNameNoExt}.zip`);
        }

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
      magnetAnchor,
      fractionalEdgeX,
      fractionalEdgeY,
      baseplateParams,
      printBedSize,
      printBedDepth,
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
