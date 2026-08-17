/**
 * Reusable mesh assertion helpers for bin generation tests.
 */
import { expect } from 'vitest';
import type { MeshData } from '@/features/generation/bridge/types';
import type { BinParams } from '@/shared/types/bin';
import { GRIDFINITY } from '@/shared/constants/bin';
import type { SplitPreviewResult } from './wasmInit';

// ─── Structural validity ─────────────────────────────────────────────────────

/**
 * Assert the kernel returned geometry at all.
 *
 * An empty mesh is categorically different from wrong geometry: no generator
 * path produces zero triangles as an *answer*, so a zero means the kernel
 * yielded nothing — a WASM init or allocation failure, characteristically under
 * memory pressure from concurrent builds. Bare `toBeGreaterThan(0)` reports
 * that as "expected +0 to be greater than +0", which reads as a geometry defect
 * and sent to a bisect for a regression that was never there. The message
 * names the failure class instead, so the next zero is diagnosed rather than
 * investigated.
 */
export function assertKernelReturnedGeometry(result: MeshData, label?: string): void {
  const where = label ? ` (${label})` : '';
  const why =
    `An empty result is a generation failure, not a geometry change. Usually ` +
    `WASM init/allocation failing under memory pressure; re-run this file alone ` +
    `before treating it as a regression.`;
  // Each half states what was actually observed. A shared message would report
  // "0 triangles" for the count-without-buffers case below, which is the same
  // misdiagnosis this helper exists to prevent.
  expect(
    result.triangleCount,
    `kernel returned an EMPTY mesh${where} — no triangles. ${why}`
  ).toBeGreaterThan(0);
  expect(
    result.vertices.length,
    `kernel returned an EMPTY mesh${where} — ${result.triangleCount} triangles but ` +
      `no vertex data. ${why}`
  ).toBeGreaterThan(0);
}

/** Assert a MeshData result has valid structure: vertices > 0, normals match, indices consistent, no NaN. */
export function assertStructurallyValid(result: MeshData, label?: string): void {
  const prefix = label ? `${label}: ` : '';
  // Emptiness first: it has its own diagnosis, and every check below reads as
  // geometry drift when the real cause is that nothing was generated.
  assertKernelReturnedGeometry(result, label);
  expect(result.normals.length, `${prefix}normals should match vertices`).toBe(
    result.vertices.length
  );
  expect(result.indices.length, `${prefix}indices should match triangleCount`).toBe(
    result.triangleCount * 3
  );
  expect(hasNoNaNOrInfinity(result.vertices), `${prefix}vertices have NaN/Infinity`).toBe(true);
  expect(hasNoNaNOrInfinity(result.normals), `${prefix}normals have NaN/Infinity`).toBe(true);
}

// ─── NaN / Infinity ──────────────────────────────────────────────────────────

/** Returns true if the Float32Array contains no NaN or Infinity values. */
export function hasNoNaNOrInfinity(arr: Float32Array): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) return false;
  }
  return true;
}

// ─── Enclosed volume ─────────────────────────────────────────────────────────

/**
 * Enclosed volume (mm³) of a triangle mesh, via the signed-tetrahedron sum.
 *
 * The measure of choice for "did this feature remove material?": occt-wasm
 * tessellation is not bit-reproducible across CPUs, so triangle counts drift
 * where removed volume does not.
 *
 * Throws on a ragged index buffer or an out-of-range vertex rather than reading
 * the missing value as 0 — a corrupted mesh would otherwise still sum to a
 * plausible finite volume and quietly pass the assertions built on top of this.
 */
