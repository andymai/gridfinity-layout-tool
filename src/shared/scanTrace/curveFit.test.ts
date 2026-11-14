import { describe, it, expect } from 'vitest';
import { polylineCrosses } from '@/shared/utils/outlineSegments';
import { fitSmoothPolygon, smoothRing } from './curveFit';
import { simplifyRdp } from './simplify';
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

describe('smoothRing', () => {
  // Traced from a photo: a small ring with one-pixel spurs that run out and
  // back, which the fit at the trace's usual tolerance folds over itself.
  const SPURRED: Point[] = [
    [561, 1315],
    [561, 1316],
    [561, 1317],
    [561, 1318],
    [562, 1319],
    [563, 1318],
    [564, 1319],
    [565, 1318],
    [565, 1317],
    [565, 1318],
    [566, 1319],
    [567, 1319],
    [568, 1318],
    [568, 1317],
    [568, 1318],
    [568, 1319],
    [567, 1319],
    [566, 1320],
    [566, 1321],
    [566, 1322],
    [566, 1323],
    [566, 1324],
    [565, 1323],
    [565, 1322],
    [566, 1321],
    [565, 1320],
    [564, 1320],
    [563, 1321],
    [562, 1320],
    [561, 1319],
    [561, 1318],
    [561, 1317],
    [561, 1316],
  ].map(([x, y]) => ({ x, y }));
  const TOLERANCE = 5.77;

  it('never hands back a ring that crosses itself, which would be cut as a box', () => {
    expect(polylineCrosses(fitSmoothPolygon(SPURRED, (TOLERANCE * 0.5) ** 2))).toBe(true);
    expect(polylineCrosses(smoothRing(SPURRED, TOLERANCE))).toBe(false);
    expect(polylineCrosses(smoothRing(SPURRED, TOLERANCE, false))).toBe(false);
  });

  it('smooths as before wherever the usual fit stays clear of itself', () => {
    const ring: Point[] = Array.from({ length: 80 }, (_, i) => {
      const a = (i / 80) * 2 * Math.PI;
      return { x: Math.round(100 + 40 * Math.cos(a)), y: Math.round(100 + 25 * Math.sin(a)) };
    });
    expect(smoothRing(ring, 3)).toEqual(fitSmoothPolygon(ring, 1.5 ** 2));
    expect(smoothRing(ring, 3, false)).toEqual(simplifyRdp(ring, 3));
  });
});
