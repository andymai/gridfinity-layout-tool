import { describe, it, expect } from 'vitest';
import type { PathPoint } from '@/features/bin-designer/types';
import { cubicBezier, flattenPath, type Point2D } from './pathGeometryBezier';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function corner(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: true };
}

function withHandles(
  x: number,
  y: number,
  outDx: number,
  outDy: number,
  inDx: number,
  inDy: number
): PathPoint {
  return {
    x,
    y,
    handleOut: { dx: outDx, dy: outDy },
    handleIn: { dx: inDx, dy: inDy },
    symmetric: false,
  };
}

const allFinite = (pts: Point2D[]): boolean =>
  pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

// ─── cubicBezier ─────────────────────────────────────────────────────────────

describe('cubicBezier', () => {
  const p0 = { x: 0, y: 0 };
  const cp1 = { x: 0, y: 50 };
  const cp2 = { x: 100, y: 50 };
  const p1 = { x: 100, y: 0 };

  it('returns p0 exactly at t=0', () => {
    const r = cubicBezier(p0, cp1, cp2, p1, 0);
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.y).toBeCloseTo(0, 10);
  });

  it('returns p1 exactly at t=1', () => {
    const r = cubicBezier(p0, cp1, cp2, p1, 1);
    expect(r.x).toBeCloseTo(100, 10);
    expect(r.y).toBeCloseTo(0, 10);
  });

  it('midpoint of symmetric arch lies strictly above the chord and at x-center', () => {
    const mid = cubicBezier(p0, cp1, cp2, p1, 0.5);
    // Chord is at y=0; arch control points peak at y=50
    expect(mid.y).toBeGreaterThan(0);
    expect(mid.y).toBeLessThanOrEqual(50);
    // Symmetric arch: midpoint x = average of endpoints
    expect(mid.x).toBeCloseTo(50, 5);
  });

  it('all sampled t values produce finite coordinates', () => {
    for (let i = 0; i <= 20; i++) {
      const r = cubicBezier(p0, cp1, cp2, p1, i / 20);
      expect(Number.isFinite(r.x)).toBe(true);
      expect(Number.isFinite(r.y)).toBe(true);
    }
  });

  it('degenerate: all four points identical returns that point for any t', () => {
    const q = { x: 7, y: 13 };
    for (const t of [0, 0.33, 0.67, 1]) {
      const r = cubicBezier(q, q, q, q, t);
      expect(r.x).toBeCloseTo(7, 10);
      expect(r.y).toBeCloseTo(13, 10);
    }
  });

  it('collinear control points: mid-curve point lies on the segment', () => {
    // p0=(0,0), cp1=(5,0), cp2=(15,0), p1=(20,0) — all on x-axis
    const r = cubicBezier({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 }, { x: 20, y: 0 }, 0.5);
    expect(r.y).toBeCloseTo(0, 10);
    expect(r.x).toBeGreaterThan(0);
    expect(r.x).toBeLessThan(20);
  });
});

// ─── flattenPath ─────────────────────────────────────────────────────────────

describe('flattenPath', () => {
  it('returns empty array for empty input', () => {
    expect(flattenPath([])).toEqual([]);
  });

  it('returns single mapped point for one-element input', () => {
    const result = flattenPath([corner(3, 7)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ x: 3, y: 7 });
  });

  it('straight three-point closed path produces exactly three vertices', () => {
    const result = flattenPath([corner(0, 0), corner(10, 0), corner(5, 10)]);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ x: 0, y: 0 });
  });

  it('bezier path produces more points than anchor count', () => {
    const pts: PathPoint[] = [withHandles(0, 0, 0, 40, 0, -40), withHandles(80, 0, 0, 40, 0, -40)];
    const result = flattenPath(pts);
    expect(result.length).toBeGreaterThan(2);
  });

  it('all output coordinates are finite for a strongly curved bezier path', () => {
    const pts: PathPoint[] = [withHandles(0, 0, 0, 40, 0, -40), withHandles(80, 0, 0, 40, 0, -40)];
    expect(allFinite(flattenPath(pts))).toBe(true);
  });

  it('tight tolerance produces more sample points than loose tolerance', () => {
    const pts: PathPoint[] = [withHandles(0, 0, 0, 60, 0, -60), withHandles(100, 0, 0, 60, 0, -60)];
    const loose = flattenPath(pts, 10);
    const tight = flattenPath(pts, 0.01);
    expect(tight.length).toBeGreaterThan(loose.length);
  });

  it('open path (closed=false) ends at the last anchor', () => {
    const pts = [corner(0, 0), corner(50, 0), corner(100, 50)];
    const result = flattenPath(pts, 0.1, false);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 100, y: 50 });
  });

  it('closed path does not duplicate the first point as the last', () => {
    const pts = [corner(0, 0), corner(10, 0), corner(5, 10)];
    const result = flattenPath(pts);
    expect(result[0]).not.toEqual(result[result.length - 1]);
  });

  it('drops coincident consecutive vertices in a straight path', () => {
    const result = flattenPath([corner(0, 0), corner(10, 0), corner(10, 0), corner(5, 10)]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).not.toEqual(result[i - 1]);
    }
  });

  it('zero-handle bezier (degenerate cp=anchor) produces finite, non-empty output', () => {
    // handleOut with dx=dy=0: cp1 coincides with anchor, making a near-straight bezier
    const pts: PathPoint[] = [
      { x: 0, y: 0, handleIn: null, handleOut: { dx: 0, dy: 0 }, symmetric: false },
      { x: 20, y: 0, handleIn: { dx: 0, dy: 0 }, handleOut: null, symmetric: false },
    ];
    const result = flattenPath(pts);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(allFinite(result)).toBe(true);
  });
});
