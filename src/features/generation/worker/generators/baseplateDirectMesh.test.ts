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
