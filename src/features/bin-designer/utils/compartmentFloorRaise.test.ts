import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants';
import { MAX_COMPARTMENT_FLOOR_RAISE_MM, MIN_RAISED_CAVITY_MM } from '../types';
import { binDimensions } from './binDimensions';
import { maxCompartmentFloorRaiseMm } from './compartmentFloorRaise';

describe('maxCompartmentFloorRaiseMm', () => {
  it('leaves a pocket above the raise on a short bin', () => {
    const params = { ...DEFAULT_BIN_PARAMS, height: 3 };
    const max = maxCompartmentFloorRaiseMm(params);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(binDimensions(params).wallHeight - MIN_RAISED_CAVITY_MM);
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
