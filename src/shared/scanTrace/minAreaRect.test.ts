import { describe, it, expect } from 'vitest';
import { convexHull, minAreaRect } from './minAreaRect';
import type { Point } from './types';

describe('convexHull', () => {
  it('drops interior points, keeping the enclosing vertices', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 }, // interior — must be dropped
    ]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 5, y: 5 });
  });

  it('returns the points unchanged when fewer than 3', () => {
    expect(convexHull([{ x: 1, y: 2 }])).toHaveLength(1);
  });
});

describe('minAreaRect', () => {
  it('recovers an axis-aligned rectangle exactly', () => {
    const rect = minAreaRect([
      { x: 10, y: 20 },
      { x: 160, y: 20 },
      { x: 160, y: 115 },
      { x: 10, y: 115 },
    ]);
    expect(rect).not.toBeNull();
    if (!rect) return;
    expect(rect.width).toBeCloseTo(150, 5);
    expect(rect.height).toBeCloseTo(95, 5);
    expect(rect.width / rect.height).toBeCloseTo(1.579, 2);
  });

  it('recovers a rotated rectangle (orientation-independent)', () => {
    // A 150×90 rectangle rotated 30°, with an interior point that must not matter.
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    const rot = (x: number, y: number): Point => ({
      x: x * c - y * s + 200,
      y: x * s + y * c + 200,
    });
    const rect = minAreaRect([rot(0, 0), rot(150, 0), rot(150, 90), rot(0, 90), rot(75, 45)]);
    expect(rect).not.toBeNull();
    if (!rect) return;
    expect(rect.width).toBeCloseTo(150, 3);
    expect(rect.height).toBeCloseTo(90, 3);
  });

  it('is unaffected by a concave bite — the hull bridges it', () => {
    // Full 200×120 rectangle vs the same with a corner bitten out: same rect.
    const full: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 120 },
      { x: 0, y: 120 },
    ];
    const bitten: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 120 },
      { x: 80, y: 120 }, // bottom edge starts later…
      { x: 0, y: 60 }, // …and the corner is cut away
    ];
    const a = minAreaRect(full);
    const b = minAreaRect(bitten);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (!a || !b) return;
    expect(b.width).toBeCloseTo(a.width, 5);
    expect(b.height).toBeCloseTo(a.height, 5);
  });

  it('returns null for degenerate (collinear) input', () => {
    expect(
      minAreaRect([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ])
    ).toBeNull();
  });
});
