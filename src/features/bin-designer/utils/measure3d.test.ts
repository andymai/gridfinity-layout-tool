import { describe, it, expect } from 'vitest';
import {
  measureBetween,
  nearestPointOnSegment3,
  probeThickness,
  raycastTriangles,
  snapToCreaseEdges,
  type Vec3,
} from './measure3d';

/** An axis-aligned box as a non-indexed triangle soup, for the raycast tests. */
function box(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
  const v = [
    [minX, minY, minZ],
    [maxX, minY, minZ],
    [maxX, maxY, minZ],
    [minX, maxY, minZ],
    [minX, minY, maxZ],
    [maxX, minY, maxZ],
    [maxX, maxY, maxZ],
    [minX, maxY, maxZ],
  ];
  const faces = [
    [0, 2, 1],
    [0, 3, 2], // bottom
    [4, 5, 6],
    [4, 6, 7], // top
    [0, 1, 5],
    [0, 5, 4], // front
    [3, 7, 6],
    [3, 6, 2], // back
    [0, 4, 7],
    [0, 7, 3], // left
    [1, 2, 6],
    [1, 6, 5], // right
  ];
  const out: number[] = [];
  for (const f of faces) for (const i of f) out.push(...v[i]);
  return new Float32Array(out);
}

const DOWN: Vec3 = { x: 0, y: 0, z: -1 };

describe('measureBetween', () => {
  it('reports the distance and each axis delta', () => {
    const r = measureBetween({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 });
    expect(r.distance).toBeCloseTo(13, 6);
    expect([r.dx, r.dy, r.dz]).toEqual([3, 4, 12]);
  });

  it('signs the deltas by direction, so the readout says which way', () => {
    const r = measureBetween({ x: 5, y: 5, z: 5 }, { x: 1, y: 5, z: 9 });
    expect([r.dx, r.dy, r.dz]).toEqual([-4, 0, 4]);
  });
});

describe('nearestPointOnSegment3', () => {
  it('projects onto the interior of a segment', () => {
    const p = nearestPointOnSegment3(
      { x: 5, y: 3, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 }
    );
    expect(p).toEqual({ x: 5, y: 0, z: 0 });
  });

  it('clamps past an end rather than running off the edge', () => {
    const p = nearestPointOnSegment3(
      { x: 40, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 }
    );
    expect(p).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('survives a degenerate segment', () => {
    const a = { x: 2, y: 2, z: 2 };
    expect(nearestPointOnSegment3({ x: 9, y: 9, z: 9 }, a, a)).toEqual(a);
  });
});

describe('snapToCreaseEdges', () => {
  // One horizontal edge from (0,0,0) to (10,0,0).
  const edges = new Float32Array([0, 0, 0, 10, 0, 0]);

  it('prefers an endpoint over a nearer point along the edge', () => {
    // The hit is 0.2mm off the edge but 0.5mm from the endpoint. Distance alone
    // would take the edge and make the corner unreachable, since every point of
    // an edge is zero distance from it.
    const snapped = snapToCreaseEdges({ x: 0.45, y: 0.2, z: 0 }, edges, 1);
    expect(snapped.kind).toBe('vertex');
    expect([snapped.x, snapped.y, snapped.z]).toEqual([0, 0, 0]);
  });

  it('snaps along the edge when no endpoint is in range', () => {
    const snapped = snapToCreaseEdges({ x: 5, y: 0.3, z: 0 }, edges, 1);
    expect(snapped.kind).toBe('edge');
    expect(snapped.x).toBeCloseTo(5, 6);
    expect(snapped.y).toBeCloseTo(0, 6);
  });

  it('leaves the hit alone when nothing is within tolerance', () => {
    const hit = { x: 5, y: 40, z: 0 };
    const snapped = snapToCreaseEdges(hit, edges, 1);
    expect(snapped).toEqual({ ...hit, kind: 'surface' });
  });

  it('takes the nearest of several endpoints', () => {
    const many = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0, 21, 0, 0]);
    const snapped = snapToCreaseEdges({ x: 20.9, y: 0.1, z: 0 }, many, 1);
    expect(snapped.x).toBeCloseTo(21, 6);
  });

  it('treats a missing or empty edge set as no snap, not as a failure', () => {
    const hit = { x: 1, y: 2, z: 3 };
    expect(snapToCreaseEdges(hit, null, 1).kind).toBe('surface');
    expect(snapToCreaseEdges(hit, new Float32Array([]), 1).kind).toBe('surface');
  });

  it('does not snap at all with a zero tolerance', () => {
    expect(snapToCreaseEdges({ x: 0, y: 0, z: 0 }, edges, 0).kind).toBe('surface');
  });
});

