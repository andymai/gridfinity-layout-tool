// @vitest-environment node
/**
 * Scenario tests for the `puzzle` connector (issue #2241).
 *
 * The puzzle is an integral jigsaw-tab tongue/groove — a stronger replacement for
 * the legacy slip-fit `dovetail`, added as its own style so existing dovetail
 * plates stay reproducible. These tests verify, against the real OCCT kernel, that
 * a split baseplate with `connectorStyle: 'puzzle'` exports a watertight STL (the
 * rounded necked tongues/grooves don't create boundary/non-manifold edges) and
 * that the tongue actually protrudes past the wall (it locks, not flush).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { TONGUE_PROTRUSION } from './generatorConstants';

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

const GRID = 42;

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 4,
  depth: 4,
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
  connectorNubs: true,
  connectorStyle: 'puzzle',
  ...overrides,
});

interface Stats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  hasNaN: boolean;
}

function analyze(stl: ArrayBuffer): Stats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;
  const Q = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * Q)},${Math.round(y * Q)},${Math.round(z * Q)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeCount = new Map<string, number>();
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    hasNaN = false;
  for (let t = 0; t < triangleCount; t++) {
    const b = t * 9;
    const verts: Array<[number, number, number]> = [
      [vertices[b], vertices[b + 1], vertices[b + 2]],
      [vertices[b + 3], vertices[b + 4], vertices[b + 5]],
      [vertices[b + 6], vertices[b + 7], vertices[b + 8]],
    ];
    for (const [x, y, z] of verts) {
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) hasNaN = true;
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
  let nonManifoldEdges = 0,
    boundaryEdges = 0;
  for (const c of edgeCount.values()) {
    if (c === 1) boundaryEdges++;
    else if (c > 2) nonManifoldEdges++;
  }
  return {
    triangleCount,
    nonManifoldEdges,
    boundaryEdges,
    bounds: { minX, maxX, minY, maxY },
    hasNaN,
  };
}

describe('baseplateGenerator — puzzle connector (issue #2241)', () => {
  const TIMEOUT = 60_000;

  it(
    'a split puzzle baseplate exports a watertight STL',
    async () => {
      // 8 wide → splits into two 4-wide pieces with a join seam carrying puzzle tabs.
      const { data } = await exportBaseplate(defaults({ width: 8, depth: 4 }), 'stl');
      const stats = analyze(data);
      expect(stats.hasNaN, 'no NaN vertices').toBe(false);
      expect(stats.triangleCount, 'non-empty mesh').toBeGreaterThan(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
    },
    TIMEOUT
  );

  it(
    'paired-mode puzzle baseplate is watertight too',
    async () => {
      const { data } = await exportBaseplate(
        defaults({ width: 8, depth: 4, preferIdenticalPieces: true }),
        'stl'
      );
      const stats = analyze(data);
      expect(stats.hasNaN).toBe(false);
      expect(stats.nonManifoldEdges).toBe(0);
      expect(stats.boundaryEdges).toBe(0);
    },
    TIMEOUT
  );

  it(
    'the puzzle tongue protrudes past the wall (it locks, not flush)',
    async () => {
      // Default handedness: the left join edge is male → its tongue protrudes −x.
      const params = defaults({
        width: 4,
        depth: 4,
        edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      });
      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyze(data);
      const halfW = (4 * GRID) / 2;
      expect(stats.bounds.minX).toBeLessThanOrEqual(-halfW - TONGUE_PROTRUSION + 0.3);
    },
    TIMEOUT
  );
});
