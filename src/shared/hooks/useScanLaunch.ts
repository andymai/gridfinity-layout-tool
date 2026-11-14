import { useCallback } from 'react';
import { useScanLaunchStore, type ScanLaunchSource } from '@/core/store/scanLaunch';
import { isDesignerPath, useDesignerRouting } from './useDesignerRouting';

/**
 * Ask the bin designer to open "Scan a tool". Inside the designer the scan goes
 * into the open bin; from anywhere else it starts a new bin, so a scan never
 * rewrites a bin someone was working on elsewhere.
 */
export function useScanLaunch(): (source: ScanLaunchSource) => void {
  const { navigateToDesigner } = useDesignerRouting();
  return useCallback(
    (source: ScanLaunchSource) => {
      const inDesigner = isDesignerPath();
      useScanLaunchStore.getState().requestScan(source, !inDesigner);
      if (!inDesigner) navigateToDesigner();
    },
    [navigateToDesigner]
  );
}
