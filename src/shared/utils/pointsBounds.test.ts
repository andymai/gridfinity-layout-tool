import { describe, it, expect } from 'vitest';
import { pointsBounds } from './pointsBounds';

describe('pointsBounds', () => {
  it('computes the bounding box of a point list', () => {
    expect(
      pointsBounds([
        { x: 1, y: 2 },
        { x: -3, y: 5 },
        { x: 4, y: -1 },
      ])
    ).toEqual({ minX: -3, minY: -1, maxX: 4, maxY: 5 });
  });

  it('collapses to a point for a single vertex', () => {
    expect(pointsBounds([{ x: 7, y: -2 }])).toEqual({ minX: 7, minY: -2, maxX: 7, maxY: -2 });
  });

  it('returns the inverted-infinite box for an empty list', () => {
    expect(pointsBounds([])).toEqual({
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    });
  });

  it('handles all-negative coordinates', () => {
    expect(
      pointsBounds([
        { x: -10, y: -4 },
        { x: -2, y: -8 },
      ])
    ).toEqual({ minX: -10, minY: -8, maxX: -2, maxY: -4 });
  });

  it('accepts a readonly array', () => {
    const pts: readonly { x: number; y: number }[] = [
      { x: 0, y: 0 },
      { x: 6, y: 3 },
    ];
    expect(pointsBounds(pts)).toEqual({ minX: 0, minY: 0, maxX: 6, maxY: 3 });
  });

  it('skips NaN coordinates rather than poisoning the bounds', () => {
    expect(
      pointsBounds([
        { x: 1, y: 1 },
        { x: NaN, y: NaN },
        { x: 3, y: 5 },
      ])
    ).toEqual({ minX: 1, minY: 1, maxX: 3, maxY: 5 });
  });
});
