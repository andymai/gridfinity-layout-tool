import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  buildSnapModel,
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

/** A snap model over cutouts alone, with no board frame and no lattice. */
function shapesOnly(cutouts: readonly Cutout[]) {
  return buildSnapModel({ cutouts, innerW: 0, innerD: 0, gridSize: null });
}

describe('buildSnapModel over a single shape', () => {
  it('offers corners, edge midpoints and the centre of a rectangle', () => {
    const model = shapesOnly([makeCutout({ x: 0, y: 0, width: 10, depth: 20 })]);

    expect(model.points).toContainEqual({ x: 0, y: 0 });
    expect(model.points).toContainEqual({ x: 10, y: 0 });
    expect(model.points).toContainEqual({ x: 0, y: 20 });
    expect(model.points).toContainEqual({ x: 10, y: 20 });
    expect(model.points).toContainEqual({ x: 5, y: 10 });
    expect(model.segments).toHaveLength(4);
  });

  it('skips hidden cutouts', () => {
    expect(shapesOnly([makeCutout({ hidden: true })]).points).toHaveLength(0);
  });
});

describe('snapToNearestTarget threshold', () => {
  const model = shapesOnly([makeCutout({ x: 5, y: 5, width: 10, depth: 10 })]);

  it('snaps to the nearest point within the threshold', () => {
    // At zoom 1 the threshold is 8mm; (11, 11) is ~1.4mm from the corner.
    const result = snapToNearestTarget(11, 11, model, 1);
    expect([result.snapped, result.x, result.y]).toEqual([true, 10, 10]);
  });

  it('scales the threshold with zoom', () => {
    // At zoom 10 the threshold is 0.8mm, so the same 1mm gap is out of reach.
    expect(snapToNearestTarget(11, 10.99, model, 10).kind).toBe('none');
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
