import { describe, expect, it } from 'vitest';

import type { DrawerOutline } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';
import { getOutsideCellSet } from './drawerOutlineCells';

const U = 42;

const L_SHAPE: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

const CHAMFER: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

function drawer(width: number, depth: number): Parameters<typeof getOutsideCellSet>[1] {
  return { width: gridUnits(width), depth: gridUnits(depth), height: heightUnits(6) };
}

describe('getOutsideCellSet', () => {
  it('marks exactly the notch cells at whole-cell step', () => {
    const outside = getOutsideCellSet(L_SHAPE, drawer(4, 4), U, 1);
    expect(outside).toEqual(new Set(['2,2', '3,2', '2,3', '3,3']));
  });

  it('marks the notch at half-grid step', () => {
    const outside = getOutsideCellSet(L_SHAPE, drawer(4, 4), U, 0.5);
    expect(outside.size).toBe(16);
    expect(outside.has('2,2')).toBe(true);
    expect(outside.has('3.5,3.5')).toBe(true);
    expect(outside.has('1.5,1.5')).toBe(false);
  });

  it('includes partial (diagonal-crossed) cells — hatched iff placement fails', () => {
    const outside = getOutsideCellSet(CHAMFER, drawer(4, 4), U, 1);
    expect(outside).toEqual(new Set(['3,2', '2,3', '3,3']));
  });

  it('memoizes per outline reference and params', () => {
    const a = getOutsideCellSet(L_SHAPE, drawer(4, 4), U, 1);
    expect(getOutsideCellSet(L_SHAPE, drawer(4, 4), U, 1)).toBe(a);
    expect(getOutsideCellSet(L_SHAPE, drawer(4, 4), U, 0.5)).not.toBe(a);
  });

  it('respects fractional drawer edges', () => {
    const halfCol: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 3.5 * U, y: 0 },
        { x: 3.5 * U, y: 2 * U },
        { x: 2 * U, y: 2 * U },
        { x: 2 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const outsideEnd = getOutsideCellSet(
      halfCol,
      { ...drawer(3.5, 4), fractionalEdgeX: 'end' },
      U,
      1
    );
    // Columns at x=0,1,2 plus the trailing half column at x=3.
    expect(outsideEnd).toEqual(new Set(['2,2', '3,2', '2,3', '3,3']));
    const outsideStart = getOutsideCellSet(
      halfCol,
      { ...drawer(3.5, 4), fractionalEdgeX: 'start' },
      U,
      1
    );
    // Leading half column at x=0, full columns at 0.5, 1.5, 2.5.
    expect(outsideStart).toEqual(new Set(['1.5,2', '2.5,2', '1.5,3', '2.5,3']));
  });
});
