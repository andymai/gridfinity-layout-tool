import { describe, it, expect } from 'vitest';
import { baseplateFloorDepth, baseplateTotalHeight } from './baseplateHeight';
import { GRIDFINITY_SPEC, MAGNET_FLOOR } from './gridfinityGeometry';
import { SOLID_FLOOR_DEFAULT_MM } from '@/core/baseplateDefaults';

const SOCKET = GRIDFINITY_SPEC.SOCKET_HEIGHT;

describe('baseplateFloorDepth', () => {
  it('is zero for a plate whose pockets cut straight through', () => {
    expect(baseplateFloorDepth({ magnetHoles: false, magnetDepth: 2 })).toBe(0);
  });

  it('leaves a retaining floor under magnet holes', () => {
    expect(baseplateFloorDepth({ magnetHoles: true, magnetDepth: 2 })).toBe(MAGNET_FLOOR + 2);
  });

  it('ignores magnet depth when there are no holes', () => {
    expect(baseplateFloorDepth({ magnetHoles: false, magnetDepth: 6 })).toBe(0);
  });

  it('adds the solid floor below the magnet floor', () => {
    expect(
      baseplateFloorDepth({
        magnetHoles: true,
        magnetDepth: 2,
        solidFloor: true,
        solidFloorThickness: 3,
      })
    ).toBe(MAGNET_FLOOR + 2 + 3);
  });

  it('defaults an unset solid-floor thickness to the shared default', () => {
    expect(baseplateFloorDepth({ magnetHoles: false, magnetDepth: 2, solidFloor: true })).toBe(
      SOLID_FLOOR_DEFAULT_MM
    );
  });

  it('ignores the thickness when the solid floor is off', () => {
    expect(
      baseplateFloorDepth({
        magnetHoles: false,
        magnetDepth: 2,
        solidFloor: false,
        solidFloorThickness: 5,
      })
    ).toBe(0);
  });
});

describe('baseplateTotalHeight', () => {
  it('is one socket tall for a plain plate', () => {
    expect(baseplateTotalHeight({ magnetHoles: false, magnetDepth: 2 })).toBe(SOCKET);
  });

  it('grows by exactly the floor depth', () => {
    const params = { magnetHoles: true, magnetDepth: 2, solidFloor: true, solidFloorThickness: 1 };
    expect(baseplateTotalHeight(params)).toBe(SOCKET + baseplateFloorDepth(params));
  });
});
