import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { CONSTRAINTS } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import { useTranslation } from '@/i18n';
import type { SectionMeta } from '../types';

export function usePhysicalUnitsSection() {
  const { gridUnitMm, heightUnitMm } = useLayoutStore(
    useShallow((s) => ({
      gridUnitMm: s.layout.gridUnitMm,
      heightUnitMm: s.layout.heightUnitMm,
    }))
  );
  const { printBedSize, printBedDepth, nozzleSizeMm, updateSettings, updateSetting } =
    useSettingsStore(
      useShallow((s) => ({
        printBedSize: s.settings.defaultPrintBedSize,
        printBedDepth: s.settings.defaultPrintBedDepth ?? s.settings.defaultPrintBedSize,
        nozzleSizeMm: s.settings.printSettings.nozzleSizeMm,
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
      const clampedWidth = clamp(width, CONSTRAINTS.PRINT_BED_MM_MIN, CONSTRAINTS.PRINT_BED_MM_MAX);
      const clampedDepth =
        depth === undefined
          ? undefined
          : clamp(depth, CONSTRAINTS.PRINT_BED_MM_MIN, CONSTRAINTS.PRINT_BED_MM_MAX);
      updateSettings({
        defaultPrintBedSize: clampedWidth,
        defaultPrintBedDepth: clampedDepth,
      });
    },
    [updateSettings]
  );

  const handleNozzleChange = useCallback(
    (value: number) => {
      const current = useSettingsStore.getState().settings.printSettings;
      updateSetting('printSettings', { ...current, nozzleSizeMm: value });
    },
    [updateSetting]
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
