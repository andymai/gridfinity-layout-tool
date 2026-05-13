// @vitest-environment node
/**
 * Regression tests for issue #1407 — baseplates with dovetail connectors
 * exported as solid infill in slicers (Orca/Cura).
 *
 * Root cause: the male dovetail (tongue) shared only a degenerate coplanar
 * face with the slab's outer wall at the fuse step. OCCT's General Fuse
 * Algorithm produces ambiguous topology at such interfaces, which slicers
 * then "repair" into a solid block. The groove (female) already used
 * COPLANAR_MARGIN for the same reason; the tongue was missed.
 *
 * Fix: extend the tongue's base edge a small overlap INTO the slab so the
 * fuse has shared volume rather than a degenerate coplanar face. Mirrors
 * the SLOT_EXTENSION pattern in slotBuilder.ts.
 *
 * These tests verify the exported STL is watertight (no boundary edges,
 * every edge shared by exactly 2 triangles) for the tile configurations
 * that most stress the dovetail fuse path.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { TONGUE_PROTRUSION } from './generatorConstants';

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
  lightweight: true,
  ...overrides,
});

interface StlStats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Parse binary STL and confirm it's watertight and 2-manifold.
 *
 * A manifold mesh has every edge shared by exactly 2 triangles. Anything
 * else — boundary edges (count 1), T-junctions (count >2) — makes slicers
 * drop triangles during repair, producing the solid-infill effect. STL
 * coordinates are quantized to absorb float-32 tessellation noise.
 */
function analyzeManifold(stl: ArrayBuffer): StlStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const verts: Array<[number, number, number]> = [
      [vertices[base], vertices[base + 1], vertices[base + 2]],
      [vertices[base + 3], vertices[base + 4], vertices[base + 5]],
      [vertices[base + 6], vertices[base + 7], vertices[base + 8]],
    ];
    for (const [x, y] of verts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const keys = verts.map(([x, y, z]) => vKey(x, y, z));
    for (let i = 0; i < 3; i++) {
      const k = eKey(keys[i], keys[(i + 1) % 3]);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  }

  let nonManifoldEdges = 0;
  let boundaryEdges = 0;
  for (const count of edgeCount.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }
  return { triangleCount, nonManifoldEdges, boundaryEdges, bounds: { minX, maxX, minY, maxY } };
}

