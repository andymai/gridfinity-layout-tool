import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { useLayoutPrintBed } from '@/features/bin-designer/hooks/useLayoutPrintBed';
import { useGridUnitChange } from '@/shared/hooks';
import { useTranslation } from '@/i18n';
import type { SectionMeta } from '../types';

// The designer accepts the storage-layer grid pitch range (coreActions clamps
// to 1-200), deliberately wider than the sidebar's 20-60 authoring range.
export const DESIGNER_GRID_UNIT_MM_MIN = 1;
export const DESIGNER_GRID_UNIT_MM_MAX = 200;

export function usePhysicalUnitsSection() {
  const { gridUnitMm, gridUnitMmY, heightUnitMm } = useLayoutStore(
    useShallow((s) => ({
      gridUnitMm: s.layout.gridUnitMm,
      gridUnitMmY: s.layout.gridUnitMmY,
      heightUnitMm: s.layout.heightUnitMm,
    }))
  );
  const nonSquare = gridUnitMmY !== undefined;
  const effectiveGridUnitMmY = gridUnitMmY ?? gridUnitMm;
  const { printBedSize, printBedDepth } = useLayoutPrintBed();
  const { nozzleSizeMm, updateSetting } = useSettingsStore(
    useShallow((s) => ({
      nozzleSizeMm: s.settings.printSettings.nozzleSizeMm,
      updateSetting: s.updateSetting,
    }))
  );
  const t = useTranslation();

  const handleGridUnitChange = useGridUnitChange();

  const handleHeightUnitChange = useCallback((value: number) => {
    useLayoutStore.getState().setHeightUnitMm(value);
  }, []);

  const handlePrintBedChange = useCallback((width: number, depth?: number) => {
    useLayoutStore.getState().setPrintBedSize(width, depth);
  }, []);

  const handleNozzleChange = useCallback(
    (value: number) => {
      const current = useSettingsStore.getState().settings.printSettings;
      updateSetting('printSettings', { ...current, nozzleSizeMm: value });
    },
    [updateSetting]
  );

  const meta: SectionMeta = useMemo(
    () => ({
      summary: nonSquare
        ? `${gridUnitMm}×${effectiveGridUnitMmY}mm grid, ${heightUnitMm}mm height`
        : `${gridUnitMm}mm grid, ${heightUnitMm}mm height`,
    }),
    [gridUnitMm, effectiveGridUnitMmY, heightUnitMm, nonSquare]
  );

  return {
    state: {
      gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY,
      nonSquare,
      heightUnitMm,
      printBedSize,
      printBedDepth: printBedDepth ?? printBedSize,
      nozzleSizeMm,
    },
    handlers: {
      handleGridUnitChange,
      handleHeightUnitChange,
      handlePrintBedChange,
      handleNozzleChange,
    },
    meta,
    t,
  };
}