export function meshVolume({ vertices, indices }: MeshData): number {
  let volume = 0;
  const vertexIndex = (i: number): number => {
    const value = indices[i];
    if (value === undefined) {
      throw new Error(`meshVolume: index buffer length ${indices.length} is not a multiple of 3`);
    }
    return value;
  };
  const at = (index: number, axis: number): number => {
    const value = vertices[index * 3 + axis];
    if (value === undefined) {
      throw new Error(`meshVolume: vertex index ${index} is out of range`);
    }
    return value;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const a = vertexIndex(i);
    const b = vertexIndex(i + 1);
    const c = vertexIndex(i + 2);
    const ax = at(a, 0);
    const ay = at(a, 1);
    const az = at(a, 2);
    const bx = at(b, 0);
    const by = at(b, 1);
    const bz = at(b, 2);
    const cx = at(c, 0);
    const cy = at(c, 1);
    const cz = at(c, 2);
    volume += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(volume) / 6;
}

/**
 * Enclosed volume (mm³) of a triangle SOUP — no index buffer, every 9 floats
 * one triangle.
 *
 * The layout `parseSTLBinary` hands back, which is the honest volume signal for
 * a differential: the preview mesh is not watertight (the base socket rides
 * unfused), so only the export can be measured. Separate from {@link meshVolume}
 * rather than fed an identity index buffer so a caller cannot accidentally pass
 * a soup where an indexed mesh is meant and get a silently wrong answer.
 */
export function stlSolidVolume(vertices: Float32Array): number {
  let sixVol = 0;
  for (let i = 0; i + 8 < vertices.length; i += 9) {
    const ax = vertices[i];
    const ay = vertices[i + 1];
    const az = vertices[i + 2];
    const bx = vertices[i + 3];
    const by = vertices[i + 4];
    const bz = vertices[i + 5];
    const cx = vertices[i + 6];
    const cy = vertices[i + 7];
    const cz = vertices[i + 8];
    sixVol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(sixVol) / 6;
}

// ─── Watertightness (hole-free) ──────────────────────────────────────────────

export interface MeshTopologyStats {
  /** Edges used by exactly one triangle — a mesh is hole-free iff this is 0. */
  boundaryEdges: number;
  /** Edges shared by more than two triangles (non-manifold junctions). */
  nonManifoldEdges: number;
  /**
   * V − E + F over the welded mesh. A closed genus-0 shell reads 2 and each
   * handle subtracts 2 — so this is the only cheap signal for "a boolean
   * punched a passage clean through a wall", which `boundaryEdges` cannot see
   * (a breached wall is still a closed surface).
   */
  eulerCharacteristic: number;
}

/**
 * Weld vertices by quantized position and count boundary / non-manifold edges.
 *
 * Welding by position (not index) is required: the kernel tessellates each face
 * independently, so a closed solid still has coincident-but-distinct vertices
 * along every shared edge. Quantizing to 1e-4 mm collapses those so a genuinely
 * closed surface reports zero boundary edges. Mirrors the `analyze()` topology
 * pass in the binGenerator.export.<domain>.test.ts matrix, which asserts the same
 * invariant over every exported scenario.
 */
export function meshTopologyStats({ vertices, indices }: MeshData): MeshTopologyStats {
  const QUANTIZE = 1e4;
  const vKey = (i: number): string => {
    const b = i * 3;
    return `${Math.round(vertices[b] * QUANTIZE)},${Math.round(vertices[b + 1] * QUANTIZE)},${Math.round(vertices[b + 2] * QUANTIZE)}`;
  };
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  const weldedVertices = new Set<string>();
  let faces = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const k = [vKey(indices[i]), vKey(indices[i + 1]), vKey(indices[i + 2])];
    // A tessellation seam can collapse a triangle to a sliver whose three welded
    // corners are not distinct; it contributes no face or edges to the topology.
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue;
    faces++;
    for (const key of k) weldedVertices.add(key);
    for (let e = 0; e < 3; e++) {
      const key = eKey(k[e], k[(e + 1) % 3]);
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeCount.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }
  return {
    boundaryEdges,
    nonManifoldEdges,
    eulerCharacteristic: weldedVertices.size - edgeCount.size + faces,
  };
}

/**
 * Assert a mesh is hole-free (watertight): every edge is shared by ≥2 triangles.
 *
 * The definitive "the shell didn't split apart" check. A severed wall/corner
 * pillar opens the shell, producing boundary edges.
 */
export function assertWatertight(result: MeshData, label?: string): void {
  const prefix = label ? `${label}: ` : '';
  const { boundaryEdges } = meshTopologyStats(result);
  expect(boundaryEdges, `${prefix}mesh has ${boundaryEdges} boundary edges (not watertight)`).toBe(
    0
  );
}

// ─── Vertical sampling ───────────────────────────────────────────────────────

/**
 * Z intervals where a vertical ray at `(x, y)` is inside the solid, bottom-up.
 *
 * Empty when the ray misses the mesh entirely — which is exactly how a hole in a
 * floor reads. Use on an EXPORT mesh: the preview path meshes the base socket
 * separately and concatenates it, so the coincident socket-top/floor-bottom
 * faces survive and break the enter/exit pairing.
 *
 * Avoid sampling on a face plane (a ray along a shared triangle edge is counted
 * by both neighbours); pick a point inside the region you mean to test.
 */
export function verticalSolidSpans(
  mesh: MeshData,
  x: number,
  y: number
): Array<readonly [number, number]> {
  const crossings = columnCrossings(mesh, x, y);
  const spans: Array<readonly [number, number]> = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    spans.push([crossings[i], crossings[i + 1]] as const);
  }
  return spans;
}

/**
 * Sorted Z values where a vertical ray at `(x, y)` crosses the surface.
 *
 * Parity-free, which {@link verticalSolidSpans} is not: an odd crossing count —
 * what a coincident face leaves behind — pairs every interval above it into the
 * void instead of the solid, and reads a lower surface as an upper one. The
 * first and last entries are the lowest and highest surface over that column
 * whatever happens in between, so a check that only needs the outermost faces
 * should measure them here.
 */
export function columnCrossings({ vertices, indices }: MeshData, x: number, y: number): number[] {
  const hits: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ax = vertices[a];
    const ay = vertices[a + 1];
    const bx = vertices[b];
    const by = vertices[b + 1];
    const cx = vertices[c];
    const cy = vertices[c + 1];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-12) continue;
    const w0 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det;
    const w1 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det;
    const w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    hits.push(w0 * vertices[a + 2] + w1 * vertices[b + 2] + w2 * vertices[c + 2]);
  }
  hits.sort((p, q) => p - q);
  // Collapse coincident crossings before pairing. A ray that passes exactly
  // along a shared triangle edge — or through a vertex — is counted once per
  // incident triangle, and the surplus hits flip the enter/exit parity for
  // everything above them. Planar faces are fan-triangulated from the footprint
  // centre, so the axes of a bin are full of such edges.
  const crossings: number[] = [];
  for (const hit of hits) {
    if (crossings.length === 0 || Math.abs(hit - crossings[crossings.length - 1]) > 1e-4) {
      crossings.push(hit);
    }
  }
  return crossings;
}