describe('baseplateGenerator — dovetail export (issue #1407)', () => {
  const GRID = 42;
  // Full tessellation + STL analysis can exceed the default 30s in shared CI.
  const TEST_TIMEOUT_MS = 60_000;

  function expectWatertight(stats: StlStats, label: string): void {
    expect(stats.nonManifoldEdges, `${label}: non-manifold edges`).toBe(0);
    expect(stats.boundaryEdges, `${label}: boundary edges`).toBe(0);
  }

  it(
    'middle-column tile (3 join edges) exports a watertight STL with protruding tongue',
    async () => {
      // User's scenario: 298×636mm baseplate splits into 2×3. The A2 tile has
      // 3 join edges (right, front, back) and one exterior edge (left).
      const params = defaults({
        width: 5,
        depth: 4,
        connectorNubs: true,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyzeManifold(data);
      expectWatertight(stats, '5×4 middle-column');

      // Tongue on the front edge protrudes in -Y. When the fuse silently drops
      // the tongue (the bug's failure mode), the bounding box collapses to the
      // slab extent.
      const halfD = (4 * GRID) / 2;
      expect(stats.bounds.minY).toBeLessThanOrEqual(-halfD - TONGUE_PROTRUSION + 0.1);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'interior tile (4 join edges) exports a watertight STL',
    async () => {
      const params = defaults({
        width: 4,
        depth: 4,
        connectorNubs: true,
        edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyzeManifold(data);
      expectWatertight(stats, '4×4 interior');

      const halfW = (4 * GRID) / 2;
      const halfD = (4 * GRID) / 2;
      expect(stats.bounds.minX).toBeLessThanOrEqual(-halfW - TONGUE_PROTRUSION + 0.1);
      expect(stats.bounds.minY).toBeLessThanOrEqual(-halfD - TONGUE_PROTRUSION + 0.1);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'inverted-dovetail middle-column tile exports a watertight STL',
    async () => {
      // invertDovetails swaps tongue/groove assignment — the fix must hold for
      // both orientations.
      const params = defaults({
        width: 5,
        depth: 4,
        connectorNubs: true,
        invertDovetails: true,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyzeManifold(data);
      expectWatertight(stats, '5×4 inverted');

      const halfW = (5 * GRID) / 2;
      const halfD = (4 * GRID) / 2;
      expect(stats.bounds.maxX).toBeGreaterThanOrEqual(halfW + TONGUE_PROTRUSION - 0.1);
      expect(stats.bounds.maxY).toBeGreaterThanOrEqual(halfD + TONGUE_PROTRUSION - 0.1);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'magnet-hole variant of middle tile exports a watertight STL',
    async () => {
      const params = defaults({
        width: 5,
        depth: 4,
        magnetHoles: true,
        connectorNubs: true,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyzeManifold(data);
      expectWatertight(stats, '5×4 magnet');

      const halfD = (4 * GRID) / 2;
      expect(stats.bounds.minY).toBeLessThanOrEqual(-halfD - TONGUE_PROTRUSION + 0.1);
    },
    TEST_TIMEOUT_MS
  );
});

/**
 * Watertight regression for the fractional + padded configurations from
 * issue #1472. The actual root cause of #1472 (directed-edge winding
 * collisions from a faulty STL writer heuristic) is covered by
 * `baseplateGenerator.scenario.winding.test.ts`; this block only asserts
 * the undirected/2-manifold property — boundary and non-manifold edge
 * counts — for the half-cell + asymmetric-padding pieces from the user's
 * 19.5×9.5 split-into-8 reproducer, which the existing #1407 dovetail
 * tests didn't cover.
 */
describe('baseplateGenerator — fractional + dovetail export (issue #1472)', () => {
  const TEST_TIMEOUT_MS = 60_000;

  function expectWatertight(stats: StlStats, label: string): void {
    expect(stats.nonManifoldEdges, `${label}: non-manifold edges`).toBe(0);
    expect(stats.boundaryEdges, `${label}: boundary edges`).toBe(0);
  }

  it(
    'fractional corner tile (4.5×4.5, padding, grooves only)',
    async () => {
      // corner-1 from the user's 19.5×9.5 split: front-left, half-cells
      // on both axes, paddingLeft, only grooves (right + back are joins).
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
      expectWatertight(analyzeManifold(data), '4.5×4.5 corner-1');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'fractional edge tile (5×4.5, tongue + grooves)',
    async () => {
      // edge-y-1: front edge of split, fractional in Y, all three of
      // left/right/back are joins → tongue on left, grooves on right + back.
      const params = defaults({
        width: 5,
        depth: 4.5,
        fractionalEdgeY: 'start',
        connectorNubs: true,
        edges: { left: 'join', right: 'join', front: 'exterior', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expectWatertight(analyzeManifold(data), '5×4.5 edge-y-1');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'fractional corner tile (4.5×5, padding both axes)',
    async () => {
      // corner-3: back-left of split, fractional in X, padding on left + back.
      const params = defaults({
        width: 4.5,
        depth: 5,
        paddingLeft: 7,
        paddingBack: 6,
        fractionalEdgeX: 'start',
        connectorNubs: true,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'exterior' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expectWatertight(analyzeManifold(data), '4.5×5 corner-3');
    },
    TEST_TIMEOUT_MS
  );

  // ─── preferIdenticalPieces — doubled dovetails (#1640) ────────────────────

  it(
    'preferIdenticalPieces produces a watertight STL and adds connector triangles',
    async () => {
      // 4×4 interior tile (4 join edges). Without the flag each cell boundary
      // gets a single male tongue or female groove. With the flag, every cell
      // boundary on a join edge gets BOTH a tongue and a groove (so the
      // connector layout is 180°-rotationally invariant). The doubled
      // features must produce a manifold mesh AND add triangles relative to
      // the single-feature baseline.
      const baseParams = defaults({
        width: 4,
        depth: 4,
        connectorNubs: true,
        edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      });

      const single = await exportBaseplate(baseParams, 'stl');
      const doubled = await exportBaseplate({ ...baseParams, preferIdenticalPieces: true }, 'stl');

      const singleStats = analyzeManifold(single.data);
      const doubledStats = analyzeManifold(doubled.data);

      expectWatertight(singleStats, '4×4 interior single-dovetail');
      expectWatertight(doubledStats, '4×4 interior doubled-dovetail');

      // 4 join edges × 3 boundaries per edge = 12 connectors single,
      // 24 connectors doubled. Each connector adds non-trivial triangle count,
      // so the doubled mesh must have meaningfully more triangles. Use a loose
      // lower bound to stay robust against tessellation tuning.
      expect(doubledStats.triangleCount).toBeGreaterThan(singleStats.triangleCount);
      expect(doubledStats.triangleCount - singleStats.triangleCount).toBeGreaterThanOrEqual(12 * 6);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'preferIdenticalPieces stays watertight on a corner tile with 2 join edges',
    async () => {
      // Canonical A1-style corner: join on right + back. Even a single doubled
      // feature on a 2u edge must remain manifold (only 1 boundary → 2
      // connectors per edge under the flag).
      const params = defaults({
        width: 2,
        depth: 2,
        connectorNubs: true,
        preferIdenticalPieces: true,
        edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expectWatertight(analyzeManifold(data), '2×2 A1-canonical doubled-dovetail');
    },
    TEST_TIMEOUT_MS
  );
});
