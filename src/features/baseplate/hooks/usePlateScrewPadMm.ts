import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { plateScrewPadMm, type PlateLayout } from '../utils/buildFullParams';

/**
 * The mount-down screw pad the current plate prints with (see
 * `plateScrewPadMm`). Pass `lowProfileBase` to ask about the plate with the
 * layout's low-profile setting toggled.
 */
export function usePlateScrewPadMm(lowProfileBase?: boolean): number {
  const layout = useLayoutStore(
    useShallow((s): PlateLayout => ({
      drawer: s.layout.drawer,
      gridUnitMm: s.layout.gridUnitMm,
      gridUnitMmY: s.layout.gridUnitMmY,
      magnetAnchor: s.layout.magnetAnchor,
      lowProfileBase: s.layout.lowProfileBase,
      printBedSize: s.layout.printBedSize,
      printBedDepth: s.layout.printBedDepth,
      baseplateParams: s.layout.baseplateParams,
    }))
  );
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  return useMemo(
    () => plateScrewPadMm(layout, nozzleSizeMm, lowProfileBase ?? layout.lowProfileBase),
    [layout, nozzleSizeMm, lowProfileBase]
  );
}
