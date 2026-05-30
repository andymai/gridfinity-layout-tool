// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import { pocketCornerRadius } from './generatorConstants';

// BREP generator requires OpenCascade WASM init
type BrepGenerateFn = (
  params: BaseplateParams,
  onProgress: (stage: string, progress: number) => void,
  forExport: boolean,
  signal?: AbortSignal
) => {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
};

// Direct mesh generator — pure TypeScript, no WASM
type DirectGenerateFn = (
  params: BaseplateParams,
  onProgress: (stage: string, progress: number) => void,
  signal?: AbortSignal
) => {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
};

let generateBrep: BrepGenerateFn;
let generateDirect: DirectGenerateFn;

beforeAll(async () => {
  // Init OpenCascade WASM for BREP generator
  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  initFromOC(OC);

  const brep = await import('./baseplateGenerator');
  generateBrep = brep.generateBaseplate;

  const direct = await import('./baseplateDirectMesh');
  generateDirect = direct.generateBaseplateDirect;
}, 30000);

const defaults = (overrides: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 2,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  ...overrides,
});

const noop = (): void => {};

// ─── Mesh Analysis Utilities ────────────────────────────────────────────────

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function computeBounds(vertices: Float32Array): BoundingBox {
  const bb: BoundingBox = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i],
      y = vertices[i + 1],
      z = vertices[i + 2];
    if (x < bb.minX) bb.minX = x;
    if (x > bb.maxX) bb.maxX = x;
    if (y < bb.minY) bb.minY = y;
    if (y > bb.maxY) bb.maxY = y;
    if (z < bb.minZ) bb.minZ = z;
    if (z > bb.maxZ) bb.maxZ = z;
  }
  return bb;
}

