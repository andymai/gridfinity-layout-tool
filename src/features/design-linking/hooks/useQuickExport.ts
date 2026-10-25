/**
 * Quick export hook for exporting linked designs to STL.
 *
 * Acquires the shared bridge via BridgeManager for export and releases it when done.
 * Shows loading state during the process.
 */

import { useCallback, useState } from 'react';
import type { DesignId } from '@/core/types';
import { bridgeManager } from '@/shared/generation/bridge';
import { FORMAT_MIME_TYPES, triggerDownload } from '@/shared/generation/exportUtils';
import { withLowProfileBase } from '@/shared/generation/lowProfileBase';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { withPlacedTabCaption } from '@/shared/utils/placedCaption';
import { useLayoutStore } from '@/core/store/layout';
import { generateFileName, loadDesign } from '@/features/bin-designer';
import { assemblyDescriptor } from '@/shared/items/assembly/descriptor';
import { useSettingsStore, useToastStore } from '@/core/store';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';

interface UseQuickExportReturn {
  /** Whether an export is currently in progress */
  readonly isExporting: boolean;
  /** Export a design to STL as the bin labeled `binLabel` prints it, and trigger download */
  readonly exportToSTL: (id: DesignId, designName: string, binLabel: string) => Promise<void>;
}

/**
 * Hook for quick STL export from the inspector.
 * Loads design from storage and uses the shared bridge for generation.
 */
export function useQuickExport(): UseQuickExportReturn {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [isExporting, setIsExporting] = useState(false);

  const exportToSTL = useCallback(
    async (id: DesignId, designName: string, binLabel: string) => {
      if (isExporting) return;

      setIsExporting(true);
      // Read before any await: the export must match the settings it began under.
      const lowProfileBase = useLayoutStore.getState().layout.lowProfileBase;
      const nozzleSizeMm = useSettingsStore.getState().settings.printSettings.nozzleSizeMm;

      try {
        const designResult = await loadDesign(id);
        if (!isOk(designResult)) {
          addToast({
            message: t('designLinking.toast.exportFailed'),
            type: 'error',
            duration: 4000,
          });
          return;
        }
        const design = designResult.value;
        const assembly =
          design.structure?.kind === 'assembly' && design.envelope
            ? { envelope: design.envelope, structure: design.structure }
            : null;
        if (!design.params && !assembly) return;

        const bridge = await bridgeManager.acquire();
        try {
          let pieces: readonly { data: ArrayBuffer; label: string }[];
          let fileName: string;
          if (design.params) {
            // Exported from the layout, so the layout's foot profile and the
            // bin's own label apply. Combined, so the lid, dividers and
            // detachable feet ship with the body as they do from the designer.
            const params = withSocketNozzle(
              withPlacedTabCaption(withLowProfileBase(design.params, lowProfileBase), binLabel),
              nozzleSizeMm
            );
            pieces = (await bridge.exportCombined(params, 'stl')).pieces;
            fileName = generateFileName(
              design.params,
              'stl',
              design.exportFileNameConfig ?? 'descriptive',
              design.name
            );
          } else if (assembly) {
            pieces = [{ data: (await bridge.exportItem(assembly, 'stl')).data, label: 'item' }];
            fileName = `${assemblyDescriptor.exportFileName(assembly.envelope, assembly.structure)}.stl`;
          } else {
            return;
          }

          if (pieces.length === 1) {
            triggerDownload(new Blob([pieces[0].data], { type: FORMAT_MIME_TYPES.stl }), fileName);
          } else {
            const baseName = fileName.replace(/\.stl$/, '');
            triggerDownload(packagePiecesAsZip(pieces, baseName, '.stl'), `${baseName}.zip`);
          }

          addToast({
            message: t('designLinking.toast.exported', { name: designName }),
            type: 'success',
            duration: 3000,
          });
        } finally {
          bridgeManager.release();
        }
      } catch {
        addToast({
          message: t('designLinking.toast.exportFailed'),
          type: 'error',
          duration: 4000,
        });
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting, addToast, t]
  );

  return {
    isExporting,
    exportToSTL,
  };
}
