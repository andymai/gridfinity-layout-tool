import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  buildSnapModel,
  collectSnapTargets,
  nearestPointOnSegment,
  snapToNearestTarget,
  computeMeasurement,
} from './rulerHandler';

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'test-1',
    shape: 'rectangle',
    x: 10,
    y: 20,
    width: 30,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

describe('collectSnapTargets', () => {
  it('returns corners, edge midpoints, and center for a rectangle', () => {
    const cutout = makeCutout({ x: 0, y: 0, width: 10, depth: 20 });
    const targets = collectSnapTargets([cutout]);

    // 4 corners + 4 edge midpoints + 1 center = 9
    expect(targets).toHaveLength(9);

    // Corners
    expect(targets).toContainEqual({ x: 0, y: 0 });
    expect(targets).toContainEqual({ x: 10, y: 0 });
    expect(targets).toContainEqual({ x: 0, y: 20 });
    expect(targets).toContainEqual({ x: 10, y: 20 });

    // Center
    expect(targets).toContainEqual({ x: 5, y: 10 });
  });

  it('skips hidden cutouts', () => {
    const cutout = makeCutout({ hidden: true });
    const targets = collectSnapTargets([cutout]);
    expect(targets).toHaveLength(0);
  });
});

describe('snapToNearestTarget', () => {
  const targets = [
    { x: 10, y: 10 },
    { x: 50, y: 50 },
  ];

  it('snaps to nearest target within threshold', () => {
    // At zoom=1, threshold is 8mm. Point (11, 11) is ~1.4mm from (10,10)
    const result = snapToNearestTarget(11, 11, targets, 1);
    expect(result.snapped).toBe(true);
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
  });

  it('returns original point when nothing is close enough', () => {
    const result = snapToNearestTarget(30, 30, targets, 1);
    expect(result.snapped).toBe(false);
    expect(result.x).toBe(30);
    expect(result.y).toBe(30);
  });

  it('adapts threshold based on zoom', () => {
    // At zoom=10, threshold is 0.8mm. Point (11, 10) is 1mm away — too far
    const result = snapToNearestTarget(11, 10, targets, 10);
    expect(result.snapped).toBe(false);
  });
});

describe('computeMeasurement', () => {
  it('computes distance and deltas for horizontal line', () => {
    const result = computeMeasurement(0, 0, 10, 0);
    expect(result.distance).toBeCloseTo(10);
    expect(result.deltaX).toBe(10);
    expect(result.deltaY).toBe(0);
  });

  it('computes distance for diagonal line', () => {
    const result = computeMeasurement(0, 0, 3, 4);
    expect(result.distance).toBeCloseTo(5);
    expect(result.deltaX).toBe(3);
    expect(result.deltaY).toBe(4);
  });

  it('handles zero-length measurement', () => {
    const result = computeMeasurement(5, 5, 5, 5);
    expect(result.distance).toBe(0);
  });
});

/** A path vertex with no bezier handles. */
function corner(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false };
}

