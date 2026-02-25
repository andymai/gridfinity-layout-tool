// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';

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
  it('generates 8×8 mesh in under 50ms', () => {
    const start = performance.now();
    const mesh = generateDirect(defaults({ width: 8, depth: 8, magnetHoles: true }), noop);
    const elapsed = performance.now() - start;
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
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
});
