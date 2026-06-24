// @vitest-environment node
/**
 * Draft/exact parity guard for the direct-mesh bin preview.
 *
 * The direct mesh is shown instantly and then replaced by the exact B-rep
 * result, so the two must line up — a footprint, foot, or lip-rim mismatch
 * would make the bin visibly jump on the swap. Visual parity isn't
 * snapshot-verifiable, so this measures the dimensional invariants that a
 * CLEARANCE / corner-radius / lip drift would break: bounding box, lip-rim
 * height, and triangle-count order of magnitude. The exact path runs at preview
 * quality (`forExport = false`), the same profile the draft targets.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin, type GenerateBinFn } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { generateBinDirect } from './binDirectMesh';

let generateBin: GenerateBinFn;

beforeAll(async () => {
  await initBrepjs();
  generateBin = getGenerateBin();
}, 30_000);

const noop = (): void => {};

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function bounds(vertices: Float32Array): Bounds {
  const b: Bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (let i = 0; i < vertices.length; i += 3) {
    b.minX = Math.min(b.minX, vertices[i]);
    b.maxX = Math.max(b.maxX, vertices[i]);
    b.minY = Math.min(b.minY, vertices[i + 1]);
    b.maxY = Math.max(b.maxY, vertices[i + 1]);
    b.minZ = Math.min(b.minZ, vertices[i + 2]);
    b.maxZ = Math.max(b.maxZ, vertices[i + 2]);
  }
  return b;
}

/** Assert each bounding-box face aligns within the given tolerances. */
function expectBoundsMatch(direct: Bounds, brep: Bounds, xyTol: number, zTol: number): void {
  expect(Math.abs(direct.minX - brep.minX)).toBeLessThan(xyTol);
  expect(Math.abs(direct.maxX - brep.maxX)).toBeLessThan(xyTol);
  expect(Math.abs(direct.minY - brep.minY)).toBeLessThan(xyTol);
  expect(Math.abs(direct.maxY - brep.maxY)).toBeLessThan(xyTol);
  expect(Math.abs(direct.minZ - brep.minZ)).toBeLessThan(zTol);
  expect(Math.abs(direct.maxZ - brep.maxZ)).toBeLessThan(zTol);
}

const cases: ReadonlyArray<readonly [string, Partial<BinParams>]> = [
  ['2×2×3 standard + lip', { width: 2, depth: 2, height: 3 }],
  [
    '2×2×3 no lip',
    { width: 2, depth: 2, height: 3, base: { ...buildParams({}).base, stackingLip: false } },
  ],
  ['3×2×4 standard + lip', { width: 3, depth: 2, height: 4 }],
  ['2.5×2×3 fractional + lip', { width: 2.5, depth: 2, height: 3 }],
  // Magnet base: the draft's body + feet must still match the exact mesh's
  // bounding box even though the exact path bores (unseen) underside holes.
  [
    '2×2×3 magnet base',
    { width: 2, depth: 2, height: 3, base: { ...buildParams({}).base, style: 'magnet' } },
  ],
];

describe('binDirectMesh — draft/exact parity', () => {
  for (const [label, overrides] of cases) {
    it(`${label}: bounding box matches the exact preview mesh`, () => {
      const params = buildParams(overrides);
      const brep = generateBin(params, noop, false);
      const direct = generateBinDirect(params, noop);

      // XY within 1mm (corner-arc tessellation differs); Z within 0.2mm
      // (the lip rim is the tight constraint — it must not visibly shift).
      expectBoundsMatch(bounds(direct.vertices), bounds(brep.vertices), 1, 0.2);
    });

    it(`${label}: triangle count stays within an order of magnitude`, () => {
      const params = buildParams(overrides);
      const brep = generateBin(params, noop, false);
      const direct = generateBinDirect(params, noop);

      const ratio = direct.triangleCount / brep.triangleCount;
      expect(ratio).toBeGreaterThan(0.1);
      expect(ratio).toBeLessThan(10);
    });
  }
});
