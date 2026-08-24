import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { getCutoutOutline } from './cutoutOutline';

const base: Cutout = {
  id: 'c1',
  shape: 'rectangle',
  x: 10,
  y: 20,
  width: 30,
  depth: 40,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

const makeCutout = (overrides: Partial<Cutout>): Cutout => ({ ...base, ...overrides });

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

function boundsOf(rings: readonly (readonly { x: number; y: number }[])[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Signed area (shoelace) of a ring; positive when wound CCW. */
function ringArea(ring: readonly { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    a += (p.x * q.y - q.x * p.y) / 2;
  }
  return Math.abs(a);
}

describe('getCutoutOutline', () => {
  it('returns the four corners of a square-cornered rectangle', () => {
    const rings = getCutoutOutline(makeCutout({}));
    expect(rings).toHaveLength(1);
    expect(rings?.[0]).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 },
    ]);
  });

  it('rotates about the box center', () => {
    const rings = getCutoutOutline(makeCutout({ x: 0, y: 0, width: 10, depth: 10, rotation: 90 }));
    const b = boundsOf(rings ?? []);
    expect(b.minX).toBeCloseTo(0);
    expect(b.minY).toBeCloseTo(0);
    expect(b.maxX).toBeCloseTo(10);
    expect(b.maxY).toBeCloseTo(10);
  });

  it('circumscribes an ellipse rather than inscribing it', () => {
    // A sampled ring that merely touched the ellipse would read smaller than
    // the real curve and let a placement through that clips in the mesh.
    const cutout = makeCutout({ shape: 'circle', x: 0, y: 0, width: 20, depth: 10 });
    const ring = getCutoutOutline(cutout)?.[0] ?? [];
    for (const p of ring) {
      const nx = (p.x - 10) / 10;
      const ny = (p.y - 5) / 5;
      expect(Math.hypot(nx, ny)).toBeGreaterThanOrEqual(1);
    }
    // ...but only just: the ring must not be a wildly loose over-approximation.
    expect(ringArea(ring)).toBeLessThan(Math.PI * 10 * 5 * 1.01);
  });

  it('traces a polygon cutout as an N-gon, not its bounding box', () => {
    const hex = makeCutout({ shape: 'polygon', sides: 6, x: 0, y: 0, width: 20, depth: 20 });
    const ring = getCutoutOutline(hex)?.[0] ?? [];
    expect(ring).toHaveLength(6);
    expect(ringArea(ring)).toBeLessThan(20 * 20);
  });

  it('rounds the ends of a slot', () => {
    const slot = makeCutout({ shape: 'slot', x: 0, y: 0, width: 40, depth: 10 });
    const ring = getCutoutOutline(slot)?.[0] ?? [];
    // Stadium = 30×10 rectangle + a d=10 circle, well under the 40×10 box.
    expect(ringArea(ring)).toBeGreaterThan(300);
    expect(ringArea(ring)).toBeLessThan(400);
  });

  it('uses the flattened path vertices for a path cutout', () => {
    const path = [corner(5, 5), corner(35, 5), corner(35, 35), corner(5, 35)];
    const rings = getCutoutOutline(makeCutout({ shape: 'path', path }));
    expect(rings).toHaveLength(1);
    expect(ringArea(rings?.[0] ?? [])).toBeCloseTo(900);
  });

  it('rotates clockwise, matching the renderer and the worker', () => {
    // A right triangle with its square corner at bottom-left (0,0). Stored
    // rotation is clockwise-positive (PathShapeMesh renders at -rotation), so
    // 90° carries that corner to the TOP-LEFT (0,10); the CCW mirror would put
    // it bottom-right instead, and a mask check made there validates a shape
    // the cut does not match.
    const path = [corner(0, 0), corner(10, 0), corner(0, 10)];
    const ring = getCutoutOutline(makeCutout({ shape: 'path', path, rotation: 90 }))?.[0] ?? [];
    const has = (x: number, y: number) =>
      ring.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
    expect(has(0, 10)).toBe(true);
    expect(has(0, 0)).toBe(true);
    expect(has(10, 10)).toBe(true);
    expect(has(10, 0)).toBe(false);
  });

  it('rotates a path about its own vertex bounds, not the width/depth box', () => {
    // x/y/width/depth deliberately disagree with the path — the renderer pivots
    // on the vertex bounds, so the outline must too.
    const path = [corner(0, 0), corner(10, 0), corner(10, 10), corner(0, 10)];
    const rings = getCutoutOutline(
      makeCutout({ shape: 'path', path, x: 100, y: 100, width: 999, depth: 999, rotation: 90 })
    );
    const b = boundsOf(rings ?? []);
    expect(b.minX).toBeCloseTo(0);
    expect(b.minY).toBeCloseTo(0);
    expect(b.maxX).toBeCloseTo(10);
    expect(b.maxY).toBeCloseTo(10);
  });

  it('returns null for shapes too degenerate to outline', () => {
    expect(getCutoutOutline(makeCutout({ width: 0 }))).toBeNull();
    expect(getCutoutOutline(makeCutout({ shape: 'path', path: undefined }))).toBeNull();
    expect(getCutoutOutline(makeCutout({ shape: 'path', path: [corner(1, 1)] }))).toBeNull();
  });

  describe('mesh imprints', () => {
    const asset: MeshAsset = {
      name: 'wrench',
      data: '',
      triangleCount: 0,
      sizeMm: { x: 20, y: 20, z: 5 },
      // L-shaped silhouette filling the bottom-left and bottom-right of the box.
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
          { x: 10, y: 10 },
          { x: 10, y: 20 },
          { x: 0, y: 20 },
        ],
      ],
    };
    const meshCutout = makeCutout({
      shape: 'mesh',
      meshId: 'm1',
      x: 0,
      y: 0,
      width: 20,
      depth: 20,
    });

    it('maps the stored silhouette onto the footprint box', () => {
      const ring = getCutoutOutline(meshCutout, { m1: asset })?.[0] ?? [];
      expect(ring).toHaveLength(6);
      // L covers 3 of the 4 quadrants — decisively less than the 400mm² box.
      expect(ringArea(ring)).toBeCloseTo(300);
    });

    it('rescales the silhouette when the footprint box differs from the asset', () => {
      const ring =
        getCutoutOutline({ ...meshCutout, width: 40, depth: 20 }, { m1: asset })?.[0] ?? [];
      expect(ringArea(ring)).toBeCloseTo(600);
    });

    it('falls back to the footprint rectangle without the asset', () => {
      const ring = getCutoutOutline(meshCutout)?.[0] ?? [];
      expect(ring).toHaveLength(4);
      expect(ringArea(ring)).toBeCloseTo(400);
    });
  });
});
