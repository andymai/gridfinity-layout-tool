// @vitest-environment node
/**
 * STL export must succeed for auto-radius scoops across single-compartment
 * and merged-compartment bins. These configs previously hit STL_EXPORT_FAILED
 * because the scoop's cusp rim edges produced degenerate topology after
 * filleting (issue #1850).
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

  // Lip-offset polygon (lipOffset > 0) has extra wall-top points before the
  // arc, structurally different from the no-lip path. Cover it so a future
  // regression on the lip branch doesn't slip through.
  it('exports 4×4×3 + auto scoop WITH stacking lip', async () => {
    const params: BinParams = {
      ...singleCompartmentScoop(4, 4, 3),
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };
    const result = await exportBin(params, 'stl');
    expect(result.data.byteLength).toBeGreaterThan(0);
  }, 120000);
});
