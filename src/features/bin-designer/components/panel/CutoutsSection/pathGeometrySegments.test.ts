import { describe, it, expect } from 'vitest';
import type { PathPoint } from '@/features/bin-designer/types';
import { cubicBezier } from './pathGeometryBezier';
import {
  findNearestSegment,
  evaluateSegmentPoint,
  flattenSegment,
  splitBezierSegment,
  isSelfIntersecting,
} from './pathGeometrySegments';

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

// ─── findNearestSegment ───────────────────────────────────────────────────────

describe('findNearestSegment', () => {
  it('returns null for fewer than 2 points', () => {
    expect(findNearestSegment(5, 5, [], 10)).toBeNull();
    expect(findNearestSegment(5, 5, [corner(0, 0)], 10)).toBeNull();
  });

  it('identifies the correct segment index for a point on a known segment', () => {
    // Square: segment 1 is (10,0)→(10,10); query near its midpoint
    const pts = [corner(0, 0), corner(10, 0), corner(10, 10), corner(0, 10)];
    const r = findNearestSegment(10, 5, pts, 1);
    expect(r).not.toBeNull();
    expect(r?.segmentIndex).toBe(1);
    expect(r?.t).toBeCloseTo(0.5, 1);
  });

  it('segmentIndex is within [0, n-1] and t is within [0, 1]', () => {
    const pts = [corner(0, 0), corner(20, 0), corner(20, 20), corner(0, 20)];
    const r = findNearestSegment(10, 0, pts, 5);
    expect(r).not.toBeNull();
    if (r !== null) {
      expect(r.segmentIndex).toBeGreaterThanOrEqual(0);
      expect(r.segmentIndex).toBeLessThan(pts.length);
      expect(r.t).toBeGreaterThanOrEqual(0);
      expect(r.t).toBeLessThanOrEqual(1);
    }
  });

  it('returns null when nearest point is beyond the threshold', () => {
    const pts = [corner(0, 0), corner(10, 0)];
    expect(findNearestSegment(5, 20, pts, 5)).toBeNull();
  });

  it('finds the nearest bezier segment', () => {
    const pts = [withHandles(0, 0, 0, 15, 0, -15), corner(30, 0)];
    // Query a point near the curve's interior (within the 5px threshold) — the
    // exact bezier midpoint isn't what matters, only that segment 0 is nearest.
    const r = findNearestSegment(15, 7, pts, 5);
    expect(r).not.toBeNull();
    expect(r?.segmentIndex).toBe(0);
  });
});

// ─── evaluateSegmentPoint ────────────────────────────────────────────────────

describe('evaluateSegmentPoint', () => {
  it('returns p0 at t=0 for a straight segment', () => {
    const pts = [corner(3, 5), corner(13, 15)];
    expect(evaluateSegmentPoint(pts, 0, 0)).toEqual({ x: 3, y: 5 });
  });

  it('returns p1 at t=1 for a straight segment', () => {
    const pts = [corner(3, 5), corner(13, 15)];
    expect(evaluateSegmentPoint(pts, 0, 1)).toEqual({ x: 13, y: 15 });
  });

  it('returns the midpoint at t=0.5 for a straight segment', () => {
    const pts = [corner(0, 0), corner(20, 10)];
    const r = evaluateSegmentPoint(pts, 0, 0.5);
    expect(r.x).toBeCloseTo(10, 5);
    expect(r.y).toBeCloseTo(5, 5);
  });

  it('closing segment (last index) wraps around to the first point at t=1', () => {
    const pts = [corner(0, 0), corner(10, 0), corner(5, 10)];
    // Segment index 2 goes from pts[2]=(5,10) back to pts[0]=(0,0)
    const r = evaluateSegmentPoint(pts, 2, 1);
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(0, 5);
  });

  it('bezier segment at t=0 returns the segment start point', () => {
    const pts = [withHandles(0, 0, 0, 20, 0, -20), corner(40, 0)];
    const r = evaluateSegmentPoint(pts, 0, 0);
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(0, 5);
  });
});

// ─── flattenSegment ──────────────────────────────────────────────────────────

