// @vitest-environment node
/**
 * Regression test for issue #1472 — Bambu Studio reported ~2138 "non-manifold
 * edges" on every baseplate export. The root cause was the previous
 * `buildBaseplateSTL` winding-correction heuristic: it flipped a triangle's
 * winding whenever (cross · sum-of-vertex-normals) < 0. brepjs already
 * tessellates faces with winding consistent with each face's BREP
 * orientation, but along curved/shared edges its vertex normals are
 * averaged across adjacent faces, so the heuristic mis-fired on ~7% of
 * triangles and emitted them with reversed winding. Each reversed triangle
 * shows up in the slicer as a directed-edge collision (a→b appearing twice
 * in the same direction).
 *
 * This test verifies, on a representative slice of the user's exact
 * 19.5 × 9.5 split-baseplate-with-dovetails reproducer, that every directed
 * edge in the export appears at most once.
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

describe('baseplateGenerator — directed-edge winding (issue #1472)', () => {
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
});
