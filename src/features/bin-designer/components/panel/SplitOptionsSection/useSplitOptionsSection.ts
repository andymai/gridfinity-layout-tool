import { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { calcMaxGridUnits } from '@/core/constants';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { getSplitPieceCount } from '@/features/bin-designer/utils/splitPositions';
import type { SplitConnectorConfig } from '@/features/bin-designer/types';

export function useSplitOptionsSection() {
  const { width, depth, splitConnectors, splitViewMode, setParam, setSplitViewMode } =
    useDesignerStore(
      useShallow((s) => ({
        width: s.params.width,
        depth: s.params.depth,
        splitConnectors: s.params.splitConnectors,
        splitViewMode: s.ui.splitViewMode,
        setParam: s.setParam,
        setSplitViewMode: s.setSplitViewMode,
      }))
    );

  const { defaultPrintBedSize, defaultGridUnitMm } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultGridUnitMm: s.settings.defaultGridUnitMm,
    }))
  );

  const maxGridUnits = useMemo(
    () => calcMaxGridUnits(defaultPrintBedSize, defaultGridUnitMm),
    [defaultPrintBedSize, defaultGridUnitMm]
  );

  const needsSplit = width > maxGridUnits || depth > maxGridUnits;

  const pieceCount = useMemo(
    () => (needsSplit ? getSplitPieceCount(width, depth, maxGridUnits) : 1),
    [width, depth, maxGridUnits, needsSplit]
  );

  const config: SplitConnectorConfig = splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG;

  const update = useCallback(
    (patch: Partial<SplitConnectorConfig>) => {
      setParam('splitConnectors', { ...config, ...patch });
    },
    [config, setParam]
  );

  const handlers = useMemo(
    () => ({
      toggleEnabled: () => update({ enabled: !config.enabled }),
      setClearance: (v: number) => update({ clearance: v }),
      setSplitViewMode,
    }),
    [config.enabled, update, setSplitViewMode]
  );

  return {
    needsSplit,
    pieceCount,
    config,
    splitViewMode,
    handlers,
  };
}
