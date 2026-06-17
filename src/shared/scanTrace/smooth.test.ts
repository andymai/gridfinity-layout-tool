import { describe, it, expect } from 'vitest';
import { chaikin, smoothPreservingCorners } from './smooth';
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

describe('smoothPreservingCorners', () => {
  it('keeps every sharp corner of a square untouched', () => {
    const out = smoothPreservingCorners(SQUARE, 2);
    expect(out).toHaveLength(4);
    for (const corner of SQUARE) expect(out).toContainEqual(corner);
  });

  it('keeps a straight edge straight while cutting its collinear midpoint', () => {
    const withMidpoint: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 }, // collinear on the bottom edge — turning angle ~0
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const out = smoothPreservingCorners(withMidpoint, 1);

    // The four real corners survive; the collinear midpoint is cut away.
    for (const corner of [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]) {
      expect(out).toContainEqual(corner);
    }
    expect(out).not.toContainEqual({ x: 5, y: 0 });

    // Points left on the bottom edge stay exactly on y=0 (no rounding).
    const onBottom = out.filter((p) => p.x > 0 && p.x < 10 && Math.abs(p.y) < 1e-9);
    expect(onBottom.length).toBeGreaterThan(0);
  });

  it('rounds a gentle vertex that falls below the corner threshold', () => {
    // The vertex at (20, 3.64) turns only ~20° — below the 36° default.
    const gentle: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 3.64 },
      { x: 30, y: 3.64 },
      { x: 30, y: 20 },
      { x: 0, y: 20 },
    ];
    const out = smoothPreservingCorners(gentle, 1);
    expect(out).not.toContainEqual({ x: 20, y: 3.64 });
  });

  it('is a no-op for zero iterations or degenerate input', () => {
    expect(smoothPreservingCorners(SQUARE, 0)).toEqual(SQUARE);
    expect(smoothPreservingCorners([{ x: 1, y: 1 }], 3)).toHaveLength(1);
  });
});