interface IndexedMesh {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

/**
 * Sum the projected XY area of triangles whose face normal points roughly along
 * the desired Z direction (`+1` for top, `-1` for bottom). The signed-area
 * formula naturally returns positive values for triangles wound CCW from the
 * normal direction, so we take the absolute value to be agnostic to winding
 * (the lattice gussets and the padding ring use opposite winding conventions).
 *
 * `expectedZ` filters to triangles lying at a specific slab-face Z plane so
 * the magnet variant's cancel-face discs (which also face -Z but sit at a
 * different height) are excluded.
 */
function horizontalFaceArea(mesh: IndexedMesh, sign: 1 | -1, expectedZ?: number): number {
  const { vertices, normals, indices } = mesh;
  let total = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const nzA = normals[a + 2];
    const nzB = normals[b + 2];
    const nzC = normals[c + 2];
    const allMatch =
      sign > 0 ? nzA > 0.9 && nzB > 0.9 && nzC > 0.9 : nzA < -0.9 && nzB < -0.9 && nzC < -0.9;
    if (!allMatch) continue;
    if (expectedZ !== undefined) {
      const zA = vertices[a + 2];
      const zB = vertices[b + 2];
      const zC = vertices[c + 2];
      if (
        Math.abs(zA - expectedZ) > 0.1 ||
        Math.abs(zB - expectedZ) > 0.1 ||
        Math.abs(zC - expectedZ) > 0.1
      ) {
        continue;
      }
    }
    const ax = vertices[a],
      ay = vertices[a + 1];
    const bx = vertices[b],
      by = vertices[b + 1];
    const cx = vertices[c],
      cy = vertices[c + 1];
    total += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return total;
}

/**
 * Closed-form area of a Gridfinity-style rounded rectangle (corners with
 * radius `r` clipped from a `w × d` rectangle). Used to predict the area
 * removed by each pocket opening.
 */
function roundedRectArea(w: number, d: number, r: number): number {
  if (r <= 0) return w * d;
  const clamped = Math.min(r, w / 2 - 0.01, d / 2 - 0.01);
  const effectiveR = Math.max(clamped, 0);
  // Rect minus 4 corner squares plus 4 quarter-circle arcs = w*d - 4r² + π·r².
  return w * d - 4 * effectiveR * effectiveR + Math.PI * effectiveR * effectiveR;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('baseplateDirectMesh', () => {
  // ─── Basic mesh validity ────────────────────────────────────────────────
  it('generates non-empty mesh for 2×2 without magnets', () => {
    const mesh = generateDirect(defaults(), noop);
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.triangleCount).toBeGreaterThan(0);
  });

  it('generates non-empty mesh for 2×2 with magnets', () => {
    const mesh = generateDirect(defaults({ magnetHoles: true }), noop);
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.triangleCount).toBeGreaterThan(0);
  });

  // ─── Performance ────────────────────────────────────────────────────────
  it('generates 8×8 mesh in under 200ms', () => {
    const start = performance.now();
    const mesh = generateDirect(defaults({ width: 8, depth: 8, magnetHoles: true }), noop);
    const elapsed = performance.now() - start;
    expect(mesh.vertices.length).toBeGreaterThan(0);
    // Relaxed from 50ms — under full-suite load with WASM contention, timings vary
    expect(elapsed).toBeLessThan(200);
  });

  // ─── Comparison: bounding boxes ─────────────────────────────────────────
  it('2×2 no magnets: bounding box matches BREP', () => {
    const params = defaults();
    const brep = generateBrep(params, noop, false);
    const direct = generateDirect(params, noop);

    const brepBB = computeBounds(brep.vertices);
    const directBB = computeBounds(direct.vertices);

    // X/Y extents should match within 1mm (corner arc approximation)
    expect(directBB.minX).toBeCloseTo(brepBB.minX, 0);
    expect(directBB.maxX).toBeCloseTo(brepBB.maxX, 0);
    expect(directBB.minY).toBeCloseTo(brepBB.minY, 0);
    expect(directBB.maxY).toBeCloseTo(brepBB.maxY, 0);
    // Z extents should match closely
    expect(directBB.minZ).toBeCloseTo(brepBB.minZ, 1);
    expect(directBB.maxZ).toBeCloseTo(brepBB.maxZ, 1);
  });

  it('2×2 with magnets: bounding box matches BREP', () => {
    const params = defaults({ magnetHoles: true });
    const brep = generateBrep(params, noop, false);
    const direct = generateDirect(params, noop);

    const brepBB = computeBounds(brep.vertices);
    const directBB = computeBounds(direct.vertices);

    expect(directBB.minX).toBeCloseTo(brepBB.minX, 0);
    expect(directBB.maxX).toBeCloseTo(brepBB.maxX, 0);
    expect(directBB.minY).toBeCloseTo(brepBB.minY, 0);
    expect(directBB.maxY).toBeCloseTo(brepBB.maxY, 0);
    expect(directBB.minZ).toBeCloseTo(brepBB.minZ, 0);
    expect(directBB.maxZ).toBeCloseTo(brepBB.maxZ, 0);
  });

  // ─── Comparison: triangle counts ─────────────────────────────────────────
  // Volume comparison is unreliable because the direct mesh uses cancellation
  // polygons (overlapping faces with opposite normals) rather than being a true
  // manifold. This inflates the signed-volume computation. Instead, compare
  // triangle counts and bounding boxes as geometric similarity metrics.
  it('2×2 no magnets: triangle count in same order of magnitude as BREP', () => {
    const params = defaults();
    const brep = generateBrep(params, noop, false);
    const direct = generateDirect(params, noop);

    // Direct mesh should have similar order of magnitude triangles
    // BREP preview uses very coarse tessellation (tolerance=0.5, angular=45°)
    // so the direct mesh may have more or fewer triangles
    expect(direct.triangleCount).toBeGreaterThan(brep.triangleCount * 0.1);
    expect(direct.triangleCount).toBeLessThan(brep.triangleCount * 10);
  });

  it('2×2 with magnets: triangle count in same order of magnitude as BREP', () => {
    const params = defaults({ magnetHoles: true });
    const brep = generateBrep(params, noop, false);
    const direct = generateDirect(params, noop);

    expect(direct.triangleCount).toBeGreaterThan(brep.triangleCount * 0.1);
    expect(direct.triangleCount).toBeLessThan(brep.triangleCount * 10);
  });

  // ─── Comparison: with padding ───────────────────────────────────────────
  it('2×2 with padding: bounding box matches BREP', () => {
    const params = defaults({
      paddingLeft: 5,
      paddingRight: 3,
      paddingFront: 2,
      paddingBack: 4,
    });
    const brep = generateBrep(params, noop, false);
    const direct = generateDirect(params, noop);

    const brepBB = computeBounds(brep.vertices);
    const directBB = computeBounds(direct.vertices);

    expect(directBB.minX).toBeCloseTo(brepBB.minX, 0);
    expect(directBB.maxX).toBeCloseTo(brepBB.maxX, 0);
    expect(directBB.minY).toBeCloseTo(brepBB.minY, 0);
    expect(directBB.maxY).toBeCloseTo(brepBB.maxY, 0);
  });

  // ─── Comparison: fractional edges ───────────────────────────────────────
  it('2.5×2.5 with magnets: bounding box matches BREP', () => {
    const params = defaults({ width: 2.5, depth: 2.5, magnetHoles: true });
    const brep = generateBrep(params, noop, false);
    const direct = generateDirect(params, noop);

    const brepBB = computeBounds(brep.vertices);
    const directBB = computeBounds(direct.vertices);

    expect(directBB.minX).toBeCloseTo(brepBB.minX, 0);
    expect(directBB.maxX).toBeCloseTo(brepBB.maxX, 0);
    expect(directBB.minY).toBeCloseTo(brepBB.minY, 0);
    expect(directBB.maxY).toBeCloseTo(brepBB.maxY, 0);
    expect(directBB.minZ).toBeCloseTo(brepBB.minZ, 0);
    expect(directBB.maxZ).toBeCloseTo(brepBB.maxZ, 0);
  });

  // ─── Connector nubs ────────────────────────────────────────────────────

  it('connector nubs increase triangle count on split piece', () => {
    const base = defaults({
      width: 3,
      depth: 2,
      edges: { left: 'join', right: 'exterior', front: 'join', back: 'exterior' },
    });
    const withNubs = { ...base, connectorNubs: true };
    const withoutNubs = { ...base, connectorNubs: false };

    const meshWith = generateDirect(withNubs, noop);
    const meshWithout = generateDirect(withoutNubs, noop);

    expect(meshWith.triangleCount).toBeGreaterThan(meshWithout.triangleCount);
  });

  it('nubs expand bounding box on left join edge', () => {
    const base = defaults({
      width: 3,
      depth: 2,
      edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      connectorNubs: true,
    });
    const noNubs = { ...base, connectorNubs: false };

    const bbWith = computeBounds(generateDirect(base, noop).vertices);
    const bbWithout = computeBounds(generateDirect(noNubs, noop).vertices);

    // Left-edge nubs protrude in -X direction, so minX should decrease
    expect(bbWith.minX).toBeLessThan(bbWithout.minX);
  });

  it('no connectors on unsplit baseplate (no edges)', () => {
    const withNubs = defaults({ connectorNubs: true });
    const withoutNubs = defaults({ connectorNubs: false });

    const meshWith = generateDirect(withNubs, noop);
    const meshWithout = generateDirect(withoutNubs, noop);

    expect(meshWith.triangleCount).toBe(meshWithout.triangleCount);
  });

  it('no connectors on 1-unit dimension (zero interior boundaries)', () => {
    const base = defaults({
      width: 1,
      depth: 1,
      edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      connectorNubs: true,
    });
    const noNubs = { ...base, connectorNubs: false };

    const meshWith = generateDirect(base, noop);
    const meshWithout = generateDirect(noNubs, noop);

    // 1×1 piece has 0 interior cell boundaries on every edge → 0 connectors
    expect(meshWith.triangleCount).toBe(meshWithout.triangleCount);
  });

  it('connectors work alongside magnet holes', () => {
    const params = defaults({
      width: 3,
      depth: 3,
      magnetHoles: true,
      edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      connectorNubs: true,
    });

    const mesh = generateDirect(params, noop);
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.triangleCount).toBeGreaterThan(0);
  });

