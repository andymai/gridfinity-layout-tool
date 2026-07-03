import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { useDesignerStore } from '@/features/bin-designer/store';
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
  // Y grid pitch is a designer-local override (X pitch + height unit stay owned
  // by the layout store, in sync with the planner). `gridUnitMmY === undefined`
  // is "square" mode: a single shared grid unit, with no Y field shown. A
  // concrete value is "non-square" mode: X and Y are edited independently.
  const gridUnitMmY = useDesignerStore((s) => s.params.gridUnitMmY);
  const nonSquare = gridUnitMmY !== undefined;
  const effectiveGridUnitMmY = gridUnitMmY ?? gridUnitMm;
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
    // Only edits the shared X pitch. In non-square mode the designer-local Y
    // pitch is preserved by `useSyncPhysicalUnits` (it spreads existing params),
    // so changing X never drags Y — the two fields are independent.
    useLayoutStore.getState().setGridUnitMm(value);
  }, []);

  // Y pitch is a concrete per-design value while non-square mode is on. Stored
  // as-is (even when equal to X) so the field stays independent — `undefined`
  // is reserved for the square/off state, toggled below.
  const handleGridUnitYChange = useCallback((value: number) => {
    const clamped = Math.max(1, Math.min(200, value));
    useDesignerStore.getState().setParam('gridUnitMmY', clamped);
  }, []);

  // Toggle non-square mode. Enabling seeds Y from the current X (so the bin
  // stays square until the user changes Y); disabling clears the override back
  // to a square grid (geometry byte-identical to before the feature).
  const handleToggleNonSquare = useCallback((enabled: boolean) => {
    const x = useLayoutStore.getState().layout.gridUnitMm;
    useDesignerStore.getState().setParam('gridUnitMmY', enabled ? x : undefined);
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
      printBedDepth,
      nozzleSizeMm,
    },
    handlers: {
      handleGridUnitChange,
      handleGridUnitYChange,
      handleToggleNonSquare,
      handleHeightUnitChange,
      handlePrintBedChange,
      handleNozzleChange,
    },
    meta,
    t,
  };
}