describe('buildSnapModel (#3696)', () => {
  const board = { cutouts: [], innerW: 100, innerD: 60, gridSize: null } as const;

  const has = (pts: ReadonlyArray<{ x: number; y: number }>, x: number, y: number) =>
    pts.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);

  it('offers the interior walls, which the box-only model could not', () => {
    // Measuring a cutout to a wall was the most common thing the ruler could
    // not do: it snapped to nothing at all.
    const model = buildSnapModel(board);
    expect(has(model.points, 0, 0)).toBe(true);
    expect(has(model.points, 100, 60)).toBe(true);
    expect(model.segments).toHaveLength(4);
  });

  it('omits the walls when the board has no size yet', () => {
    expect(buildSnapModel({ ...board, innerW: 0, innerD: 0 }).segments).toHaveLength(0);
  });

  it('follows a rotated shape rather than its bounding box', () => {
    // A 45-degree square's corners are on the box's edge MIDPOINTS, so a
    // bounding-box target floats visibly off the shape.
    const cutout = makeCutout({ x: 0, y: 0, width: 10, depth: 10, rotation: 45 });
    const model = buildSnapModel({ ...board, cutouts: [cutout] });
    const half = Math.SQRT2 * 5;
    expect(has(model.points, 5, 5 - half)).toBe(true);
    // The box corner is not a target: no material of the shape reaches it.
    expect(has(model.points, 0, 0)).toBe(true); // the board corner, not the shape
    expect(model.points.filter((p) => Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6)).toHaveLength(
      1
    );
  });

  it('takes a path shape at its real vertices', () => {
    const path = makeCutout({
      shape: 'path',
      x: 0,
      y: 0,
      width: 10,
      depth: 10,
      path: [corner(0, 0), corner(10, 0), corner(10, 10)],
    });
    const model = buildSnapModel({ ...board, cutouts: [path] });
    expect(has(model.points, 10, 10)).toBe(true);
  });

  it('keeps the box verdict for a shape too degenerate to outline', () => {
    // Dropping it would make a broken shape unmeasurable, which is a worse
    // answer than the approximate one the rest of the editor already gives it.
    const broken = makeCutout({ shape: 'path', path: [] });
    const model = buildSnapModel({ ...board, cutouts: [broken] });
    expect(has(model.points, 10, 20)).toBe(true);
  });

  it('skips hidden cutouts', () => {
    const hidden = makeCutout({ hidden: true, x: 200, y: 200 });
    const model = buildSnapModel({ ...board, cutouts: [hidden] });
    expect(model.points.every((p) => p.x < 200)).toBe(true);
  });
});

describe('snapToNearestTarget priority (#3696)', () => {
  const board = { cutouts: [], innerW: 100, innerD: 60, gridSize: null } as const;

  it('prefers a corner over the edge running through it', () => {
    // Every point of an edge is zero distance from that edge, so distance
    // alone would let the wall swallow the corner and make it unreachable.
    // At zoom 20 the threshold is 0.4mm, so the probe has to be inside that of
    // the corner for the comparison to be about priority rather than range.
    const model = buildSnapModel(board);
    const snapped = snapToNearestTarget(0.2, 0.2, model, 20);
    expect(snapped.kind).toBe('point');
    expect([snapped.x, snapped.y]).toEqual([0, 0]);
  });

  it('snaps along a wall away from its corners', () => {
    const model = buildSnapModel(board);
    const snapped = snapToNearestTarget(30, 0.2, model, 20);
    expect(snapped.kind).toBe('edge');
    expect(snapped.y).toBeCloseTo(0, 6);
    expect(snapped.x).toBeCloseTo(30, 6);
  });

  it('falls back to the snap lattice, and only when snap is on', () => {
    const withGrid = buildSnapModel({ ...board, gridSize: 5 });
    expect(snapToNearestTarget(24.9, 30.1, withGrid, 20).kind).toBe('grid');
    expect(snapToNearestTarget(24.9, 30.1, buildSnapModel(board), 20).kind).toBe('none');
  });

  it('leaves the cursor free when nothing is in reach', () => {
    // Not the board centre, which is deliberately a target of its own.
    const snapped = snapToNearestTarget(37, 22, buildSnapModel(board), 20);
    expect(snapped).toEqual({ x: 37, y: 22, snapped: false, kind: 'none' });
  });

  it('still accepts a bare target array, so old callers keep working', () => {
    const snapped = snapToNearestTarget(0.1, 0.1, [{ x: 0, y: 0 }], 20);
    expect(snapped.kind).toBe('point');
  });
});

describe('nearestPointOnSegment', () => {
  it('clamps to an end rather than running off the segment', () => {
    const seg = { x1: 0, y1: 0, x2: 10, y2: 0 };
    expect(nearestPointOnSegment(50, 5, seg)).toEqual({ x: 10, y: 0 });
  });

  it('survives a zero-length segment', () => {
    const seg = { x1: 4, y1: 4, x2: 4, y2: 4 };
    expect(nearestPointOnSegment(0, 0, seg)).toEqual({ x: 4, y: 4 });
  });
});