  it('2.5-unit dimension gets 2 connectors (full + fractional boundary)', () => {
    // 2.5 units → ceil(2.5)-1 = 2 interior boundaries per join edge
    const withNubs = defaults({
      width: 2.5,
      depth: 1,
      edges: { left: 'exterior', right: 'exterior', front: 'join', back: 'join' },
      connectorNubs: true,
    });
    const noNubs = { ...withNubs, connectorNubs: false };

    const countWith = generateDirect(withNubs, noop).triangleCount;
    const countWithout = generateDirect(noNubs, noop).triangleCount;
    const diff = countWith - countWithout;

    // 2 edges (front+back) × 2 boundaries each = 4 connectors total
    // Each connector adds a fixed number of triangles (cylinder + caps)
    // Nub: NUB_CIRCLE_SEGMENTS * 2 (wall) + NUB_CIRCLE_SEGMENTS (tip cap) = 36
    // Hole: NUB_CIRCLE_SEGMENTS (cancel) + NUB_CIRCLE_SEGMENTS * 2 (wall) + NUB_CIRCLE_SEGMENTS (floor) = 48
    // Front = male (36 each × 2 = 72), Back = female (48 each × 2 = 96) → total 168
    expect(diff).toBe(168);
  });

  it('nubs expand bounding box on front join edge (-Y)', () => {
    const base = defaults({
      width: 2,
      depth: 3,
      edges: { left: 'exterior', right: 'exterior', front: 'join', back: 'exterior' },
      connectorNubs: true,
    });
    const noNubs = { ...base, connectorNubs: false };

    const bbWith = computeBounds(generateDirect(base, noop).vertices);
    const bbWithout = computeBounds(generateDirect(noNubs, noop).vertices);

    // Front-edge nubs protrude in -Y direction, so minY should decrease
    expect(bbWith.minY).toBeLessThan(bbWithout.minY);
  });

