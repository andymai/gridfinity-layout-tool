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
    gridUnitMm,
    heightUnitMm,
    halfBinMode,
    setParam,
    setParams,
    toggleHalfBinMode,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
      heightUnitMm: s.params.heightUnitMm,
      halfBinMode: s.ui.halfBinMode,
      setParam: s.setParam,
      setParams: s.setParams,
      toggleHalfBinMode: s.toggleHalfBinMode,
    }))
  );
  const t = useTranslation();

  const dimensionStep = halfBinMode ? 0.5 : 1;
  const minDimension = halfBinMode ? 0.5 : 1;

  const widthMm = width * gridUnitMm;
  const depthMm = depth * gridUnitMm;
  const heightMm = height * heightUnitMm;

  const handleWidthStep = useCallback(
    (delta: number) => {
      const next = width + delta * dimensionStep;
      const clamped = Math.min(DESIGNER_CONSTRAINTS.MAX_DIMENSION, Math.max(minDimension, next));
      setParam('width', clamped);
    },
    [width, dimensionStep, minDimension, setParam]
  );

  const handleDepthStep = useCallback(
    (delta: number) => {
      const next = depth + delta * dimensionStep;
      const clamped = Math.min(DESIGNER_CONSTRAINTS.MAX_DIMENSION, Math.max(minDimension, next));
      setParam('depth', clamped);
    },
    [depth, dimensionStep, minDimension, setParam]
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

  const handleSwapDimensions = useCallback(() => {
    setParams({ width: depth, depth: width });
  }, [width, depth, setParams]);

  const handleSetParam = useCallback(
    <K extends keyof BinParams>(key: K, value: BinParams[K]) => {
      if ((key === 'width' || key === 'depth') && isFractional(value as number) && !halfBinMode) {
        toggleHalfBinMode();
      }
      setParam(key, value);
    },
    [halfBinMode, toggleHalfBinMode, setParam]
  );

  return {
    state: {
      width,
      depth,
      height,
      widthMm,
      depthMm,
      heightMm,
      halfBinMode,
      dimensionStep,
      minDimension,
    },
    handlers: {
      setParam: handleSetParam,
      handleWidthStep,
      handleDepthStep,
      handleHeightStep,
      handleSwapDimensions,
      toggleHalfBinMode,
    },
    t,
  };
}
