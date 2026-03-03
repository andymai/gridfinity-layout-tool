import { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { calcMaxGridUnits } from '@/core/constants';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { getSplitPieceCount } from '@/features/bin-designer/utils/splitPositions';

export type SplitAxis = 'width' | 'depth' | 'both';

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

  const splitAxis: SplitAxis = useMemo(() => {
    if (!needsSplit) return 'width';
    const splitW = width > maxGridUnits;
    const splitD = depth > maxGridUnits;
    if (splitW && splitD) return 'both';
    if (splitD) return 'depth';
    return 'width';
  }, [needsSplit, width, depth, maxGridUnits]);

  const config = splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG;

  const toggleEnabled = useCallback(() => {
    setParam('splitConnectors', { ...config, enabled: !config.enabled });
  }, [config, setParam]);

  const handlers = useMemo(
    () => ({
      toggleEnabled,
      setSplitViewMode,
    }),
    [toggleEnabled, setSplitViewMode]
  );

  return {
    needsSplit,
    pieceCount,
    splitAxis,
    config,
    splitViewMode,
    handlers,
  };
}