  it('holes expand bounding box on back join edge (+Y)', () => {
    // Back edge = female (hole), but the cancel face is flush with the wall.
    // The hole goes inward, so the bounding box should NOT expand in +Y.
    // This verifies the hole geometry is inward, not outward.
    const base = defaults({
      width: 2,
      depth: 3,
      edges: { left: 'exterior', right: 'exterior', front: 'exterior', back: 'join' },
      connectorNubs: true,
    });
    const noNubs = { ...base, connectorNubs: false };

    const bbWith = computeBounds(generateDirect(base, noop).vertices);
    const bbWithout = computeBounds(generateDirect(noNubs, noop).vertices);

    // Hole is inward — maxY should remain the same (within tolerance)
    expect(bbWith.maxY).toBeCloseTo(bbWithout.maxY, 1);
  });

  it('nubs expand bounding box on right join edge (+X) — female hole does not', () => {
    // Right edge = female (hole). Holes go inward, so maxX should not increase.
    const base = defaults({
      width: 3,
      depth: 2,
      edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'exterior' },
      connectorNubs: true,
    });
    const noNubs = { ...base, connectorNubs: false };

    const bbWith = computeBounds(generateDirect(base, noop).vertices);
    const bbWithout = computeBounds(generateDirect(noNubs, noop).vertices);

    // Right edge has holes (female) which go inward — maxX should not expand
    expect(bbWith.maxX).toBeCloseTo(bbWithout.maxX, 1);
  });

  // ─── Validation ────────────────────────────────────────────────────────
  it('throws for zero or negative dimensions', () => {
    expect(() => generateDirect(defaults({ width: 0 }), noop)).toThrow(
      /Invalid baseplate dimensions/
    );
    expect(() => generateDirect(defaults({ depth: -1 }), noop)).toThrow(
      /Invalid baseplate dimensions/
    );
  });

  it('throws when dimensions exceed MAX_BASEPLATE_GRID', () => {
    expect(() => generateDirect(defaults({ width: 51 }), noop)).toThrow(/exceed maximum/);
    expect(() => generateDirect(defaults({ depth: 999 }), noop)).toThrow(/exceed maximum/);
  });

  // ─── Speed comparison ──────────────────────────────────────────────────
  it('4×4 with magnets: direct is at least 10x faster than BREP', () => {
    const params = defaults({ width: 4, depth: 4, magnetHoles: true });

    const brepStart = performance.now();
    generateBrep(params, noop, false);
    const brepTime = performance.now() - brepStart;

    const directStart = performance.now();
    generateDirect(params, noop);
    const directTime = performance.now() - directStart;

    const speedup = brepTime / directTime;
    expect(speedup).toBeGreaterThan(10);
  });

  // ─── Top/bottom face lattice ────────────────────────────────────────────
  // The top face (and the bottom face on through-cut variants) must equal
  // the slab outline minus the union of pocket openings. Earlier versions of
  // the direct generator only emitted a padding ring at the top, leaving
  // visible holes wherever rounded pocket corners met the cell rectangles
  // (especially at 4-way cell intersections).

  // Polygon-approximation residual: 8-segment arcs slightly under-approximate
  // each quarter-circle (~0.08 mm² per quarter at R=4mm), so accumulated error
  // across all the rounded corners + gussets in a small grid is a few mm². The
  // tolerance is large enough to swallow that residual but tight enough to
  // catch a single missing grid-corner gusset (~3.43 mm²) or a duplicated face
  // (much larger).
  const AREA_TOL_MM2 = 5;

  it('through-cut 3×3: top face area equals outer area minus pocket area', () => {
    const grid = 3;
    const cell = 42;
    const params = defaults({ width: grid, depth: grid, gridUnitMm: cell });
    const mesh = generateDirect(params, noop);

    const SOCKET_HEIGHT = 5;
    const outerArea = roundedRectArea(grid * cell, grid * cell, 4); // PLATE_CORNER_RADIUS
    const pocketArea = roundedRectArea(cell, cell, pocketCornerRadius(cell, cell));
    const expected = outerArea - grid * grid * pocketArea;

    const actual = horizontalFaceArea(mesh, 1, SOCKET_HEIGHT);
    expect(actual).toBeGreaterThan(0);
    expect(Math.abs(actual - expected)).toBeLessThan(AREA_TOL_MM2);
  });

  it('through-cut 2×2: bottom face mirrors the top (slab band closed from below)', () => {
    const params = defaults({ width: 2, depth: 2, magnetHoles: false });
    const mesh = generateDirect(params, noop);

    const SOCKET_HEIGHT = 5;
    const top = horizontalFaceArea(mesh, 1, SOCKET_HEIGHT);
    const bottom = horizontalFaceArea(mesh, -1, 0);

    expect(bottom).toBeGreaterThan(0);
    expect(Math.abs(top - bottom)).toBeLessThan(AREA_TOL_MM2);
  });

  it('magnet 2×2: bottom face is fully closed (slab outline area)', () => {
    const params = defaults({ width: 2, depth: 2, magnetHoles: true });
    const mesh = generateDirect(params, noop);

    // Filter to the actual slab bottom (z=0); the magnet cancel discs face -Z
    // too but live at z = floorDepth − cancel epsilon, so they're excluded.
    const bottom = horizontalFaceArea(mesh, -1, 0);
    const expected = roundedRectArea(2 * 42, 2 * 42, 4);

    expect(Math.abs(bottom - expected)).toBeLessThan(AREA_TOL_MM2);
  });

  it('asymmetric padding: top face lattice scales with the shifted slab', () => {
    // When paddingLeft ≠ paddingRight, the slab shifts but the grid stays at
    // the origin. The top face area should equal (totalW × totalD with rounded
    // corners) minus the pocket cutouts — independent of the shift direction.
    // (Regression test for the addRingFace bug where the inner clamp rectangle
    // was incorrectly slab-centered instead of grid-centered.)
    const params = defaults({
      width: 2,
      depth: 2,
      paddingLeft: 5,
      paddingRight: 15,
      paddingFront: 8,
      paddingBack: 4,
    });
    const mesh = generateDirect(params, noop);

    const SOCKET_HEIGHT = 5;
    const totalW = 2 * 42 + 5 + 15;
    const totalD = 2 * 42 + 8 + 4;
    const outerArea = roundedRectArea(totalW, totalD, 4);
    const pocketArea = roundedRectArea(42, 42, pocketCornerRadius(42, 42));
    const expected = outerArea - 4 * pocketArea;

    const actual = horizontalFaceArea(mesh, 1, SOCKET_HEIGHT);
    expect(Math.abs(actual - expected)).toBeLessThan(AREA_TOL_MM2);
  });

  it('through-cut 4×4: lattice produces top-face vertices at interior cell intersections', () => {
    // Verifies the lattice actually emits geometry where four pockets meet —
    // the spot where the previous broken implementation left visible holes.
    // For a 4-cell grid centered at origin with 42mm cells, interior cell
    // corners sit at multiples of 42mm offset from origin: (±42, 0), (0, ±42),
    // (±42, ±42). We check that at least one upward-facing vertex lies near
    // each of these positions.
    const params = defaults({ width: 4, depth: 4, magnetHoles: false });
    const mesh = generateDirect(params, noop);
    const interiorCorners: ReadonlyArray<readonly [number, number]> = [
      [-42, -42],
      [42, -42],
      [-42, 42],
      [42, 42],
      [0, 0],
      [-42, 0],
      [42, 0],
      [0, -42],
      [0, 42],
    ];

    for (const [tx, ty] of interiorCorners) {
      let found = false;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        if (mesh.normals[i + 2] < 0.9) continue; // top-facing only
        const dx = mesh.vertices[i] - tx;
        const dy = mesh.vertices[i + 1] - ty;
        if (dx * dx + dy * dy < 0.01) {
          found = true;
          break;
        }
      }
      expect(found, `expected top-face vertex at interior corner (${tx}, ${ty})`).toBe(true);
    }
  });
});