/** True when a vertical ray at `(x, y)` is solid across the whole `[lo, hi]` band. */
export function isSolidThrough(
  result: MeshData,
  x: number,
  y: number,
  lo: number,
  hi: number,
  tolerance = 0.01
): boolean {
  return verticalSolidSpans(result, x, y).some(
    ([from, to]) => from <= lo + tolerance && to >= hi - tolerance
  );
}

/**
 * Widest |X| the surface reaches on the plane Z — the outer profile at that
 * height. Slices triangle edges rather than sampling vertices: a ruled loft only
 * carries vertices on its section planes, so vertex sampling reads 0 between them.
 */
export function sectionHalfWidth({ vertices, indices }: MeshData, z: number): number {
  let max = 0;
  const edge = (a: number, b: number): void => {
    const za = vertices[a + 2];
    const zb = vertices[b + 2];
    if (za === zb || z < Math.min(za, zb) || z > Math.max(za, zb)) return;
    const t = (z - za) / (zb - za);
    max = Math.max(max, Math.abs(vertices[a] + t * (vertices[b] - vertices[a])));
  };
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  return max;
}

// ─── Bounding box ────────────────────────────────────────────────────────────

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function boundingBox(vertices: Float32Array): BoundingBox {
  const bb: BoundingBox = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (let i = 0; i < vertices.length; i += 3) {
    bb.minX = Math.min(bb.minX, vertices[i]);
    bb.maxX = Math.max(bb.maxX, vertices[i]);
    bb.minY = Math.min(bb.minY, vertices[i + 1]);
    bb.maxY = Math.max(bb.maxY, vertices[i + 1]);
    bb.minZ = Math.min(bb.minZ, vertices[i + 2]);
    bb.maxZ = Math.max(bb.maxZ, vertices[i + 2]);
  }
  return bb;
}

// ─── Range assertion ─────────────────────────────────────────────────────────

