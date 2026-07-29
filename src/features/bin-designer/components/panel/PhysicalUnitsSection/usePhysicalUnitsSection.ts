import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CONSTRAINTS } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import {
  GRIDFINITY_SPEC,
  MAGNET_FLOOR,
  SOCKET_HEIGHT_MM_DEFAULT,
  SOCKET_HEIGHT_MM_LOW,
  SOCKET_HEIGHT_MM_MIN,
} from '@/shared/printSettings/gridfinityGeometry';
import { useMutations } from '@/shared/contexts';
import { useTranslation } from '@/i18n';
import type { SectionMeta } from '../types';

/** Base-profile presets (mm) shown as quick-select buttons. */
export const SOCKET_HEIGHT_PRESETS = {
  standard: SOCKET_HEIGHT_MM_DEFAULT,
  low: SOCKET_HEIGHT_MM_LOW,
  minimal: SOCKET_HEIGHT_MM_MIN,
} as const;

// The designer accepts the storage-layer grid pitch range (coreActions clamps
// to 1-200), deliberately wider than the sidebar's 20-60 authoring range.
export const DESIGNER_GRID_UNIT_MM_MIN = 1;
export const DESIGNER_GRID_UNIT_MM_MAX = 200;

export function usePhysicalUnitsSection() {
  const { gridUnitMm, heightUnitMm, socketHeightMm } = useLayoutStore(
    useShallow((s) => ({
      gridUnitMm: s.layout.gridUnitMm,
      heightUnitMm: s.layout.heightUnitMm,
      socketHeightMm: s.layout.socketHeightMm,
    }))
  );
  // An unset value is the standard profile. Below (magnetDepth + retaining
  // floor) the base is too thin to hold a magnet, so the generator auto-disables
  // magnet holes — surface a note here so the user understands why.
  const effectiveSocketHeightMm = socketHeightMm ?? SOCKET_HEIGHT_MM_DEFAULT;
  const magnetsDisabled = effectiveSocketHeightMm < GRIDFINITY_SPEC.MAGNET_DEPTH + MAGNET_FLOOR;
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
  const mutations = useMutations();

  // Linked grid-pitch control. X edits the shared layout pitch; the Y pitch is
  // a designer-local override where `undefined` means square (relinked) —
  // geometry byte-identical to before the non-square feature. Each write is
  // guarded against no-ops: setParam unconditionally pushes an undo entry and
  // regenerates, so a pure X edit must not touch the Y param.
  const handleGridUnitChange = useCallback((x: number, y?: number) => {
    if (x !== useLayoutStore.getState().layout.gridUnitMm) {
      useLayoutStore.getState().setGridUnitMm(x);
    }
    const nextY =
      y === undefined ? undefined : clamp(y, DESIGNER_GRID_UNIT_MM_MIN, DESIGNER_GRID_UNIT_MM_MAX);
    if (nextY !== useDesignerStore.getState().params.gridUnitMmY) {
      useDesignerStore.getState().setParam('gridUnitMmY', nextY);
    }
  }, []);

  const handleHeightUnitChange = useCallback((value: number) => {
    useLayoutStore.getState().setHeightUnitMm(value);
  }, []);

  // Dispatch through the CQRS mutations path (not the raw store setter) so the
  // base-profile change is undoable and publishes an event.
  const handleSocketHeightChange = useCallback(
    (value: number) => {
      mutations.setSocketHeightMm(
        clamp(value, CONSTRAINTS.SOCKET_HEIGHT_MM_MIN, CONSTRAINTS.SOCKET_HEIGHT_MM_MAX)
      );
    },
    [mutations]
  );

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
      socketHeightMm: effectiveSocketHeightMm,
      magnetsDisabled,
      printBedSize,
      printBedDepth,
      nozzleSizeMm,
    },
    handlers: {
      handleGridUnitChange,
      handleHeightUnitChange,
      handleSocketHeightChange,
      handlePrintBedChange,
      handleNozzleChange,
    },
    meta,
    t,
  };
}
