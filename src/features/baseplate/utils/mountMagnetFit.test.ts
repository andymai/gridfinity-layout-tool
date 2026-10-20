import { describe, expect, it } from 'vitest';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { maxMountMagnetDepthForPlate } from './mountMagnetFit';

describe('maxMountMagnetDepthForPlate', () => {
  it('holds ø6.5 to 2.8mm on a standard plate, past the 2.5mm cap', () => {
    expect(maxMountMagnetDepthForPlate(DEFAULT_BASEPLATE_PARAMS, 6.5, false, 0)).toBeCloseTo(
      2.8,
      6
    );
  });

  it('holds less than the cap on a low-profile plate', () => {
    expect(maxMountMagnetDepthForPlate(DEFAULT_BASEPLATE_PARAMS, 6.5, true, 0)).toBeCloseTo(1.7, 6);
  });

  it('takes the cap on a low-profile plate once a solid floor is added', () => {
    expect(
      maxMountMagnetDepthForPlate({ ...DEFAULT_BASEPLATE_PARAMS, solidFloor: true }, 6.5, true, 0)
    ).toBeGreaterThanOrEqual(2.5);
  });

  it('gains depth from the magnet floor under the pockets', () => {
    const floored = maxMountMagnetDepthForPlate(
      { ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true },
      6.5,
      true,
      0
    );
    expect(floored).toBeGreaterThan(3);
  });

  it('gains depth from the screw pad the plate prints with', () => {
    const bare = maxMountMagnetDepthForPlate(DEFAULT_BASEPLATE_PARAMS, 6.5, true, 0);
    const padded = maxMountMagnetDepthForPlate(DEFAULT_BASEPLATE_PARAMS, 6.5, true, 3.1);
    expect(padded).toBeGreaterThan(bare);
  });
});
