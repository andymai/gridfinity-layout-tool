// @vitest-environment node
/**
 * Stress-test scenarios that stack the recently-changed code paths in the
 * baseplate generator:
 *   - fractional grid widths (#1284 — fractional padding/dim display)
 *   - split edges with dovetail connectors (#1411 — tongue protrusion fix)
 *   - per-piece dovetail inversion (#1376)
 *   - magnet holes (drives `cutInBatches` → the bulk of BREP `unwrap` calls)
 *
 * Each scenario exercises a combination that reported users have hit in
 * production. If BREP produces a degenerate but "valid" solid, `unwrap` lets
 * it through and the corruption surfaces as non-manifold STL geometry.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';

type ExportFn = (
  params: ResolvedBaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

let exportBaseplate: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateGenerator');
  exportBaseplate = mod.exportBaseplate;
}, 30000);

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
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
  lightweight: false,
  ...overrides,
});

interface StlStats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  hasNaN: boolean;
}

function analyzeManifold(stl: ArrayBuffer): StlStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;

  let hasNaN = false;
  for (let i = 0; i < vertices.length; i++) {
    if (!Number.isFinite(vertices[i])) {
      hasNaN = true;
      break;
    }
  }

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const keys = [
      vKey(vertices[base], vertices[base + 1], vertices[base + 2]),
      vKey(vertices[base + 3], vertices[base + 4], vertices[base + 5]),
      vKey(vertices[base + 6], vertices[base + 7], vertices[base + 8]),
    ];
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
  return { triangleCount, nonManifoldEdges, boundaryEdges, hasNaN };
}

describe('baseplateGenerator — split stress (recent code paths stacked)', () => {
  const TEST_TIMEOUT_MS = 60_000;

  function expectClean(stats: StlStats, label: string): void {
    expect(stats.hasNaN, `${label}: NaN vertex in STL`).toBe(false);
    expect(stats.triangleCount, `${label}: zero triangles`).toBeGreaterThan(0);
    expect(stats.boundaryEdges, `${label}: boundary edges`).toBe(0);
    expect(stats.nonManifoldEdges, `${label}: non-manifold edges`).toBe(0);
  }

  it(
    'fractional width + dovetails + inverted + magnets (stacks all recent changes)',
    async () => {
      const params = defaults({
        width: 2.5,
        depth: 3,
        magnetHoles: true,
        connectorNubs: true,
        invertDovetails: true,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expectClean(analyzeManifold(data), '2.5×3 fractional+inverted+magnets');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'fractional depth + dovetails on all four sides (interior tile)',
    async () => {
      const params = defaults({
        width: 3,
        depth: 2.5,
        magnetHoles: true,
        connectorNubs: true,
        edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expectClean(analyzeManifold(data), '3×2.5 interior fractional');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'fractional padding + dovetails (fractional boundary not from grid size)',
    async () => {
      const params = defaults({
        width: 3,
        depth: 3,
        paddingLeft: 2.5,
        paddingRight: 2.5,
        magnetHoles: true,
        connectorNubs: true,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expectClean(analyzeManifold(data), '3×3 fractional padding + magnets');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'per-corner radii on split piece with inverted dovetails',
    async () => {
      // cornerRadii is the field flagged by the sub-agent as a fingerprint
      // discriminator — exercise it alongside inversion to stress the cache key.
      const params = defaults({
        width: 4,
        depth: 3,
        magnetHoles: true,
        connectorNubs: true,
        invertDovetails: true,
        cornerRadii: { tl: 0, tr: 4, bl: 0, br: 4 },
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      expectClean(analyzeManifold(data), '4×3 per-corner radii + inverted');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'dense magnet grid (10×10 stresses cutInBatches)',
    async () => {
      // 100 cells × 4 magnet holes per cell = 400 boolean subtractions,
      // batched through `cutInBatches`. Sized to stay under the test budget
      // while still exercising the batched-cut code path. Larger grids
      // (e.g. 16×16) take longer than 60s in Node; production budgets those
      // via `computeBaseplateTimeoutMs` in `GenerationBridge`.
      const params = defaults({
        width: 10,
        depth: 10,
        magnetHoles: true,
        lightweight: true,
      });

      const { data } = await exportBaseplate(params, 'stl');
      expectClean(analyzeManifold(data), '10×10 dense magnets');
    },
    TEST_TIMEOUT_MS
  );
});