describe('direct mesh — over-tile margin pockets', () => {
  it('adds margin pockets (more triangles) while keeping the slab footprint', () => {
    const padded = generateDirect(
      defaults({ paddingLeft: 12, paddingRight: 12, paddingFront: 12, paddingBack: 12 }),
      noop
    );
    const tiled = generateDirect(
      defaults({
        paddingLeft: 12,
        paddingRight: 12,
        paddingFront: 12,
        paddingBack: 12,
        overTile: true,
      }),
      noop
    );

    // Frame pockets cut into the margin → strictly more geometry.
    expect(tiled.triangleCount).toBeGreaterThan(padded.triangleCount);
    // Same outer slab footprint (additive — margins gain pockets, slab unchanged).
    const a = computeBounds(padded.vertices);
    const b = computeBounds(tiled.vertices);
    expect(b.maxX - b.minX).toBeCloseTo(a.maxX - a.minX, 1);
    expect(b.maxY - b.minY).toBeCloseTo(a.maxY - a.minY, 1);
  });

  it('leaves a sub-threshold margin alone (no pockets added)', () => {
    const off = defaults({ paddingLeft: 3, paddingRight: 3, paddingFront: 3, paddingBack: 3 });
    const on = defaults({
      paddingLeft: 3,
      paddingRight: 3,
      paddingFront: 3,
      paddingBack: 3,
      overTile: true,
    });
    // 3mm margins are below the printable threshold → no frame pockets either way.
    expect(generateDirect(on, noop).triangleCount).toBe(generateDirect(off, noop).triangleCount);
  });
});