/** Assert that `actual` is within `expected ± tolerance`. */
function assertInRange(actual: number, expected: number, tolerance: number, label: string): void {
  const lo = expected - tolerance;
  const hi = expected + tolerance;
  const msg = `${label} ${actual} outside [${lo}, ${hi}]`;
  expect(actual, msg).toBeGreaterThanOrEqual(lo);
  expect(actual, msg).toBeLessThanOrEqual(hi);
}

// ─── Bounding box vs params ──────────────────────────────────────────────────

/** Assert mesh AABB matches expected grid dimensions within tolerance. */
export function assertBoundingBoxMatchesParams(
  result: MeshData,
  params: BinParams,
  label?: string
): void {
  const prefix = label ? `${label}: ` : '';
  const bb = boundingBox(result.vertices);

  const expectedW = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const expectedD = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const expectedH = params.height * params.heightUnitMm;

  assertInRange(bb.maxX - bb.minX, expectedW, 3, `${prefix}width`);
  assertInRange(bb.maxY - bb.minY, expectedD, 3, `${prefix}depth`);
  assertInRange(bb.maxZ - bb.minZ, expectedH, 5, `${prefix}height`);
}

// ─── Triangle count band ────────────────────────────────────────────────────

/** Assert triangle count is within ±tolerancePct% of expected. */
export function assertTriangleCountInBand(
  result: MeshData,
  expected: number,
  tolerancePct = 15,
  label?: string
): void {
  const prefix = label ? `${label}: ` : '';
  const min = Math.floor(expected * (1 - tolerancePct / 100));
  const max = Math.ceil(expected * (1 + tolerancePct / 100));

  expect(
    result.triangleCount,
    `${prefix}triangleCount ${result.triangleCount} outside expected range [${min}, ${max}] (expected ~${expected} ±${tolerancePct}%)`
  ).toBeGreaterThanOrEqual(min);
  expect(
    result.triangleCount,
    `${prefix}triangleCount ${result.triangleCount} outside expected range [${min}, ${max}] (expected ~${expected} ±${tolerancePct}%)`
  ).toBeLessThanOrEqual(max);
}

// ─── Degenerate triangle detection ──────────────────────────────────────────

/** Assert no zero-area triangles exist (collapsed vertices). */
export function assertNoDegenerateTriangles(result: MeshData, label?: string): void {
  const prefix = label ? `${label}: ` : '';
  const { vertices, indices } = result;
  let degenerateCount = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    // Edge vectors: e1 = v1 - v0, e2 = v2 - v0
    const e1x = vertices[i1] - vertices[i0];
    const e1y = vertices[i1 + 1] - vertices[i0 + 1];
    const e1z = vertices[i1 + 2] - vertices[i0 + 2];

    const e2x = vertices[i2] - vertices[i0];
    const e2y = vertices[i2 + 1] - vertices[i0 + 1];
    const e2z = vertices[i2 + 2] - vertices[i0 + 2];

    // Cross product
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;

    const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);

    if (area < 1e-10) {
      degenerateCount++;
    }
  }

  expect(
    degenerateCount,
    `${prefix}found ${degenerateCount} degenerate (zero-area) triangles`
  ).toBe(0);
}

// ─── Lip-wall vertex zone counting ──────────────────────────────────────────

interface WallVertexCounts {
  left: number;
  right: number;
  front: number;
  back: number;
  maxZ: number;
}

/**
 * Count vertices near each outer wall face within a Z-band.
 * Used by lip-wall regression tests.
 */
export function countWallVerticesInZone(
  mesh: MeshData,
  outerW: number,
  outerD: number,
  zMin: number,
  zMax: number,
  proximity: number
): WallVertexCounts {
  let left = 0;
  let right = 0;
  let front = 0;
  let back = 0;
  let maxZ = -Infinity;

  for (let i = 0; i < mesh.vertices.length; i += 3) {
    const x = mesh.vertices[i];
    const y = mesh.vertices[i + 1];
    const z = mesh.vertices[i + 2];

    if (z > maxZ) maxZ = z;
    if (z < zMin || z > zMax) continue;

    if (Math.abs(x - -outerW / 2) < proximity) left++;
    if (Math.abs(x - outerW / 2) < proximity) right++;
    if (Math.abs(y - -outerD / 2) < proximity) front++;
    if (Math.abs(y - outerD / 2) < proximity) back++;
  }

  return { left, right, front, back, maxZ };
}

