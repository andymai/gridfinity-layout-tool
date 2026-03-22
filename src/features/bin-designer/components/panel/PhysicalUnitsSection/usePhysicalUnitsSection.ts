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
  const { printBedSize, updateSetting } = useSettingsStore(
    useShallow((s) => ({
      printBedSize: s.settings.defaultPrintBedSize,
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
    (value: number) => {
      updateSetting('defaultPrintBedSize', Math.max(42, Math.min(500, value)));
    },
    [updateSetting]
  );

  const meta: SectionMeta = useMemo(
    () => ({ summary: `${gridUnitMm}mm grid, ${heightUnitMm}mm height` }),
    [gridUnitMm, heightUnitMm]
  );

  return {
    state: { gridUnitMm, heightUnitMm, printBedSize },
    handlers: { handleGridUnitChange, handleHeightUnitChange, handlePrintBedChange },
    meta,
    t,
  };
}
