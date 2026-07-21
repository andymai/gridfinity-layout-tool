// @vitest-environment node
/**
 * Scenario tests for the label-socket fit-calibration card (#2666 follow-up).
 *
 * The card sweeps the socket clearance across a fit-offset ladder (five 1U
 * coupons) and ships one nominal blank plate. Verified against the real OCCT
 * kernel:
 *   1. every piece is a valid, positive-volume solid,
 *   2. coupon volume strictly decreases as the offset grows (a looser fit is
 *      a bigger pocket — the ladder is actually cut, not five copies), and
 *   3. the exported STL is watertight and bed-resting.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume } from 'brepjs';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  buildLabelFitSampleCard,
  exportLabelFitSample,
  LABEL_FIT_SAMPLE_OFFSETS,
} from './labelFitSample';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

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

describe('labelFitSample — fit-calibration card', () => {
  const TEST_TIMEOUT_MS = 120_000;

  it(
    'builds five offset coupons plus one reference plate, all valid solids',
    () => {
      const pieces = buildLabelFitSampleCard();
      try {
        expect(pieces).toHaveLength(LABEL_FIT_SAMPLE_OFFSETS.length + 1);
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
    'cuts a strictly larger pocket at each offset step',
    () => {
      const pieces = buildLabelFitSampleCard();
      try {
        // Coupons are emitted ladder-ordered; embossed labels differ by a few
        // glyph areas, so compare with a tolerance well under the pocket
        // growth (0.05mm on a ~11–36mm pocket ≈ 4.7mm³ per step, glyph
        // variation ≲ 1.5mm³).
        const couponVolumes = pieces
          .slice(0, LABEL_FIT_SAMPLE_OFFSETS.length)
          .map((piece) => vol(piece));
        for (let i = 1; i < couponVolumes.length; i++) {
          expect(couponVolumes[i], `offset step ${i}`).toBeLessThan(couponVolumes[i - 1] - 1.5);
        }
      } finally {
        for (const p of pieces) p.delete();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    'exports a watertight, bed-resting STL card',
    async () => {
      const { data, fileName } = await exportLabelFitSample('stl');
      const stats = analyze(data);
      expect(fileName).toBe('label_fit_sample.stl');
      expect(stats.hasNaN, 'no NaN vertices').toBe(false);
      expect(stats.triangleCount, 'non-empty mesh').toBeGreaterThan(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
      expect(stats.minZ, 'rests on bed').toBeCloseTo(0, 1);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'exports STEP with the expected file name',
    async () => {
      const { data, fileName } = await exportLabelFitSample('step');
      expect(fileName).toBe('label_fit_sample.step');
      expect(data.byteLength).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );
});
