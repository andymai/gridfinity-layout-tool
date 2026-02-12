import { describe, it, expect } from 'vitest';
import type { PathPoint } from '@/features/bin-designer/types';
import {
  MAX_PATH_POINTS,
  CLOSE_SNAP_THRESHOLD,
  MIN_PATH_POINTS,
  cubicBezier,
  flattenPath,
  triangulatePath,
  getPathBounds,
  scalePathPoints,
  translatePathPoints,
  insertPoint,
  removePoint,
  updatePoint,
  enforceSymmetry,
  isNearPoint,
  findNearestSegment,
  evaluateSegmentPoint,
  flattenSegment,
  snapAngle45,
  cornerPoint,
  splitBezierSegment,
  clampPathToBounds,
  isSelfIntersecting,
} from './pathGeometry';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Create a simple corner point with no bezier handles */
function pt(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: true };
}

/** Create a point with symmetric bezier handles */
function ptSymmetric(x: number, y: number, handleDx: number, handleDy: number): PathPoint {
  return {
    x,
    y,
    handleIn: { dx: -handleDx, dy: -handleDy },
    handleOut: { dx: handleDx, dy: handleDy },
    symmetric: true,
  };
}

/** Create a point with independent bezier handles */
function ptCurve(
  x: number,
  y: number,
  handleIn: { dx: number; dy: number } | null,
  handleOut: { dx: number; dy: number } | null
): PathPoint {
  return { x, y, handleIn, handleOut, symmetric: false };
}

// ─── Constants ──────────────────────────────────────────────────────────────

describe('constants', () => {
  it('exports MAX_PATH_POINTS', () => {
    expect(MAX_PATH_POINTS).toBe(200);
  });

  it('exports CLOSE_SNAP_THRESHOLD', () => {
    expect(CLOSE_SNAP_THRESHOLD).toBe(5);
  });

  it('exports MIN_PATH_POINTS', () => {
    expect(MIN_PATH_POINTS).toBe(2);
  });
});

// ─── Bezier Math ────────────────────────────────────────────────────────────

describe('cubicBezier', () => {
  it('returns p0 at t=0', () => {
    const result = cubicBezier(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 30, y: 0 },
      0
    );
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('returns p1 at t=1', () => {
    const result = cubicBezier(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 30, y: 0 },
      1
    );
    expect(result).toEqual({ x: 30, y: 0 });
  });

  it('returns midpoint for straight line when cp1=p0 and cp2=p1', () => {
    const result = cubicBezier(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      0.5
    );
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('evaluates curve with actual control points', () => {
    const result = cubicBezier(
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 0 },
      0.5
    );
    expect(result.x).toBeCloseTo(20, 5);
    expect(result.y).toBeCloseTo(15, 5);
  });
});

// ─── Path Flattening ────────────────────────────────────────────────────────

describe('flattenPath', () => {
  it('returns mapped copy for empty array', () => {
    const result = flattenPath([]);
    expect(result).toEqual([]);
  });

  it('returns mapped copy for single point', () => {
    const result = flattenPath([pt(5, 10)]);
    expect(result).toEqual([{ x: 5, y: 10 }]);
  });

  it('flattens straight segment to polyline matching vertices', () => {
    const result = flattenPath([pt(0, 0), pt(10, 0), pt(10, 10)]);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 10, y: 0 });
    expect(result[2]).toEqual({ x: 10, y: 10 });
  });

  it('subdivides bezier segments into polyline', () => {
    const points = [pt(0, 0), ptSymmetric(20, 20, 10, 0), pt(40, 0)];
    const result = flattenPath(points);
    expect(result.length).toBeGreaterThan(3);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 40, y: 0 });
  });

  it('omits duplicate endpoint when closed=true (default)', () => {
    const result = flattenPath([pt(0, 0), pt(10, 0), pt(5, 10)]);
    expect(result).toHaveLength(3);
    expect(result[0]).not.toEqual(result[result.length - 1]);
  });

  it('returns open polyline when closed=false', () => {
    const result = flattenPath([pt(0, 0), pt(10, 0), pt(5, 10)], 0.1, false);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 5, y: 10 });
  });

  it('handles mixed straight and bezier segments', () => {
    const points = [pt(0, 0), pt(10, 0), ptSymmetric(20, 5, 5, 5), pt(30, 0)];
    const result = flattenPath(points);
    expect(result.length).toBeGreaterThan(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });
  });
});

