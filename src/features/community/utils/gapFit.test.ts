import { describe, expect, it } from 'vitest';
import type { CommunityDesignMetrics } from '@/shared/types/community';
import type { FitsGapContext } from '../store/browseStore';
import { gapFitVerdict } from './gapFit';

const UNIT = 42;

/**
 * Metrics for a design of `w` x `d` grid units and `h` height units, sized
 * against its own `gridUnitMm` so a non-default scale produces coherent
 * millimetres rather than 42mm dimensions wearing another unit's label.
 */
function metrics(w: number, d: number, h = 3, gridUnitMm = UNIT): CommunityDesignMetrics {
  return {
    width: w * gridUnitMm - 0.5,
    depth: d * gridUnitMm - 0.5,
    height: h * 7,
    gridUnitMm,
  };
}

function gap(overrides: Partial<FitsGapContext> = {}): FitsGapContext {
  return {
    widthMax: 3,
    depthMax: 2,
    maxHeight: 6,
    gridUnitMm: UNIT,
    gridUnitMmY: UNIT,
    heightUnitMm: 7,
    ...overrides,
  };
}

describe('gapFitVerdict', () => {
  it('fits when it is smaller in both axes', () => {
    expect(gapFitVerdict(metrics(2, 1), gap())).toBe('fits');
  });

  it('fits at exactly the gap size', () => {
    expect(gapFitVerdict(metrics(3, 2), gap())).toBe('fits');
  });

  it('reports a rotated fit rather than rejecting it', () => {
    // Placement probes both orientations, so a 2x3 does fit a 3x2 gap.
    expect(gapFitVerdict(metrics(2, 3), gap())).toBe('fits-rotated');
  });

  it('rejects a design too large in both orientations', () => {
    expect(gapFitVerdict(metrics(4, 4), gap())).toBe('too-large');
  });

  it('rejects a design taller than the remaining stack budget', () => {
    expect(gapFitVerdict(metrics(2, 1, 9), gap())).toBe('too-tall');
  });

  it('accepts any height when the gap has no ceiling', () => {
    expect(gapFitVerdict(metrics(2, 1, 99), gap({ maxHeight: null }))).toBe('fits');
  });

  it('rejects a mismatched grid scale before comparing sizes', () => {
    // Comparing footprints across different grid units compares numbers that
    // do not mean the same thing, and placement hard-rejects them anyway.
    expect(gapFitVerdict(metrics(1, 1, 1, 30), gap())).toBe('scale-mismatch');
  });

  it('checks height before footprint, so the ceiling is the stated reason', () => {
    expect(gapFitVerdict(metrics(9, 9, 9), gap())).toBe('too-tall');
  });
});
