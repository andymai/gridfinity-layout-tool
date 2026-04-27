// @vitest-environment node
/**
 * Regression tests for two related winding-consistency bugs.
 *
 * #1472 — Bambu Studio reported ~2138 "non-manifold edges" on every
 * baseplate export. Root cause: a `buildBaseplateSTL` heuristic flipped
 * a triangle's winding whenever (cross · sum-of-vertex-normals) < 0.
 * brepjs returns averaged vertex normals at curved/shared edges, so the
 * heuristic mis-fired on ~7% of triangles. Removed in #1473.
 *
 * #1490 — Bambu Studio reported "non-manifold edges" on corner-3 and
 * corner-4 piece configs even after #1473. Root cause: brepjs/OCCT can
 * emit tessellated meshes whose face orientations aren't consistent
 * across the whole solid (entire bottom face wound backwards, ~32% of
 * triangles flagged). Fixed by a downstream BFS winding-repair pass in
 * `repairMeshWinding` (called from `buildBaseplateSTL`). The corner-3,
 * corner-4, and edge-x-1 cases below cover the piece roles that the
 * existing corner-1 / edge-y-1 / magnet cases didn't reach.
 *
 * Each test asserts directed-edge uniqueness; #1490-class tests also
 * assert positive signed volume to catch global mesh inversions that
 * directed-edge uniqueness alone wouldn't see.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__dual-kernel__/wasmInit';

type ExportFn = (
  params: BaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

let exportBaseplate: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateGenerator');
  exportBaseplate = mod.exportBaseplate;
}, 30000);

const defaults = (overrides: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 4.5,
  depth: 4.5,
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
  lightweight: true,
  ...overrides,
});

/**
 * Count directed edges (a→b) that appear more than once across all triangles.
 * In a closed orientable mesh each directed edge appears at most once;
 * duplicates indicate inconsistent triangle winding — which Bambu/Cura
 * surface as "non-manifold edges" and repair as solid infill.
 */
function countWindingErrors(stl: ArrayBuffer): number {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const verts = parsed.value.vertices;
  const triCount = verts.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const seen = new Set<string>();
  let dupes = 0;
  for (let t = 0; t < triCount; t++) {
    const b = t * 9;
    const a = vKey(verts[b], verts[b + 1], verts[b + 2]);
    const c = vKey(verts[b + 3], verts[b + 4], verts[b + 5]);
    const d = vKey(verts[b + 6], verts[b + 7], verts[b + 8]);
    for (const e of [`${a}->${c}`, `${c}->${d}`, `${d}->${a}`]) {
      if (seen.has(e)) dupes++;
      else seen.add(e);
    }
  }
  return dupes;
}

/**
 * Compute signed volume from the STL's flat vertex array. Positive volume
 * means the mesh is consistently outward-oriented; negative means the mesh
 * (or a dominant region) is inverted. A globally-flipped mesh can still
 * pass `countWindingErrors` (every directed edge stays unique), so this
 * is a complementary check.
 */
function signedVolume(stl: ArrayBuffer): number {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const verts = parsed.value.vertices;
  let vol = 0;
  for (let t = 0; t < verts.length; t += 9) {
    const ax = verts[t];
    const ay = verts[t + 1];
    const az = verts[t + 2];
    const bx = verts[t + 3];
    const by = verts[t + 4];
    const bz = verts[t + 5];
    const cx = verts[t + 6];
    const cy = verts[t + 7];
    const cz = verts[t + 8];
    vol += ax * (by * cz - bz * cy) + bx * (cy * az - cz * ay) + cx * (ay * bz - az * by);
  }
  return vol / 6;
}

describe('baseplateGenerator — directed-edge winding (issues #1472, #1490)', () => {
  const TEST_TIMEOUT_MS = 60_000;

  it(
    'corner-1 (4.5×4.5, paddingLeft=7, no magnets, dovetail grooves) — winding consistent',
    async () => {
      const params = defaults({
        width: 4.5,
        depth: 4.5,
        paddingLeft: 7,
        fractionalEdgeX: 'start',
        fractionalEdgeY: 'start',
        connectorNubs: true,
        edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expect(countWindingErrors(data)).toBe(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'edge-y-1 (5×4.5, dovetail tongues + grooves) — winding consistent',
    async () => {
      const params = defaults({
        width: 5,
        depth: 4.5,
        fractionalEdgeY: 'start',
        connectorNubs: true,
        edges: { left: 'join', right: 'join', front: 'exterior', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expect(countWindingErrors(data)).toBe(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'magnet baseplate with lightweight floor — winding consistent',
    async () => {
      // Cover the magnet-on path too: lightweight floor cutters introduce
      // many curved/shared edges where the old heuristic was most fragile.
      const params = defaults({
        width: 5,
        depth: 4,
        magnetHoles: true,
        connectorNubs: true,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expect(countWindingErrors(data)).toBe(0);
    },
    TEST_TIMEOUT_MS
  );

  // #1490: piece roles where brepjs/OCCT emits some faces with reversed
  // orientation. Mirror corner-1's fractional layout but for the other
  // three corner positions plus an edge-x slice.

  it(
    'corner-3 (4.5×4.5, paddingLeft+paddingBack=7, top-left of split) — winding consistent',
    async () => {
      const params = defaults({
        width: 4.5,
        depth: 4.5,
        paddingLeft: 7,
        paddingBack: 7,
        fractionalEdgeX: 'start',
        fractionalEdgeY: 'end',
        connectorNubs: true,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'exterior' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expect(countWindingErrors(data)).toBe(0);
      expect(signedVolume(data)).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'corner-4 (4.5×4.5, paddingRight+paddingBack=7, top-right of split) — winding consistent',
    async () => {
      const params = defaults({
        width: 4.5,
        depth: 4.5,
        paddingRight: 7,
        paddingBack: 7,
        fractionalEdgeX: 'end',
        fractionalEdgeY: 'end',
        connectorNubs: true,
        edges: { left: 'join', right: 'exterior', front: 'join', back: 'exterior' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expect(countWindingErrors(data)).toBe(0);
      expect(signedVolume(data)).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'edge-x-1 (4.5×5, paddingRight=7, right edge, dovetail tongues + grooves) — winding consistent',
    async () => {
      const params = defaults({
        width: 4.5,
        depth: 5,
        paddingRight: 7,
        fractionalEdgeX: 'end',
        connectorNubs: true,
        edges: { left: 'join', right: 'exterior', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expect(countWindingErrors(data)).toBe(0);
      expect(signedVolume(data)).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );
});
