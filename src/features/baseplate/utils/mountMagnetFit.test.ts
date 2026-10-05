import { describe, expect, it } from 'vitest';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { maxMountMagnetDepthForPlate } from './mountMagnetFit';

describe('maxMountMagnetDepthForPlate', () => {
  it('holds ø6.5 to 2.8mm on a standard plate, past the 2.5mm cap', () => {
    expect(maxMountMagnetDepthForPlate(DEFAULT_BASEPLATE_PARAMS, 6.5, false)).toBeCloseTo(2.8, 6);
  });

  it('holds less than the cap on a low-profile plate', () => {
    expect(maxMountMagnetDepthForPlate(DEFAULT_BASEPLATE_PARAMS, 6.5, true)).toBeCloseTo(1.7, 6);
  });

  it('takes the cap on a low-profile plate once a solid floor is added', () => {
    expect(
      maxMountMagnetDepthForPlate({ ...DEFAULT_BASEPLATE_PARAMS, solidFloor: true }, 6.5, true)
    ).toBeGreaterThanOrEqual(2.5);
  });

  it('gains depth from the magnet floor under the pockets', () => {
    const floored = maxMountMagnetDepthForPlate(
      { ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true },
      6.5,
      true
    );
    expect(floored).toBeGreaterThan(3);
  });
});
