import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import type { SectionMeta } from '../types';

export function usePhysicalUnitsSection() {
  const { gridUnitMm, heightUnitMm } = useLayoutStore(
    useShallow((s) => ({
      gridUnitMm: s.layout.gridUnitMm,
      heightUnitMm: s.layout.heightUnitMm,
    }))
  );
  const {
    printBedSize,
    printBedDepth,
    nozzleSizeMm,
    printSettings,
    updateSettings,
    updateSetting,
  } = useSettingsStore(
    useShallow((s) => ({
      printBedSize: s.settings.defaultPrintBedSize,
      printBedDepth: s.settings.defaultPrintBedDepth ?? s.settings.defaultPrintBedSize,
      nozzleSizeMm: s.settings.printSettings.nozzleSizeMm,
      printSettings: s.settings.printSettings,
      updateSettings: s.updateSettings,
      updateSetting: s.updateSetting,
    }))
  );
  const t = useTranslation();

  const handleGridUnitChange = useCallback((value: number) => {
    useLayoutStore.getState().setGridUnitMm(value);
  }, []);

  const handleHeightUnitChange = useCallback((value: number) => {
    useLayoutStore.getState().setHeightUnitMm(value);
  }, []);

  const handlePrintBedChange = useCallback(
    (width: number, depth?: number) => {
      const clampedWidth = Math.max(42, Math.min(500, width));
      const clampedDepth = depth === undefined ? undefined : Math.max(42, Math.min(500, depth));
      updateSettings({
        defaultPrintBedSize: clampedWidth,
        defaultPrintBedDepth: clampedDepth,
      });
    },
    [updateSettings]
  );

  const handleNozzleChange = useCallback(
    (value: number) => {
      updateSetting('printSettings', { ...printSettings, nozzleSizeMm: value });
    },
    [updateSetting, printSettings]
  );

  const meta: SectionMeta = useMemo(
    () => ({ summary: `${gridUnitMm}mm grid, ${heightUnitMm}mm height` }),
    [gridUnitMm, heightUnitMm]
  );

  return {
    state: { gridUnitMm, heightUnitMm, printBedSize, printBedDepth, nozzleSizeMm },
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
