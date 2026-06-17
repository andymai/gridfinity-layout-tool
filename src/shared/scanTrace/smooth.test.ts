import { describe, it, expect } from 'vitest';
import { chaikin } from './smooth';
import type { Point } from './types';

const SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('chaikin', () => {
  it('doubles the point count per iteration on a closed polygon', () => {
    expect(chaikin(SQUARE, 1)).toHaveLength(8);
    expect(chaikin(SQUARE, 2)).toHaveLength(16);
  });

  it('keeps points within the original bounding box (corner-cutting shrinks)', () => {
    const out = chaikin(SQUARE, 2);
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(-0.001);
      expect(p.x).toBeLessThanOrEqual(10.001);
      expect(p.y).toBeGreaterThanOrEqual(-0.001);
      expect(p.y).toBeLessThanOrEqual(10.001);
    }
  });

  it('rounds corners — no original sharp vertex survives', () => {
    const out = chaikin(SQUARE, 1);
    expect(out).not.toContainEqual({ x: 0, y: 0 });
  });

  it('is a no-op for zero iterations or degenerate input', () => {
    expect(chaikin(SQUARE, 0)).toEqual(SQUARE);
    expect(chaikin([{ x: 1, y: 1 }], 3)).toHaveLength(1);
  });
});
