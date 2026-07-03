// @vitest-environment node
/**
 * Scenario tests for dovetail-key connectors (issue #1610).
 *
 * Dovetail key mode cuts a female groove on BOTH sides of every seam and ships a
 * separate hammered-in key. These tests verify, against the real OCCT kernel,
 * that:
 *   1. a dovetail key baseplate exports a watertight STL (the doubled grooves don't
 *      create boundary/non-manifold edges), and
 *   2. the standalone connector key is a valid solid with the expected dovetail key
 *      footprint — narrow waist at the seam, wide wings, key length = 2×P.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { TONGUE_PROTRUSION, TONGUE_BASE_HALF, TONGUE_TIP_HALF } from './generatorConstants';

type ExportFn = (
  params: ResolvedBaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

let exportBaseplate: ExportFn;
let exportConnectorKey: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateGenerator');
  exportBaseplate = mod.exportBaseplate;
  exportConnectorKey = mod.exportConnectorKey;
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
  lightweight: true,
  ...overrides,
});

interface MeshStats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  hasNaN: boolean;
}

function analyze(stl: ArrayBuffer): MeshStats {
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
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  let hasNaN = false;

  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const verts: Array<[number, number, number]> = [
      [vertices[base], vertices[base + 1], vertices[base + 2]],
      [vertices[base + 3], vertices[base + 4], vertices[base + 5]],
      [vertices[base + 6], vertices[base + 7], vertices[base + 8]],
    ];
    for (const [x, y, z] of verts) {
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) hasNaN = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
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
  return {
    triangleCount,
    nonManifoldEdges,
    boundaryEdges,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    hasNaN,
  };
}

describe('baseplateGenerator — dovetail key connectors (issue #1610)', () => {
  const TEST_TIMEOUT_MS = 60_000;

  it(
    'dovetail key baseplate with join edges exports a watertight STL',
    async () => {
      // A middle tile with three join edges: every seam side is a female groove.
      const params = defaults({
        width: 5,
        depth: 4,
        connectorNubs: true,
        connectorStyle: 'dovetailKey',
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyze(data);

      expect(stats.hasNaN, 'no NaN vertices').toBe(false);
      expect(stats.triangleCount, 'non-empty mesh').toBeGreaterThan(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'connector key is a valid solid with a dovetail key footprint',
    async () => {
      const params = defaults({ connectorNubs: true, connectorStyle: 'dovetailKey' });
      const { data, fileName } = await exportConnectorKey(params, 'stl');
      const stats = analyze(data);

      expect(fileName).toBe('connector_key.stl');
      expect(stats.hasNaN).toBe(false);
      expect(stats.triangleCount).toBeGreaterThan(0);
      expect(stats.nonManifoldEdges).toBe(0);
      expect(stats.boundaryEdges).toBe(0);

      // Long axis along X spans both wings: 2 × protrusion.
      const width = stats.bounds.maxX - stats.bounds.minX;
      expect(width).toBeCloseTo(2 * TONGUE_PROTRUSION, 1);

      // Cross axis spans the wing tips (wide end).
      const depth = stats.bounds.maxY - stats.bounds.minY;
      expect(depth).toBeCloseTo(2 * TONGUE_TIP_HALF, 1);

      // The waist (narrow end) must be strictly narrower than the wings, or the
      // key wouldn't lock — sanity-check the defining constants.
      expect(TONGUE_BASE_HALF).toBeLessThan(TONGUE_TIP_HALF);

      // Bed-ready: bottom sits at Z=0, full socket height (no magnets here = 5mm).
      expect(stats.bounds.minZ).toBeCloseTo(0, 1);
      expect(stats.bounds.maxZ).toBeGreaterThan(4);
    },
    TEST_TIMEOUT_MS
  );
});
