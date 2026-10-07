import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { FIT_TEST_MIN_THICKNESS_MM, fitTestThicknessRangeMm } from '@/shared/utils/fitTestPlan';
import {
  FIT_TEST_OUTLINE_HEIGHT_MM,
  FIT_TEST_OUTLINE_WALL_MM,
} from '@/shared/utils/fitTestOutlinePlan';
import { stepOnGrid, useFitTestOptions } from './useFitTestOptions';

const cutout = (over: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'circle',
  x: 10,
  y: 10,
  width: 12,
  depth: 12,
  cutDepth: 4,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...over,
});

function board(cutouts: Cutout[] = [cutout()]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts,
    cutoutConfig: { topOffset: 0 },
  };
}

describe('stepOnGrid', () => {
  it('steps along multiples of the step', () => {
    expect(stepOnGrid(3, 1, 0.5)).toBe(3.5);
    expect(stepOnGrid(3, -1, 0.5)).toBe(2.5);
  });

  it('brings an off-grid value onto the grid in the direction of travel', () => {
    expect(stepOnGrid(0.2, 1, 0.5)).toBe(0.5);
    expect(stepOnGrid(3.3, 1, 0.5)).toBe(3.5);
    expect(stepOnGrid(3.3, -1, 0.5)).toBe(3);
  });

  it('is not thrown a step short by float noise', () => {
    expect(stepOnGrid(0.6, 1, 0.2)).toBe(0.8);
    expect(stepOnGrid(0.6, -1, 0.2)).toBe(0.4);
  });
});

describe('useFitTestOptions', () => {
  it('opens on the full card at the design default', () => {
    const { result } = renderHook(() => useFitTestOptions(board()));
    expect(result.current.mode).toBe('card');
    expect(result.current.thicknessMm).toBe(4);
    expect(result.current.outline).toEqual({
      heightMm: FIT_TEST_OUTLINE_HEIGHT_MM.default,
      wallMm: FIT_TEST_OUTLINE_WALL_MM.default,
    });
  });

  it('switches to the outline and keeps the card thickness for a switch back', () => {
    const { result } = renderHook(() => useFitTestOptions(board()));
    act(() => result.current.setThickness(2.5));
    act(() => result.current.setMode('outline'));
    expect(result.current.mode).toBe('outline');
    act(() => result.current.setMode('card'));
    expect(result.current.thicknessMm).toBe(2.5);
  });

  it('tracks the design default until the thickness is touched', () => {
    const { result, rerender } = renderHook(({ params }) => useFitTestOptions(params), {
      initialProps: { params: board() },
    });
    expect(result.current.thicknessMm).toBe(4);
    rerender({ params: board([cutout({ cutDepth: 2 })]) });
    expect(result.current.thicknessMm).toBe(3);

    act(() => result.current.setThickness(2.5));
    rerender({ params: board([cutout({ cutDepth: 8 })]) });
    expect(result.current.thicknessMm).toBe(2.5);
  });

  it('clamps a typed thickness into the design range', () => {
    const params = board();
    const { result } = renderHook(() => useFitTestOptions(params));
    act(() => result.current.setThickness(0));
    expect(result.current.thicknessMm).toBe(FIT_TEST_MIN_THICKNESS_MM);
    act(() => result.current.setThickness(500));
    expect(result.current.thicknessMm).toBe(fitTestThicknessRangeMm(params).max);
  });

  it('steps the card thickness off a single layer onto the half-millimetre grid', () => {
    const { result } = renderHook(() => useFitTestOptions(board()));
    act(() => result.current.setThickness(0.2));
    act(() => result.current.stepThickness(1));
    expect(result.current.thicknessMm).toBe(0.5);
    act(() => result.current.stepThickness(-1));
    act(() => result.current.stepThickness(-1));
    expect(result.current.thicknessMm).toBe(FIT_TEST_MIN_THICKNESS_MM);
  });

  it('steps the outline down to a single layer and no further', () => {
    const { result } = renderHook(() => useFitTestOptions(board()));
    for (let i = 0; i < 5; i++) act(() => result.current.stepOutlineHeight(-1));
    expect(result.current.outline.heightMm).toBe(FIT_TEST_OUTLINE_HEIGHT_MM.min);
    act(() => result.current.stepOutlineHeight(1));
    expect(result.current.outline.heightMm).toBe(0.4);
  });

  it('clamps the ring width it is given', () => {
    const { result } = renderHook(() => useFitTestOptions(board()));
    act(() => result.current.setOutlineWall(0.1));
    expect(result.current.outline.wallMm).toBe(FIT_TEST_OUTLINE_WALL_MM.min);
    act(() => result.current.stepOutlineWall(1));
    expect(result.current.outline.wallMm).toBe(1.2);
    act(() => result.current.setOutlineWall(99));
    expect(result.current.outline.wallMm).toBe(FIT_TEST_OUTLINE_WALL_MM.max);
  });
});