describe('flattenSegment', () => {
  it('returns exactly 2 points for a straight segment', () => {
    const pts = [corner(0, 0), corner(30, 0), corner(30, 30)];
    expect(flattenSegment(pts, 0)).toHaveLength(2);
  });

  it('returns steps+1 points for a bezier segment with explicit step count', () => {
    const pts = [withHandles(0, 0, 0, 20, 0, -20), corner(40, 0)];
    expect(flattenSegment(pts, 0, 8)).toHaveLength(9);
  });

  it('default step count is 20, yielding 21 points', () => {
    const pts = [withHandles(0, 0, 0, 20, 0, -20), corner(40, 0)];
    expect(flattenSegment(pts, 0)).toHaveLength(21);
  });

  it('all output coordinates are finite', () => {
    const pts = [withHandles(0, 0, 0, 50, 0, -50), corner(100, 0)];
    const r = flattenSegment(pts, 0, 20);
    for (const p of r) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('first point of flattened segment matches the start anchor', () => {
    const pts = [withHandles(5, 7, 0, 20, 0, -20), corner(50, 7)];
    const r = flattenSegment(pts, 0);
    expect(r[0].x).toBeCloseTo(5, 8);
    expect(r[0].y).toBeCloseTo(7, 8);
  });
});

// ─── splitBezierSegment ──────────────────────────────────────────────────────

describe('splitBezierSegment', () => {
  // Curved segment: p0=(0,0) with handleOut=(0,20); p1=(40,0) with handleIn=(-15,0)
  // Absolute control points: cp1=(0,20), cp2=(25,0)
  const p0: PathPoint = {
    x: 0,
    y: 0,
    handleIn: null,
    handleOut: { dx: 0, dy: 20 },
    symmetric: false,
  };
  const p1: PathPoint = {
    x: 40,
    y: 0,
    handleIn: { dx: -15, dy: 0 },
    handleOut: null,
    symmetric: false,
  };

  it('mid position matches the original cubic bezier evaluated at t=0.5', () => {
    const { mid } = splitBezierSegment(p0, p1, 0.5);
    const orig = cubicBezier(
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 25, y: 0 },
      { x: 40, y: 0 },
      0.5
    );
    expect(mid.x).toBeCloseTo(orig.x, 8);
    expect(mid.y).toBeCloseTo(orig.y, 8);
  });

  it('first sub-curve at t=0.5 matches the original curve at t=0.25', () => {
    const { before, mid } = splitBezierSegment(p0, p1, 0.5);
    const sub1cp1 = {
      x: before.x + (before.handleOut?.dx ?? 0),
      y: before.y + (before.handleOut?.dy ?? 0),
    };
    const sub1cp2 = {
      x: mid.x + (mid.handleIn?.dx ?? 0),
      y: mid.y + (mid.handleIn?.dy ?? 0),
    };
    const subMid = cubicBezier(
      { x: before.x, y: before.y },
      sub1cp1,
      sub1cp2,
      { x: mid.x, y: mid.y },
      0.5
    );
    const origQuarter = cubicBezier(
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 25, y: 0 },
      { x: 40, y: 0 },
      0.25
    );
    expect(subMid.x).toBeCloseTo(origQuarter.x, 8);
    expect(subMid.y).toBeCloseTo(origQuarter.y, 8);
  });

  it('before.position equals original p0 and after.position equals original p1', () => {
    const { before, after } = splitBezierSegment(p0, p1, 0.5);
    expect(before.x).toBe(p0.x);
    expect(before.y).toBe(p0.y);
    expect(after.x).toBe(p1.x);
    expect(after.y).toBe(p1.y);
  });

  it('mid.symmetric is false for a curve split', () => {
    const { mid } = splitBezierSegment(p0, p1, 0.5);
    expect(mid.symmetric).toBe(false);
  });

  it('mid has non-null handleIn and handleOut after splitting a curved segment', () => {
    const { mid } = splitBezierSegment(p0, p1, 0.5);
    expect(mid.handleIn).not.toBeNull();
    expect(mid.handleOut).not.toBeNull();
  });

  it('splitting a straight segment at t=0.5 gives the geometric midpoint', () => {
    const a = corner(0, 0);
    const b = corner(20, 10);
    const { mid } = splitBezierSegment(a, b, 0.5);
    expect(mid.x).toBeCloseTo(10, 8);
    expect(mid.y).toBeCloseTo(5, 8);
  });
});

// ─── isSelfIntersecting ──────────────────────────────────────────────────────

describe('isSelfIntersecting', () => {
  it('returns false for fewer than 3 points', () => {
    expect(isSelfIntersecting([])).toBe(false);
    expect(isSelfIntersecting([corner(0, 0), corner(5, 5)])).toBe(false);
  });

  it('returns false for a convex triangle', () => {
    expect(isSelfIntersecting([corner(0, 0), corner(10, 0), corner(5, 8)])).toBe(false);
  });

  it('returns false for a convex quad (square)', () => {
    const pts = [corner(0, 0), corner(10, 0), corner(10, 10), corner(0, 10)];
    expect(isSelfIntersecting(pts)).toBe(false);
  });

  it('returns true for a figure-8 with crossing straight segments', () => {
    // (0,0)→(10,10)→(10,0)→(0,10) traces an X shape
    const pts = [corner(0, 0), corner(10, 10), corner(10, 0), corner(0, 10)];
    expect(isSelfIntersecting(pts)).toBe(true);
  });

  it('returns false for a concave but non-self-intersecting polygon', () => {
    const pts = [corner(0, 0), corner(10, 0), corner(10, 10), corner(5, 5), corner(0, 10)];
    expect(isSelfIntersecting(pts)).toBe(false);
  });
});
