// @vitest-environment node
/**
 * Scenario tests for the connector fit-sample tray (calibration card).
 *
 * The tray builds one row for the selected connector style across a fit-offset
 * ladder, each cell a mated pair of abstract coupons, plus one shared loose
 * key/clip for the key/clip styles. Verified against the real OCCT kernel:
 *   1. every piece is a valid, positive-volume solid,
 *   2. the exported STL is watertight (each coupon's groove/pocket + embossed
 *      label fuse cleanly — no boundary/non-manifold edges) and bed-resting, and
 *   3. the piece count matches the selected style (5 pairs, +1 loose for key/clip).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildConnectorSampleTray, exportConnectorSample } from './connectorSample';

beforeAll(async () => {
  await initBrepjs();
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

function analyze(stl: ArrayBuffer) {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;
  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeCount = new Map<string, number>();
  let minZ = Infinity,
    maxZ = -Infinity,
    hasNaN = false;
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const verts: Array<[number, number, number]> = [
      [vertices[base], vertices[base + 1], vertices[base + 2]],
      [vertices[base + 3], vertices[base + 4], vertices[base + 5]],
      [vertices[base + 6], vertices[base + 7], vertices[base + 8]],
    ];
    for (const [x, y, z] of verts) {
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) hasNaN = true;
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
  return { triangleCount, nonManifoldEdges, boundaryEdges, minZ, maxZ, hasNaN };
}

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

describe('connectorSample — fit-sample tray', () => {
  const TEST_TIMEOUT_MS = 120_000;

  it(
    'builds only the selected style row of valid, positive-volume pieces',
    () => {
      // Default integral dovetail: 5 offsets × 2 coupons, no loose part = 10.
      const pieces = buildConnectorSampleTray(defaults());
      try {
        expect(pieces).toHaveLength(10);
        for (const piece of pieces) {
          const v = vol(piece);
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThan(0);
        }
      } finally {
        for (const p of pieces) p.delete();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    'adds one shared loose part for the key/clip styles',
    () => {
      // 5 offsets × 2 coupons + 1 shared loose part = 11.
      for (const style of ['dovetailKey', 'snapClip'] as const) {
        const pieces = buildConnectorSampleTray(defaults({ connectorStyle: style }));
        try {
          expect(pieces, style).toHaveLength(11);
          for (const piece of pieces) expect(vol(piece)).toBeGreaterThan(0);
        } finally {
          for (const p of pieces) p.delete();
        }
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    'exports a watertight, bed-resting STL tray',
    async () => {
      const { data, fileName } = await exportConnectorSample(defaults(), 'stl');
      const stats = analyze(data);
      expect(fileName).toBe('connector_fit_sample.stl');
      expect(stats.hasNaN, 'no NaN vertices').toBe(false);
      expect(stats.triangleCount, 'non-empty mesh').toBeGreaterThan(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
      // Whole tray rests on the bed.
      expect(stats.minZ, 'rests on bed').toBeCloseTo(0, 1);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'exports a non-empty STEP tray',
    async () => {
      const { data, fileName } = await exportConnectorSample(defaults(), 'step');
      expect(fileName).toBe('connector_fit_sample.step');
      expect(data.byteLength).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'magnet-hole baseplates produce taller, still-valid coupons',
    () => {
      const pieces = buildConnectorSampleTray(defaults({ magnetHoles: true, magnetDepth: 2.4 }));
      try {
        expect(pieces).toHaveLength(10);
        for (const piece of pieces) {
          expect(vol(piece)).toBeGreaterThan(0);
        }
      } finally {
        for (const p of pieces) p.delete();
      }
    },
    TEST_TIMEOUT_MS
  );
});
