// @vitest-environment node
/**
 * Regression for issue #1850: STL export failed (STL_EXPORT_FAILED) for the
 * user's 6×6×6 bin with a 4×4 merged compartment + auto-radius scoop, plus
 * a small matrix of single-compartment shapes that hit the same failure.
 *
 * Root cause: the scoop's 2D profile traversed wall→arc→floor where the arc
 * is tangent to the wall at one end and the floor at the other. Tangent
 * meetings appear as 180° turns in the polygon, so the corresponding
 * longitudinal edges of the extruded scoop sat at cusps. brepjs's `fillet()`
 * on these cusp edges returned `Ok` with degenerate topology that downstream
 * `StlAPI.Write` rejected. The fillet was a purely cosmetic 2mm rim — sharp
 * edges print and function identically — so `scoopRampBuilder` no longer
 * applies it. See scoopRampBuilder.ts for the long comment.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { exportBin } from './binExporter';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

beforeEach(() => clearAllCaches());

function singleCompartmentScoop(w: number, d: number, h: number): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: w,
    depth: d,
    height: h,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
    scoop: { enabled: true, radius: 'auto' },
  };
}

describe('issue #1850 — scoop STL export at single-compartment wide bins', () => {
  it('exports 6×6×6 with 4×4 merged compartment + auto scoop (exact user config)', async () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 6,
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      compartments: {
        cols: 4,
        rows: 4,
        thickness: 1.2,
        cells: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      scoop: { enabled: true, radius: 'auto' },
    };
    const result = await exportBin(params, 'stl');
    expect(result.data.byteLength).toBeGreaterThan(0);
  }, 120000);

  it('exports 6×6×3 + single compartment + auto scoop (short walls + wide compartment)', async () => {
    const result = await exportBin(singleCompartmentScoop(6, 6, 3), 'stl');
    expect(result.data.byteLength).toBeGreaterThan(0);
  }, 120000);

  it('exports 3×3×6 + single compartment + auto scoop (tall walls + auto radius 18.5mm)', async () => {
    const result = await exportBin(singleCompartmentScoop(3, 3, 6), 'stl');
    expect(result.data.byteLength).toBeGreaterThan(0);
  }, 120000);

  it('exports 4×4×3 + single compartment + auto scoop (mid-width + short walls)', async () => {
    const result = await exportBin(singleCompartmentScoop(4, 4, 3), 'stl');
    expect(result.data.byteLength).toBeGreaterThan(0);
  }, 120000);
});
