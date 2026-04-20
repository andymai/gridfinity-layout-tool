import { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { calcMaxGridUnits } from '@/core/constants';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { getSplitPieceCount } from '@/shared/utils/splitPositions';

export type SplitAxis = 'width' | 'depth' | 'both';

export function useSplitOptionsSection() {
  const { width, depth, gridUnitMm, splitConnectors, splitViewMode, setParam, setSplitViewMode } =
    useDesignerStore(
      useShallow((s) => ({
        width: s.params.width,
        depth: s.params.depth,
        gridUnitMm: s.params.gridUnitMm,
        splitConnectors: s.params.splitConnectors,
        splitViewMode: s.ui.splitViewMode,
        setParam: s.setParam,
        setSplitViewMode: s.setSplitViewMode,
      }))
    );

  const { defaultPrintBedSize, defaultPrintBedDepth } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultPrintBedDepth: s.settings.defaultPrintBedDepth,
    }))
  );

  // Use the bin's actual grid unit rather than defaultGridUnitMm from settings
  const maxGrid = useMemo(
    () => calcMaxGridUnits(defaultPrintBedSize, gridUnitMm, defaultPrintBedDepth),
    [defaultPrintBedSize, defaultPrintBedDepth, gridUnitMm]
  );

  const needsSplit = width > maxGrid.width || depth > maxGrid.depth;

  const pieceCount = useMemo(
    () => (needsSplit ? getSplitPieceCount(width, depth, maxGrid.width, maxGrid.depth) : 1),
    [width, depth, maxGrid.width, maxGrid.depth, needsSplit]
  );

  const splitAxis: SplitAxis = useMemo(() => {
    if (!needsSplit) return 'width';
    const splitW = width > maxGrid.width;
    const splitD = depth > maxGrid.depth;
    if (splitW && splitD) return 'both';
    if (splitD) return 'depth';
    return 'width';
  }, [needsSplit, width, depth, maxGrid.width, maxGrid.depth]);

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
