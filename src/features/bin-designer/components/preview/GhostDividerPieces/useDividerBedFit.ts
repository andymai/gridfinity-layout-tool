import { useMemo } from 'react';
import { useSettingsStore } from '@/core/store';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutPrintBed } from '@/features/bin-designer/hooks/useLayoutPrintBed';
import { binBedFit, binNeedsSplit } from '@/shared/utils/binSplitFit';
import type { DividerBedFit } from '@/shared/utils/dividerJoint';

/**
 * The bed fit the export cuts this bin's divider pieces for, as `useExport`
 * passes it: only when the bin itself is split for the bed. Undefined when the
 * pieces ship whole.
 */
export function useDividerBedFit(): DividerBedFit | undefined {
  const params = useDesignerStore((s) => s.params);
  const { printBedSize, printBedDepth } = useLayoutPrintBed();
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  return useMemo(() => {
    if (!binNeedsSplit(params, binBedFit(params, printBedSize, printBedDepth))) return undefined;
    return {
      printBed: { widthMm: printBedSize, depthMm: printBedDepth ?? printBedSize },
      nozzleSizeMm,
    };
  }, [params, printBedSize, printBedDepth, nozzleSizeMm]);
}
