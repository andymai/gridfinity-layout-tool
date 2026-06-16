import { describe, it, expect } from 'vitest';
import { traceContour } from './contour';
import type { Mask, Point } from './types';

function mask(w: number, h: number, isFg: (x: number, y: number) => boolean): Mask {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data[y * w + x] = isFg(x, y) ? 1 : 0;
  }
  return { width: w, height: h, data };
}

function bbox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return points.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxX: Math.max(acc.maxX, p.x),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

describe('traceContour', () => {
  it('traces the perimeter of a solid block', () => {
    const block = (x: number, y: number): boolean => x >= 2 && x <= 5 && y >= 2 && y <= 5;
    const points = traceContour(mask(10, 10, block), { x: 2, y: 2 });

    expect(points[0]).toEqual({ x: 2, y: 2 });
    expect(points.length).toBeGreaterThanOrEqual(4);
    expect(bbox(points)).toEqual({ minX: 2, minY: 2, maxX: 5, maxY: 5 });
    // Every traced point is a foreground pixel of the block.
    expect(points.every((p) => block(p.x, p.y))).toBe(true);
  });

  it('returns just the start for an isolated pixel', () => {
    const points = traceContour(
      mask(5, 5, (x, y) => x === 2 && y === 2),
      { x: 2, y: 2 }
    );
    expect(points).toEqual([{ x: 2, y: 2 }]);
  });

  it('follows a concave (L-shaped) boundary out to its extremes', () => {
    // L: full bottom row band + left column band.
    const isL = (x: number, y: number): boolean =>
      (x >= 1 && x <= 6 && y >= 5 && y <= 6) || (x >= 1 && x <= 2 && y >= 1 && y <= 6);
    const points = traceContour(mask(8, 8, isL), { x: 1, y: 1 });
    expect(bbox(points)).toEqual({ minX: 1, minY: 1, maxX: 6, maxY: 6 });
  });
});
