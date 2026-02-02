import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import type { SectionMeta } from '../types';

export function usePhysicalUnitsSection() {
  const { gridUnitMm, heightUnitMm, setParam } = useDesignerStore(
    useShallow((s) => ({
      gridUnitMm: s.params.gridUnitMm,
      heightUnitMm: s.params.heightUnitMm,
      setParam: s.setParam,
    }))
  );
  const { printBedSize, updateSetting } = useSettingsStore(
    useShallow((s) => ({
      printBedSize: s.settings.defaultPrintBedSize,
      updateSetting: s.updateSetting,
    }))
  );
  const t = useTranslation();

  const handleGridUnitChange = useCallback(
    (value: number) => {
      setParam('gridUnitMm', value);
    },
    [setParam]
  );

  const handleHeightUnitChange = useCallback(
    (value: number) => {
      setParam('heightUnitMm', value);
    },
    [setParam]
  );

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