// ─── Split piece validation ─────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;

/**
 * Assert that a split result is geometrically valid.
 * Checks piece count, vertex sanity, and bounding box dimensions.
 */
export function assertValidSplit(
  result: SplitPreviewResult,
  expectedPieces: number,
  params: BinParams,
  label: string
): void {
  expect(result.pieces, `${label}: piece count`).toHaveLength(expectedPieces);

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;

  // Tolerance accounts for EDGE_MARGIN (1mm per outer edge = up to +2mm),
  // lip overhang (~0.04mm), and tessellation tolerance.
  const dimTolerance = 3;

  for (const piece of result.pieces) {
    expect(
      hasNoNaNOrInfinity(piece.vertices),
      `${label}: piece ${piece.label} has NaN/Infinity`
    ).toBe(true);
    expect(
      piece.vertices.length,
      `${label}: piece ${piece.label} has degenerate geometry (${piece.vertices.length} verts)`
    ).toBeGreaterThan(100);
    expect(piece.indices.length, `${label}: piece ${piece.label} has no faces`).toBeGreaterThan(0);

    const bb = boundingBox(piece.vertices);
    const pieceW = bb.maxX - bb.minX;
    const pieceD = bb.maxY - bb.minY;

    // Upper bound: no single piece should exceed the full bin dimension.
    // For multi-piece splits this is still a meaningful guard against
    // cut-plane failures that return near-full-width pieces.
    expect(pieceW, `${label}: piece ${piece.label} wider than bin`).toBeLessThan(
      outerW + dimTolerance
    );
    expect(pieceD, `${label}: piece ${piece.label} deeper than bin`).toBeLessThan(
      outerD + dimTolerance
    );

    // Lower bound: each piece should be at least ~(1/expectedPieces) of the
    // full dimension minus tolerance for connectors and tessellation.
    const minFractionW = outerW / expectedPieces - dimTolerance;
    const minFractionD = outerD / expectedPieces - dimTolerance;
    if (minFractionW > 1) {
      expect(pieceW, `${label}: piece ${piece.label} too narrow for split`).toBeGreaterThan(
        minFractionW
      );
    }
    if (minFractionD > 1) {
      expect(pieceD, `${label}: piece ${piece.label} too shallow for split`).toBeGreaterThan(
        minFractionD
      );
    }
    expect(pieceW, `${label}: piece ${piece.label} zero width`).toBeGreaterThan(1);
    expect(pieceD, `${label}: piece ${piece.label} zero depth`).toBeGreaterThan(1);
  }
}

// ─── Per-triangle geometry ───────────────────────────────────────────────────

/**
 * Normalized z-component of triangle (a, b, c)'s geometric normal, from a flat
 * vertex buffer indexed by vertex number. Floor faces read ≈±1, walls ≈0.
 */
export function triangleNormalZ(
  vertices: ArrayLike<number>,
  a: number,
  b: number,
  c: number
): number {
  const ux = vertices[b * 3] - vertices[a * 3];
  const uy = vertices[b * 3 + 1] - vertices[a * 3 + 1];
  const uz = vertices[b * 3 + 2] - vertices[a * 3 + 2];
  const vx = vertices[c * 3] - vertices[a * 3];
  const vy = vertices[c * 3 + 1] - vertices[a * 3 + 1];
  const vz = vertices[c * 3 + 2] - vertices[a * 3 + 2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return nz / (Math.hypot(nx, ny, nz) || 1);
}

/** Area of triangle (a, b, c), from a flat vertex buffer indexed by vertex number. */
export function triangleArea(vertices: ArrayLike<number>, a: number, b: number, c: number): number {
  const ux = vertices[b * 3] - vertices[a * 3];
  const uy = vertices[b * 3 + 1] - vertices[a * 3 + 1];
  const uz = vertices[b * 3 + 2] - vertices[a * 3 + 2];
  const vx = vertices[c * 3] - vertices[a * 3];
  const vy = vertices[c * 3 + 1] - vertices[a * 3 + 1];
  const vz = vertices[c * 3 + 2] - vertices[a * 3 + 2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return Math.hypot(nx, ny, nz) / 2;
}
