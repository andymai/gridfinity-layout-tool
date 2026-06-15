import { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { calcMaxGridUnits } from '@/core/constants';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { getSplitPieceCount } from '@/shared/utils/splitPositions';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';

export type SplitAxis = 'width' | 'depth' | 'both';

export function useSplitOptionsSection() {
  const {
    width,
    depth,
    gridUnitMm,
    base,
    splitConnectors,
    splitViewMode,
    setParam,
    setSplitViewMode,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      gridUnitMm: s.params.gridUnitMm,
      base: s.params.base,
      splitConnectors: s.params.splitConnectors,
      splitViewMode: s.ui.splitViewMode,
      setParam: s.setParam,
      setSplitViewMode: s.setSplitViewMode,
    }))
  );

  const { defaultPrintBedSize, defaultPrintBedDepth, nozzleSizeMm } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultPrintBedDepth: s.settings.defaultPrintBedDepth,
      nozzleSizeMm: s.settings.printSettings.nozzleSizeMm,
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

  // The alignment connector is a 45° floor scarf that needs a solid floor; a
  // lightweight base is shelled + hollow (cut planes land over the cup recesses),
  // so the worker force-disables it for lite bins. Surface that in the UI and
  // block the toggle so it doesn't look enabled-but-ignored. Wall connectors
  // live in the solid walls and stay available.
  const alignmentUnavailable = base.lightweight && base.style !== 'flat';

  const toggleEnabled = useCallback(() => {
    if (alignmentUnavailable) return;
    setParam('splitConnectors', { ...config, enabled: !config.enabled });
  }, [alignmentUnavailable, config, setParam]);

  const toggleWallConnector = useCallback(() => {
    const next = config.wallConnector === 'key' ? 'none' : 'key';
    setParam('splitConnectors', { ...config, wallConnector: next });
  }, [config, setParam]);

  const handlers = useMemo(
    () => ({
      toggleEnabled,
      toggleWallConnector,
      setSplitViewMode,
    }),
    [toggleEnabled, toggleWallConnector, setSplitViewMode]
  );

  // A wider nozzle enlarges connector/wall-lock features and clearances; the
  // worker drops a feature that no longer fits a narrow piece. Surface that as an
  // advisory only when it's relevant: a connector is on AND the nozzle is wider
  // than the 0.4mm baseline (at which geometry is unchanged).
  const connectorsOn = config.enabled || config.wallConnector === 'key';
  const showNozzleNotice = connectorsOn && nozzleSizeMm > NOZZLE_BASELINE;

  return {
    needsSplit,
    pieceCount,
    splitAxis,
    config,
    splitViewMode,
    handlers,
    nozzleSizeMm,
    showNozzleNotice,
    alignmentUnavailable,
  };
}
