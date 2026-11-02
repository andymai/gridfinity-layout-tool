import { describe, it, expect } from 'vitest';
import { pathFillIndices } from './pathFill';

type Pt = { x: number; y: number };

const square = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function filledArea(points: readonly Pt[], indices: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]];
    total += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  }
  return total;
}

describe('pathFillIndices', () => {
  it('fills a plain outline', () => {
    const outline = square(0, 0, 40, 20);
    expect(filledArea(outline, pathFillIndices(outline, []))).toBeCloseTo(800, 6);
  });

  it('leaves each island open', () => {
    const outline = square(0, 0, 40, 20);
    const islands = [square(5, 5, 15, 15), square(25, 5, 35, 15)];
    const points = [outline, ...islands].flat();
    const indices = pathFillIndices(outline, islands);
    expect(filledArea(points, indices)).toBeCloseTo(800 - 2 * 100, 6);
    for (let i = 0; i < indices.length; i += 3) {
      const cx = (points[indices[i]].x + points[indices[i + 1]].x + points[indices[i + 2]].x) / 3;
      const cy = (points[indices[i]].y + points[indices[i + 1]].y + points[indices[i + 2]].y) / 3;
      const inIsland = islands.some(
        (s) => cx > s[0].x && cx < s[1].x && cy > s[0].y && cy < s[2].y
      );
      expect(inIsland).toBe(false);
    }
  });
});
