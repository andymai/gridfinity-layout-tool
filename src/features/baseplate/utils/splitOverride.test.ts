import { describe, expect, it } from 'vitest';
import { gridUnits } from '@gridfinity/branded-types';
import type { SplitOverride } from '@/core/types';
import {
  chunksToSeams,
  normalizeSplitOverride,
  seamPositions,
  seamsToChunks,
  splitOverrideFromSeams,
  toggleSeam,
} from './splitOverride';

const override = (cols: number[], rows: number[]): SplitOverride => ({
  cols: cols.map(gridUnits),
  rows: rows.map(gridUnits),
});

describe('seamPositions', () => {
  it('returns the interior integer boundaries of a whole-unit axis', () => {
    expect(seamPositions(4, 'end')).toEqual([1, 2, 3]);
  });

  it('returns nothing for a single-cell axis', () => {
    expect(seamPositions(1, 'end')).toEqual([]);
  });

  it('places the half cell at the end when the fraction rides the end edge', () => {
    // Cells are [1, 1, 1, 0.5], so cuts land at 1, 2 and 3.
    expect(seamPositions(3.5, 'end')).toEqual([1, 2, 3]);
  });

  it('places the half cell at the start when the fraction rides the start edge', () => {
    // Cells are [0.5, 1, 1, 1], so cuts land at 0.5, 1.5 and 2.5.
    expect(seamPositions(3.5, 'start')).toEqual([0.5, 1.5, 2.5]);
  });
});

describe('chunk/seam conversion', () => {
  it('round-trips chunks through seams', () => {
    expect(seamsToChunks(chunksToSeams([3, 4, 2]), 9)).toEqual([3, 4, 2]);
  });

  it('reports no seams for a single chunk', () => {
    expect(chunksToSeams([9])).toEqual([]);
  });

  it('sorts unordered seams before slicing', () => {
    expect(seamsToChunks([6, 2], 9)).toEqual([2, 4, 3]);
  });

  it('keeps a fractional trailing chunk intact', () => {
    expect(seamsToChunks([3], 5.5)).toEqual([3, 2.5]);
  });
});

describe('toggleSeam', () => {
  it('adds a missing seam in sorted position', () => {
    expect(toggleSeam([2, 6], 4)).toEqual([2, 4, 6]);
  });

  it('removes an existing seam', () => {
    expect(toggleSeam([2, 4, 6], 4)).toEqual([2, 6]);
  });

  it('matches a seam stored with float drift rather than duplicating it', () => {
    expect(toggleSeam([2.0000000001], 2)).toEqual([]);
  });
});

describe('normalizeSplitOverride', () => {
  it('keeps a plan that matches the plate', () => {
    const plan = override([5, 4], [3, 3]);
    expect(normalizeSplitOverride(plan, 9, 6, 'end', 'end')).toBe(plan);
  });

  it('passes undefined straight through', () => {
    expect(normalizeSplitOverride(undefined, 9, 6, 'end', 'end')).toBeUndefined();
  });

  it('drops a plan whose columns no longer sum to the width', () => {
    // The classic case: the user shrinks the grid after drawing a plan.
    expect(normalizeSplitOverride(override([5, 4], [3, 3]), 8, 6, 'end', 'end')).toBeUndefined();
  });

  it('drops a plan whose rows no longer sum to the depth', () => {
    expect(normalizeSplitOverride(override([5, 4], [3, 3]), 9, 8, 'end', 'end')).toBeUndefined();
  });

  it('drops a plan with a zero or negative chunk', () => {
    expect(normalizeSplitOverride(override([9, 0], [6]), 9, 6, 'end', 'end')).toBeUndefined();
    expect(normalizeSplitOverride(override([10, -1], [6]), 9, 6, 'end', 'end')).toBeUndefined();
  });

  it('drops a plan whose cut misses a cell boundary', () => {
    // Sums to 9 but slices a whole cell in half.
    expect(normalizeSplitOverride(override([4.5, 4.5], [6]), 9, 6, 'end', 'end')).toBeUndefined();
  });

  it('accepts a fractional plate whose half unit sits on its declared edge', () => {
    const plan = override([3, 2.5], [6]);
    expect(normalizeSplitOverride(plan, 5.5, 6, 'end', 'end')).toBe(plan);
  });

  it('drops a plan that puts the half unit on the wrong edge', () => {
    // Valid under fractionalEdgeX 'start', invalid under 'end' — the generator
    // places the fraction by edge, so the plan has to agree with it.
    expect(normalizeSplitOverride(override([2.5, 3], [6]), 5.5, 6, 'end', 'end')).toBeUndefined();
    expect(normalizeSplitOverride(override([2.5, 3], [6]), 5.5, 6, 'start', 'end')).toEqual(
      override([2.5, 3], [6])
    );
  });

  it('drops a non-array payload rather than trusting the server allowlist', () => {
    const hostile = { cols: 'not-an-array', rows: [6] } as unknown as SplitOverride;
    expect(normalizeSplitOverride(hostile, 9, 6, 'end', 'end')).toBeUndefined();
  });
});

describe('splitOverrideFromSeams', () => {
  it('builds a plan from per-axis seam offsets', () => {
    expect(splitOverrideFromSeams([3], [2, 4], 9, 6)).toEqual({ cols: [3, 6], rows: [2, 2, 2] });
  });

  it('builds a single-piece plan when no seams are set', () => {
    expect(splitOverrideFromSeams([], [], 9, 6)).toEqual({ cols: [9], rows: [6] });
  });
});
