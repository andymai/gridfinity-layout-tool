import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants';
import { MAX_COMPARTMENT_FLOOR_RAISE_MM, MIN_RAISED_CAVITY_MM } from '../types';
import { binDimensions } from './binDimensions';
import { builtCompartmentFloorRaiseMm, maxCompartmentFloorRaiseMm } from './compartmentFloorRaise';

describe('maxCompartmentFloorRaiseMm', () => {
  it('leaves a pocket above the raise on a short bin', () => {
    const params = { ...DEFAULT_BIN_PARAMS, height: 3 };
    const max = maxCompartmentFloorRaiseMm(params);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(binDimensions(params).wallHeight - MIN_RAISED_CAVITY_MM);
  });

  it('stays under the generator clamp on a lipped bin', () => {
    const lipped = {
      ...DEFAULT_BIN_PARAMS,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };
    const lipless = { ...lipped, base: { ...lipped.base, stackingLip: false } };
    const { wallHeight } = binDimensions(lipped);
    const workerCeiling =
      wallHeight - 0.7 - Math.max(lipped.wallThickness, 2) - MIN_RAISED_CAVITY_MM;
    expect(maxCompartmentFloorRaiseMm(lipped)).toBeLessThanOrEqual(workerCeiling);
    expect(maxCompartmentFloorRaiseMm(lipped)).toBeLessThanOrEqual(
      maxCompartmentFloorRaiseMm(lipless)
    );
  });

  it('never exceeds the persisted ceiling on a tall bin', () => {
    expect(maxCompartmentFloorRaiseMm({ ...DEFAULT_BIN_PARAMS, height: 30 })).toBe(
      MAX_COMPARTMENT_FLOOR_RAISE_MM
    );
  });

  it('offers nothing on a bin with no pocket to spare', () => {
    expect(maxCompartmentFloorRaiseMm({ ...DEFAULT_BIN_PARAMS, height: 1 })).toBe(0);
  });
});

describe('builtCompartmentFloorRaiseMm', () => {
  const compartments = { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2, floorRaises: [6, null] };

  it('builds the raise a compartment asks for', () => {
    expect(
      builtCompartmentFloorRaiseMm({ ...DEFAULT_BIN_PARAMS, width: 2, height: 4, compartments }, 0)
    ).toBe(6);
  });

  it('builds nothing on a custom shape, which the floor raise does not support', () => {
    const cellMask = { cols: 4, rows: 2, cells: [1, 1, 1, 1, 1, 1, 0, 0] as (0 | 1)[] };
    expect(
      builtCompartmentFloorRaiseMm(
        { ...DEFAULT_BIN_PARAMS, width: 2, height: 4, compartments, cellMask },
        0
      )
    ).toBe(0);
  });
});
