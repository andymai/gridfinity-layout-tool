import { describe, it, expect } from 'vitest';
import { fitSmoothPolygon } from './curveFit';
import type { Point } from './types';

function bbox(pts: readonly Point[]): { w: number; h: number; minX: number; minY: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { w: Math.max(...xs) - minX, h: Math.max(...ys) - minY, minX, minY };
}

describe('fitSmoothPolygon', () => {
  it('keeps a rectangle close to its true extent (no shrinkage)', () => {
    const rect: Point[] = [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ];
    const out = fitSmoothPolygon(rect, 4);
    const b = bbox(out);
    // Corners preserved → bbox barely changes (Chaikin would shrink it inward).
    expect(b.w).toBeGreaterThan(98);
    expect(b.h).toBeGreaterThan(58);
    expect(b.minX).toBeLessThan(12);
  });

  it('smooths a stair-stepped edge into more points along a straight line', () => {
    // A jagged staircase that should fit to a near-straight smooth run.
    const stair: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 40 },
      { x: 0, y: 40 },
    ];
    const out = fitSmoothPolygon(stair, 9);
    expect(out.length).toBeGreaterThanOrEqual(3);
    // The fitted outline stays within the staircase's envelope.
    const b = bbox(out);
    expect(b.minX).toBeGreaterThanOrEqual(-1);
  });

  it('returns the input unchanged when too few points to fit', () => {
    const tri: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 0, y: 5 },
    ];
    expect(fitSmoothPolygon(tri, 4)).toEqual(tri);
  });

  it('tolerates consecutive duplicate points', () => {
    const dup: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    expect(() => fitSmoothPolygon(dup, 4)).not.toThrow();
    expect(fitSmoothPolygon(dup, 4).length).toBeGreaterThanOrEqual(3);
  });
});
