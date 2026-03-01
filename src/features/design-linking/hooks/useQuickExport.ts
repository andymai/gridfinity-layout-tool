/**
 * Quick export hook for exporting linked designs to STL.
 *
 * Acquires the shared bridge via BridgeManager for export and releases it when done.
 * Shows loading state during the process.
 */

import { useCallback, useState } from 'react';
import { bridgeManager } from '@/shared/generation/bridge';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { loadDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { useToastStore } from '@/core/store';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';

interface UseQuickExportReturn {
  /** Whether an export is currently in progress */
  readonly isExporting: boolean;
  /** Export a design to STL and trigger download */
  readonly exportToSTL: (designId: string, designName: string) => Promise<void>;
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
    async (designId: string, designName: string) => {
      if (isExporting) return;

      setIsExporting(true);

      try {
        const designResult = await loadDesign(designId);
        if (!isOk(designResult)) {
          addToast({
            message: t('designLinking.toast.exportFailed'),
            type: 'error',
            duration: 4000,
          });
          return;
        }
        const design = designResult.value;

        const bridge = await bridgeManager.acquire();
        try {
          const result = await bridge.exportBin(design.params, 'stl');
          const fileName = generateFileName(
            design.params,
            'stl',
            design.exportFileNameConfig ?? 'descriptive',
            design.name
          );

          const blob = new Blob([result.data], { type: 'application/sla' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);

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