describe('raycastTriangles', () => {
  const cube = box(-5, -5, 0, 5, 5, 10);

  it('returns the nearest surface, not just any crossing', () => {
    const hit = raycastTriangles({ x: 0, y: 0, z: 40 }, DOWN, cube, null);
    expect(hit?.point.z).toBeCloseTo(10, 6);
    expect(hit?.distance).toBeCloseTo(30, 6);
  });

  it('sees the far side too, which the thickness probe depends on', () => {
    // A front-facing test would cull the underside and report no thickness.
    const hit = raycastTriangles({ x: 0, y: 0, z: 5 }, DOWN, cube, null, 1e-4);
    expect(hit?.point.z).toBeCloseTo(0, 6);
  });

  it('skips the surface a ray was launched from', () => {
    const fromTop = { x: 0, y: 0, z: 10 };
    expect(raycastTriangles(fromTop, DOWN, cube, null, 1e-4)?.point.z).toBeCloseTo(0, 6);
  });

  it('misses cleanly when the ray passes beside the solid', () => {
    expect(raycastTriangles({ x: 40, y: 0, z: 40 }, DOWN, cube, null)).toBeNull();
  });

  it('reports a unit normal', () => {
    const hit = raycastTriangles({ x: 0, y: 0, z: 40 }, DOWN, cube, null);
    const n = hit?.normal ?? { x: 0, y: 0, z: 0 };
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
  });

  it('reads an indexed mesh the same as a soup', () => {
    const soup = raycastTriangles({ x: 0, y: 0, z: 40 }, DOWN, cube, null);
    const indices = new Uint32Array(cube.length / 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
    const indexed = raycastTriangles({ x: 0, y: 0, z: 40 }, DOWN, cube, indices);
    expect(indexed?.point.z).toBeCloseTo(soup?.point.z ?? -1, 6);
  });

  it('returns null rather than throwing on an absent mesh', () => {
    expect(raycastTriangles({ x: 0, y: 0, z: 0 }, DOWN, null, null)).toBeNull();
  });
});

describe('probeThickness', () => {
  const slab = box(-5, -5, 0, 5, 5, 3);

  it('measures through the material from the picked face', () => {
    const result = probeThickness({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 1 }, DOWN, slab, null);
    expect(result?.thickness).toBeCloseTo(3, 6);
    expect(result?.to.z).toBeCloseTo(0, 6);
  });

  it('fires inward whichever way the face normal happens to wind', () => {
    // Winding does not say which side the camera is on, so an outward-wound
    // and an inward-wound normal must give the same answer for the same pick.
    const flipped = probeThickness({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -1 }, DOWN, slab, null);
    expect(flipped?.thickness).toBeCloseTo(3, 6);
  });

  it('reports nothing when there is no material behind the face', () => {
    // A real answer, not a failure: the pick was on a face with nothing behind
    // it along its own normal.
    const result = probeThickness(
      { x: 0, y: 0, z: 3 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      new Float32Array([100, 100, 100, 101, 100, 100, 100, 101, 100]),
      null
    );
    expect(result).toBeNull();
  });
});
