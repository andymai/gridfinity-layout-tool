/**
 * Pure-function tests for the cut-plane / cell-boundary nudge.
 * No brepjs/WASM needed — this is shape arithmetic.
 */

import { describe, expect, it } from 'vitest';
import { shiftCutPlanesOffCellBoundaries } from './splitBinBuilder';

describe('shiftCutPlanesOffCellBoundaries', () => {
  it('nudges a cut plane that lands exactly on an interior cell boundary', () => {
    // 10 cells, cut at y=0 → cell-5 boundary (issue #1676).
    const out = shiftCutPlanesOffCellBoundaries([0], 10, 42);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeCloseTo(0.1, 5);
  });

  it('leaves a cut plane that sits cleanly between cell boundaries alone', () => {
    const out = shiftCutPlanesOffCellBoundaries([10], 10, 42);
    expect(out[0]).toBe(10);
  });

  it('only nudges INTERIOR boundaries — outer-edge planes already get EDGE_MARGIN', () => {
    // 20 cells: outer edges at y=±420, interior boundaries at y=-378..378.
    // Cut planes at ±420 are at outer edges (handled by EDGE_MARGIN), at 0
    // is the i=10 interior boundary and must nudge.
    const out = shiftCutPlanesOffCellBoundaries([-420, 0, 420], 20, 42);
    expect(out).toEqual([-420, 0.1, 420]);
  });

  it('returns the input array unchanged when no cut planes are passed', () => {
    const out = shiftCutPlanesOffCellBoundaries([], 10, 42);
    expect(out).toEqual([]);
  });

  it('defensively handles missing gridUnitMm (legacy params)', () => {
    const out = shiftCutPlanesOffCellBoundaries([0, 10], 10, undefined as unknown as number);
    expect(out).toEqual([0, 10]);
  });
});