// ─── Triangulation ──────────────────────────────────────────────────────────

describe('triangulatePath', () => {
  it('returns empty array for less than 3 points', () => {
    expect(triangulatePath([])).toEqual([]);
    expect(triangulatePath([{ x: 0, y: 0 }])).toEqual([]);
    expect(
      triangulatePath([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ])
    ).toEqual([]);
  });

  it('returns 3 indices for triangle', () => {
    const result = triangulatePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]);
    expect(result).toHaveLength(3);
    // Earclip can return different orderings, just check we got 3 valid indices
    expect(result.every((idx) => idx >= 0 && idx <= 2)).toBe(true);
  });

  it('returns 6 indices for square (2 triangles)', () => {
    const result = triangulatePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(result).toHaveLength(6);
    expect(result.length % 3).toBe(0);
  });

  it('triangulates convex pentagon', () => {
    const result = triangulatePath([
      { x: 0, y: 5 },
      { x: 2, y: 0 },
      { x: 6, y: 1 },
      { x: 7, y: 5 },
      { x: 3, y: 7 },
    ]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length % 3).toBe(0);
  });
});

// ─── Path Bounds ────────────────────────────────────────────────────────────

describe('getPathBounds', () => {
  it('returns all zeros for empty array', () => {
    const bounds = getPathBounds([]);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('returns point for single point', () => {
    const bounds = getPathBounds([pt(5, 10)]);
    expect(bounds.minX).toBeCloseTo(5, 1);
    expect(bounds.minY).toBeCloseTo(10, 1);
    expect(bounds.maxX).toBeCloseTo(5, 1);
    expect(bounds.maxY).toBeCloseTo(10, 1);
  });

  it('returns correct bounds for multiple points', () => {
    const bounds = getPathBounds([pt(0, 0), pt(10, 20), pt(-5, 15)]);
    expect(bounds.minX).toBeCloseTo(-5, 1);
    expect(bounds.minY).toBeCloseTo(0, 1);
    expect(bounds.maxX).toBeCloseTo(10, 1);
    expect(bounds.maxY).toBeCloseTo(20, 1);
  });

  it('includes curve extent in bounds', () => {
    const points = [pt(0, 0), ptSymmetric(10, 10, 0, 10), pt(20, 0)];
    const bounds = getPathBounds(points);
    expect(bounds.minX).toBeCloseTo(0, 1);
    expect(bounds.maxX).toBeCloseTo(20, 1);
    expect(bounds.maxY).toBeGreaterThan(10);
  });
});

// ─── Scale Path Points ──────────────────────────────────────────────────────

describe('scalePathPoints', () => {
  it('returns identity when scale is 1x', () => {
    const points = [pt(10, 20), pt(30, 40)];
    const result = scalePathPoints(points, 1, 1, 0, 0);
    expect(result).toEqual(points);
  });

  it('doubles distances when scale is 2x from origin', () => {
    const points = [pt(10, 20)];
    const result = scalePathPoints(points, 2, 2, 0, 0);
    expect(result[0].x).toBe(20);
    expect(result[0].y).toBe(40);
  });

  it('scales handles proportionally', () => {
    const points = [ptSymmetric(10, 10, 5, 5)];
    const result = scalePathPoints(points, 2, 2, 0, 0);
    expect(result[0].handleOut).toEqual({ dx: 10, dy: 10 });
    expect(result[0].handleIn).toEqual({ dx: -10, dy: -10 });
  });

  it('scales from non-zero origin', () => {
    const points = [pt(10, 10)];
    const result = scalePathPoints(points, 2, 2, 5, 5);
    expect(result[0].x).toBe(15);
    expect(result[0].y).toBe(15);
  });

  it('scales asymmetrically', () => {
    const points = [pt(10, 20)];
    const result = scalePathPoints(points, 2, 0.5, 0, 0);
    expect(result[0].x).toBe(20);
    expect(result[0].y).toBe(10);
  });
});

// ─── Translate Path Points ──────────────────────────────────────────────────

describe('translatePathPoints', () => {
  it('returns same positions for zero delta', () => {
    const points = [pt(10, 20), pt(30, 40)];
    const result = translatePathPoints(points, 0, 0);
    expect(result).toEqual(points);
  });

  it('shifts positions by positive delta', () => {
    const points = [pt(10, 20)];
    const result = translatePathPoints(points, 5, 15);
    expect(result[0].x).toBe(15);
    expect(result[0].y).toBe(35);
  });

  it('shifts positions by negative delta', () => {
    const points = [pt(10, 20)];
    const result = translatePathPoints(points, -5, -10);
    expect(result[0].x).toBe(5);
    expect(result[0].y).toBe(10);
  });

  it('does not translate handles (they are relative offsets)', () => {
    const points = [ptSymmetric(10, 10, 5, 5)];
    const result = translatePathPoints(points, 10, 10);
    expect(result[0].handleOut).toEqual({ dx: 5, dy: 5 });
    expect(result[0].handleIn).toEqual({ dx: -5, dy: -5 });
  });
});

// ─── Insert Point ───────────────────────────────────────────────────────────

describe('insertPoint', () => {
  it('inserts at beginning', () => {
    const points = [pt(10, 10), pt(20, 20)];
    const result = insertPoint(points, 0, pt(0, 0));
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(pt(0, 0));
    expect(result[1]).toEqual(pt(10, 10));
  });

  it('inserts in middle', () => {
    const points = [pt(0, 0), pt(20, 20)];
    const result = insertPoint(points, 1, pt(10, 10));
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual(pt(10, 10));
  });

  it('inserts at end', () => {
    const points = [pt(0, 0), pt(10, 10)];
    const result = insertPoint(points, 2, pt(20, 20));
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual(pt(20, 20));
  });
});

// ─── Remove Point ───────────────────────────────────────────────────────────

describe('removePoint', () => {
  it('returns null when points.length <= MIN_PATH_POINTS', () => {
    expect(removePoint([pt(0, 0), pt(10, 10)], 0)).toBeNull();
    expect(removePoint([pt(0, 0)], 0)).toBeNull();
  });

  it('removes point when >2 points', () => {
    const points = [pt(0, 0), pt(10, 10), pt(20, 20)];
    const result = removePoint(points, 1);
    expect(result).toHaveLength(2);
    expect(result).toEqual([pt(0, 0), pt(20, 20)]);
  });

  it('removes first point', () => {
    const points = [pt(0, 0), pt(10, 10), pt(20, 20)];
    const result = removePoint(points, 0);
    expect(result).toEqual([pt(10, 10), pt(20, 20)]);
  });

  it('removes last point', () => {
    const points = [pt(0, 0), pt(10, 10), pt(20, 20)];
    const result = removePoint(points, 2);
    expect(result).toEqual([pt(0, 0), pt(10, 10)]);
  });
});

// ─── Update Point ───────────────────────────────────────────────────────────

describe('updatePoint', () => {
  it('updates only the target point', () => {
    const points = [pt(0, 0), pt(10, 10), pt(20, 20)];
    const result = updatePoint(points, 1, { x: 15 });
    expect(result[0]).toEqual(pt(0, 0));
    expect(result[1].x).toBe(15);
    expect(result[1].y).toBe(10);
    expect(result[2]).toEqual(pt(20, 20));
  });

  it('merges partial updates', () => {
    const points = [ptSymmetric(10, 10, 5, 5)];
    const result = updatePoint(points, 0, { y: 20 });
    expect(result[0].x).toBe(10);
    expect(result[0].y).toBe(20);
    expect(result[0].handleOut).toEqual({ dx: 5, dy: 5 });
  });

  it('updates handles', () => {
    const points = [pt(10, 10)];
    const result = updatePoint(points, 0, { handleOut: { dx: 10, dy: 0 } });
    expect(result[0].handleOut).toEqual({ dx: 10, dy: 0 });
  });
});

// ─── Enforce Symmetry ───────────────────────────────────────────────────────

describe('enforceSymmetry', () => {
  it('returns unchanged for non-symmetric point', () => {
    const point = ptCurve(10, 10, { dx: 5, dy: 0 }, { dx: 10, dy: 5 });
    expect(enforceSymmetry(point, 'out')).toEqual(point);
  });

  it('mirrors handleIn when handleOut changed on symmetric point', () => {
    const point: PathPoint = {
      x: 10,
      y: 10,
      handleIn: { dx: -5, dy: -5 },
      handleOut: { dx: 10, dy: 0 },
      symmetric: true,
    };
    const result = enforceSymmetry(point, 'out');
    expect(result.handleIn?.dx).toBe(-10);
    expect(result.handleIn?.dy).toBe(-0);
    expect(result.handleOut).toEqual({ dx: 10, dy: 0 });
  });

  it('mirrors handleOut when handleIn changed on symmetric point', () => {
    const point: PathPoint = {
      x: 10,
      y: 10,
      handleIn: { dx: -10, dy: 5 },
      handleOut: { dx: 5, dy: 5 },
      symmetric: true,
    };
    const result = enforceSymmetry(point, 'in');
    expect(result.handleOut).toEqual({ dx: 10, dy: -5 });
    expect(result.handleIn).toEqual({ dx: -10, dy: 5 });
  });

  it('returns unchanged when changed handle is null', () => {
    const point: PathPoint = {
      x: 10,
      y: 10,
      handleIn: null,
      handleOut: { dx: 5, dy: 5 },
      symmetric: true,
    };
    expect(enforceSymmetry(point, 'in')).toEqual(point);
  });
});

// ─── Is Near Point ──────────────────────────────────────────────────────────

describe('isNearPoint', () => {
  it('returns true for exact match', () => {
    expect(isNearPoint(10, 20, 10, 20, 5)).toBe(true);
  });

  it('returns true when within threshold', () => {
    expect(isNearPoint(10, 20, 12, 21, 5)).toBe(true);
  });

  it('returns true on threshold boundary', () => {
    expect(isNearPoint(0, 0, 3, 4, 5)).toBe(true);
  });

  it('returns false when beyond threshold', () => {
    expect(isNearPoint(0, 0, 4, 4, 5)).toBe(false);
  });
});

// ─── Find Nearest Segment ───────────────────────────────────────────────────

describe('findNearestSegment', () => {
  it('returns null for <2 points', () => {
    expect(findNearestSegment(5, 5, [], 10)).toBeNull();
    expect(findNearestSegment(5, 5, [pt(0, 0)], 10)).toBeNull();
  });

  it('finds point on straight segment', () => {
    const points = [pt(0, 0), pt(10, 0), pt(10, 10)];
    const result = findNearestSegment(5, 0, points, 2);
    expect(result).not.toBeNull();
    expect(result?.segmentIndex).toBe(0);
    expect(result?.t).toBeCloseTo(0.5, 1);
  });

  it('returns null when point beyond threshold', () => {
    const points = [pt(0, 0), pt(10, 0)];
    const result = findNearestSegment(5, 10, points, 5);
    expect(result).toBeNull();
  });

  it('finds nearest bezier segment', () => {
    const points = [pt(0, 0), ptSymmetric(10, 10, 5, 0), pt(20, 0)];
    const result = findNearestSegment(10, 10, points, 2);
    expect(result).not.toBeNull();
  });
});

// ─── Evaluate Segment Point ─────────────────────────────────────────────────

describe('evaluateSegmentPoint', () => {
  it('returns p0 at t=0 for straight segment', () => {
    const points = [pt(0, 0), pt(10, 20)];
    const result = evaluateSegmentPoint(points, 0, 0);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('returns p1 at t=1 for straight segment', () => {
    const points = [pt(0, 0), pt(10, 20)];
    const result = evaluateSegmentPoint(points, 0, 1);
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('returns midpoint at t=0.5 for straight segment', () => {
    const points = [pt(0, 0), pt(10, 20)];
    const result = evaluateSegmentPoint(points, 0, 0.5);
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(10, 5);
  });

  it('evaluates bezier segment at t=0', () => {
    const points = [pt(0, 0), ptSymmetric(10, 10, 5, 0), pt(20, 0)];
    const result = evaluateSegmentPoint(points, 0, 0);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('evaluates bezier segment at t=1', () => {
    const points = [pt(0, 0), ptSymmetric(10, 10, 5, 0), pt(20, 0)];
    const result = evaluateSegmentPoint(points, 0, 1);
    expect(result.x).toBeCloseTo(10, 5);
    expect(result.y).toBeCloseTo(10, 5);
  });
});

// ─── Flatten Segment ────────────────────────────────────────────────────────

describe('flattenSegment', () => {
  it('returns 2 points for straight segment', () => {
    const points = [pt(0, 0), pt(10, 0), pt(10, 10)];
    const result = flattenSegment(points, 0);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 10, y: 0 });
  });

  it('returns steps+1 points for bezier segment', () => {
    const points = [pt(0, 0), ptSymmetric(10, 10, 5, 0), pt(20, 0)];
    const result = flattenSegment(points, 0, 10);
    expect(result).toHaveLength(11);
  });

  it('uses default 20 steps', () => {
    const points = [pt(0, 0), ptSymmetric(10, 10, 5, 0), pt(20, 0)];
    const result = flattenSegment(points, 0);
    expect(result).toHaveLength(21);
  });
});

// ─── Snap Angle 45 ──────────────────────────────────────────────────────────

describe('snapAngle45', () => {
  it('snaps 0° horizontal right', () => {
    const result = snapAngle45(0, 0, 10, 0);
    expect(result.x).toBeCloseTo(10, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('snaps 45° diagonal', () => {
    const result = snapAngle45(0, 0, 10, 10);
    const len = Math.sqrt(200);
    expect(result.x).toBeCloseTo(len * Math.cos(Math.PI / 4), 5);
    expect(result.y).toBeCloseTo(len * Math.sin(Math.PI / 4), 5);
  });

  it('snaps 90° vertical up', () => {
    const result = snapAngle45(0, 0, 0, 10);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(10, 5);
  });

  it('snaps 135° diagonal', () => {
    const result = snapAngle45(0, 0, -10, 10);
    const len = Math.sqrt(200);
    const angle = (3 * Math.PI) / 4;
    expect(result.x).toBeCloseTo(len * Math.cos(angle), 5);
    expect(result.y).toBeCloseTo(len * Math.sin(angle), 5);
  });

  it('snaps 180° horizontal left', () => {
    const result = snapAngle45(0, 0, -10, 0);
    expect(result.x).toBeCloseTo(-10, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('snaps near-45° angle to 45°', () => {
    const result = snapAngle45(0, 0, 10, 9);
    const len = Math.sqrt(181);
    const angle = Math.PI / 4;
    expect(result.x).toBeCloseTo(len * Math.cos(angle), 5);
    expect(result.y).toBeCloseTo(len * Math.sin(angle), 5);
  });

  it('returns target for zero distance', () => {
    const result = snapAngle45(5, 5, 5, 5);
    expect(result).toEqual({ x: 5, y: 5 });
  });
});

// ─── Corner Point ───────────────────────────────────────────────────────────

describe('cornerPoint', () => {
  it('returns point with no handles', () => {
    const result = cornerPoint(10, 20);
    expect(result).toEqual({
      x: 10,
      y: 20,
      handleIn: null,
      handleOut: null,
      symmetric: true,
    });
  });
});

// ─── Split Bezier Segment ───────────────────────────────────────────────────

describe('splitBezierSegment', () => {
  it('returns midpoint at t=0.5 for straight segment', () => {
    const p0 = pt(0, 0);
    const p1 = pt(10, 0);
    const result = splitBezierSegment(p0, p1, 0.5);
    expect(result.mid.x).toBeCloseTo(5, 5);
    expect(result.mid.y).toBeCloseTo(0, 5);
  });

  it('preserves curve shape with before + mid + after', () => {
    const p0 = pt(0, 0);
    const p1 = ptSymmetric(20, 20, 10, 0);
    const result = splitBezierSegment(p0, p1, 0.5);
    expect(result.before.x).toBe(0);
    expect(result.before.y).toBe(0);
    expect(result.after.x).toBe(20);
    expect(result.after.y).toBe(20);
    expect(result.mid.x).toBeGreaterThan(0);
    expect(result.mid.x).toBeLessThan(20);
  });

  it('returns correct handle structure', () => {
    const p0 = ptCurve(0, 0, null, { dx: 10, dy: 10 });
    const p1 = ptCurve(20, 0, { dx: -10, dy: 10 }, null);
    const result = splitBezierSegment(p0, p1, 0.5);
    expect(result.mid.handleIn).not.toBeNull();
    expect(result.mid.handleOut).not.toBeNull();
    expect(result.mid.symmetric).toBe(false);
  });
});

// ─── Clamp Path To Bounds ───────────────────────────────────────────────────

describe('clampPathToBounds', () => {
  it('returns unchanged when points within bounds', () => {
    const points = [pt(5, 5), pt(10, 10)];
    const result = clampPathToBounds(points, 20, 20);
    expect(result).toEqual(points);
  });

  it('clamps points outside bounds to [0,width]×[0,depth]', () => {
    const points = [pt(-5, -5), pt(25, 25)];
    const result = clampPathToBounds(points, 20, 20);
    expect(result[0]).toEqual(pt(0, 0));
    expect(result[1]).toEqual(pt(20, 20));
  });

  it('clamps handles so absolute position stays in bounds', () => {
    const points = [ptCurve(5, 5, { dx: -10, dy: -10 }, { dx: 20, dy: 20 })];
    const result = clampPathToBounds(points, 20, 20);
    expect(result[0].handleIn).toEqual({ dx: -5, dy: -5 });
    expect(result[0].handleOut).toEqual({ dx: 15, dy: 15 });
  });

  it('handles zero-size bounds', () => {
    const points = [pt(10, 10)];
    const result = clampPathToBounds(points, 0, 0);
    expect(result[0]).toEqual(pt(0, 0));
  });

  it('clamps point at edge to edge value', () => {
    const points = [pt(20, 20)];
    const result = clampPathToBounds(points, 20, 20);
    expect(result[0]).toEqual(pt(20, 20));
  });
});

// ─── Is Self Intersecting ───────────────────────────────────────────────────

describe('isSelfIntersecting', () => {
  it('returns false for <3 points', () => {
    expect(isSelfIntersecting([])).toBe(false);
    expect(isSelfIntersecting([pt(0, 0)])).toBe(false);
    expect(isSelfIntersecting([pt(0, 0), pt(10, 10)])).toBe(false);
  });

  it('returns false for simple convex polygon (triangle)', () => {
    const points = [pt(0, 0), pt(10, 0), pt(5, 10)];
    expect(isSelfIntersecting(points)).toBe(false);
  });

  it('returns false for square', () => {
    const points = [pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)];
    expect(isSelfIntersecting(points)).toBe(false);
  });

  it('returns true for figure-8 crossing', () => {
    const points = [pt(0, 0), pt(10, 10), pt(10, 0), pt(0, 10)];
    expect(isSelfIntersecting(points)).toBe(true);
  });

  it('returns false for concave but non-intersecting shape', () => {
    const points = [pt(0, 0), pt(10, 0), pt(10, 10), pt(5, 5), pt(0, 10)];
    expect(isSelfIntersecting(points)).toBe(false);
  });
});
