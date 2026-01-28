/**
 * Quick export hook for exporting linked designs to STL.
 *
 * Creates a temporary worker bridge, generates mesh, and downloads STL.
 * Shows loading state during the process (typically 5-10 seconds).
 */

import { useCallback, useState } from 'react';
import { GenerationBridge } from '@/features/generation/bridge';
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
 * Loads design from storage and creates a temporary worker bridge for generation.
 */
export function useQuickExport(): UseQuickExportReturn {
  const t = useTranslation();
  const { addToast } = useToastStore();
  const [isExporting, setIsExporting] = useState(false);

  const exportToSTL = useCallback(
    async (designId: string, designName: string) => {
      if (isExporting) return;

      setIsExporting(true);
      let bridge: GenerationBridge | null = null;

      try {
        // Load full design from IndexedDB
        const designResult = await loadDesign(designId);
        if (!isOk(designResult)) {
          throw new Error('Failed to load design');
        }
        const design = designResult.value;

        // Create temporary bridge for export
        bridge = new GenerationBridge();
        await bridge.init();

        // Export to STL with high quality settings
        const result = await bridge.exportBin(design.params, 'stl');

        // Generate filename
        const fileName = generateFileName(
          design.params,
          'stl',
          design.exportFileNameConfig ?? 'descriptive',
          design.name
        );

        // Trigger download
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
      } catch {
        addToast({
          message: t('designLinking.toast.exportFailed'),
          type: 'error',
          duration: 4000,
        });
      } finally {
        // Clean up bridge
        if (bridge) {
          bridge.destroy();
        }
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
