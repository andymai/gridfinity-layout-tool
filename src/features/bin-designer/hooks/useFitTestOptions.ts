/** Every value handed out is already clamped by the plan the worker clamps with. */

import { useCallback, useMemo, useState } from 'react';
import type { BinParams } from '@/shared/types/bin';
import {
  clampFitTestThicknessMm,
  defaultFitTestThicknessMm,
  fitTestThicknessRangeMm,
} from '@/shared/utils/fitTestPlan';
import {
  FIT_TEST_OUTLINE_HEIGHT_MM,
  FIT_TEST_OUTLINE_WALL_MM,
  clampFitTestOutlineHeightMm,
  clampFitTestOutlineWallMm,
} from '@/shared/utils/fitTestOutlinePlan';
import type { FitTestMode, FitTestOutlineSize } from '@/shared/utils/fitTestOutlinePlan';

/** Stepper increment for the card thickness. Matches the cutout fit fields. */
export const FIT_TEST_THICKNESS_STEP = 0.5;

/**
 * `delta` steps from `value` along multiples of `step`. A value off the grid,
 * such as a range floor that is not a multiple, lands on the next grid point
 * rather than carrying its offset through every later step.
 */
export function stepOnGrid(value: number, delta: number, step: number): number {
  const index = value / step;
  const next = delta > 0 ? Math.floor(index + 1e-6) + delta : Math.ceil(index - 1e-6) + delta;
  return Number((next * step).toFixed(2));
}

export interface FitTestOptions {
  readonly mode: FitTestMode;
  readonly setMode: (mode: FitTestMode) => void;
  readonly thicknessMm: number;
  readonly thicknessRange: { readonly min: number; readonly max: number };
  readonly setThickness: (mm: number) => void;
  readonly stepThickness: (delta: number) => void;
  readonly outline: FitTestOutlineSize;
  readonly setOutlineHeight: (mm: number) => void;
  readonly stepOutlineHeight: (delta: number) => void;
  readonly setOutlineWall: (mm: number) => void;
  readonly stepOutlineWall: (delta: number) => void;
}

export function useFitTestOptions(params: BinParams): FitTestOptions {
  const [mode, setMode] = useState<FitTestMode>('card');
  // Null until the user touches the field, so the default tracks the design as
  // cutouts are added rather than freezing at whatever it was when mounted.
  const [thickness, setThicknessRaw] = useState<number | null>(null);
  const [heightMm, setHeightMm] = useState(FIT_TEST_OUTLINE_HEIGHT_MM.default);
  const [wallMm, setWallMm] = useState(FIT_TEST_OUTLINE_WALL_MM.default);

  const thicknessRange = useMemo(() => fitTestThicknessRangeMm(params), [params]);
  const thicknessMm = clampFitTestThicknessMm(
    params,
    thickness ?? defaultFitTestThicknessMm(params)
  );

  const setThickness = useCallback(
    (mm: number) => setThicknessRaw(clampFitTestThicknessMm(params, Number(mm.toFixed(2)))),
    [params]
  );
  const stepThickness = useCallback(
    (delta: number) => setThickness(stepOnGrid(thicknessMm, delta, FIT_TEST_THICKNESS_STEP)),
    [setThickness, thicknessMm]
  );

  const setOutlineHeight = useCallback(
    (mm: number) => setHeightMm(clampFitTestOutlineHeightMm(Number(mm.toFixed(2)))),
    []
  );
  const stepOutlineHeight = useCallback(
    (delta: number) =>
      setHeightMm((h) =>
        clampFitTestOutlineHeightMm(stepOnGrid(h, delta, FIT_TEST_OUTLINE_HEIGHT_MM.step))
      ),
    []
  );
  const setOutlineWall = useCallback(
    (mm: number) => setWallMm(clampFitTestOutlineWallMm(Number(mm.toFixed(2)))),
    []
  );
  const stepOutlineWall = useCallback(
    (delta: number) =>
      setWallMm((w) =>
        clampFitTestOutlineWallMm(stepOnGrid(w, delta, FIT_TEST_OUTLINE_WALL_MM.step))
      ),
    []
  );

  const outline = useMemo(() => ({ heightMm, wallMm }), [heightMm, wallMm]);

  return {
    mode,
    setMode,
    thicknessMm,
    thicknessRange,
    setThickness,
    stepThickness,
    outline,
    setOutlineHeight,
    stepOutlineHeight,
    setOutlineWall,
    stepOutlineWall,
  };
}
