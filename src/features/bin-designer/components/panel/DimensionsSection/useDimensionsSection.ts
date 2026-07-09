import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { isFractional } from '@/core/constants';
import { useTranslation } from '@/i18n';

export function useDimensionsSection() {
  const {
    width,
    depth,
    height,
    extraWallHeightMm,
    fractionalEdgeX,
    fractionalEdgeY,
    baseHalfSockets,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    halfGridMode,
    setParam,
    setParams,
    toggleHalfGridMode,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      extraWallHeightMm: s.params.extraWallHeightMm ?? 0,
      fractionalEdgeX: s.params.fractionalEdgeX,
      fractionalEdgeY: s.params.fractionalEdgeY,
      baseHalfSockets: s.params.base.halfSockets,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      heightUnitMm: s.params.heightUnitMm,
      halfGridMode: s.ui.halfGridMode,
      setParam: s.setParam,
      setParams: s.setParams,
      toggleHalfGridMode: s.toggleHalfGridMode,
    }))
  );
  const t = useTranslation();

  const dimensionStep = halfGridMode ? 0.5 : 1;
  // At least one dimension must be ≥ 1 — if the other is 0.5, this one can't go below 1
  const minWidth = halfGridMode && depth >= 1 ? 0.5 : 1;
  const minDepth = halfGridMode && width >= 1 ? 0.5 : 1;

  const widthMm = width * gridUnitMm;
  const depthMm = depth * (gridUnitMmY ?? gridUnitMm);
  const heightMm = height * heightUnitMm;

  const handleWidthStep = useCallback(
    (delta: number) => {
      const next = width + delta * dimensionStep;
      const clamped = Math.min(DESIGNER_CONSTRAINTS.MAX_DIMENSION, Math.max(minWidth, next));
      setParam('width', clamped);
    },
    [width, dimensionStep, minWidth, setParam]
  );

  const handleDepthStep = useCallback(
    (delta: number) => {
      const next = depth + delta * dimensionStep;
      const clamped = Math.min(DESIGNER_CONSTRAINTS.MAX_DIMENSION, Math.max(minDepth, next));
      setParam('depth', clamped);
    },
    [depth, dimensionStep, minDepth, setParam]
  );

  const handleHeightStep = useCallback(
    (delta: number) => {
      const next = height + delta * DESIGNER_CONSTRAINTS.HEIGHT_STEP;
      const clamped = Math.min(
        DESIGNER_CONSTRAINTS.MAX_HEIGHT,
        Math.max(DESIGNER_CONSTRAINTS.MIN_HEIGHT, next)
      );
      setParam('height', clamped);
    },
    [height, setParam]
  );

  const handleExtraWallHeightStep = useCallback(
    (delta: number) => {
      const next = extraWallHeightMm + delta * DESIGNER_CONSTRAINTS.EXTRA_WALL_HEIGHT_STEP;
      const clamped = Math.min(
        DESIGNER_CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT,
        Math.max(DESIGNER_CONSTRAINTS.MIN_EXTRA_WALL_HEIGHT, next)
      );
      setParam('extraWallHeightMm', clamped);
    },
    [extraWallHeightMm, setParam]
  );

  const handleSwapDimensions = useCallback(() => {
    // Transpose the grid: the half-foot edge preference must travel with its
    // axis, else swapping a 2.5×1 'left' bin would silently move the half foot.
    setParams({
      width: depth,
      depth: width,
      fractionalEdgeX: fractionalEdgeY,
      fractionalEdgeY: fractionalEdgeX,
    });
  }, [width, depth, fractionalEdgeX, fractionalEdgeY, setParams]);

  const handleSetParam = useCallback(
    <K extends keyof BinParams>(key: K, value: BinParams[K]) => {
      if ((key === 'width' || key === 'depth') && isFractional(value as number) && !halfGridMode) {
        toggleHalfGridMode();
      }
      setParam(key, value);
    },
    [halfGridMode, toggleHalfGridMode, setParam]
  );

  const handleFractionalEdgeChange = useCallback(
    (axis: 'x' | 'y', position: 'start' | 'end') => {
      setParam(axis === 'x' ? 'fractionalEdgeX' : 'fractionalEdgeY', position);
    },
    [setParam]
  );

  return {
    state: {
      width,
      depth,
      height,
      extraWallHeightMm,
      widthMm,
      depthMm,
      heightMm,
      halfGridMode,
      dimensionStep,
      minWidth,
      minDepth,
      fractionalEdgeX,
      fractionalEdgeY,
      // Half-sockets mode decomposes every cell into uniform 0.5u feet, so there
      // is no single half foot to reposition — hide the edge controls then.
      hasFractionalWidth: isFractional(width) && !baseHalfSockets,
      hasFractionalDepth: isFractional(depth) && !baseHalfSockets,
    },
    handlers: {
      setParam: handleSetParam,
      handleWidthStep,
      handleDepthStep,
      handleHeightStep,
      handleExtraWallHeightStep,
      handleSwapDimensions,
      toggleHalfGridMode,
      handleFractionalEdgeChange,
    },
    t,
  };
}
