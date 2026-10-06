import { describe, it, expect } from 'vitest';
import { binFloorMm } from '@/features/bin-designer/types/base';
import { SHELL_REFERENCE_WALL_MM, stackingLipVolume, wallThicknessDelta } from './printShellVolume';

const W = 83.5;
const D = 41.5;
const WALL_HEIGHT = 42 - 4.75;

function socketed(wall: number, stackingLip: boolean, wallHeight = WALL_HEIGHT): number {
  return wallThicknessDelta(W, D, wallHeight, wall, binFloorMm(wall, 'standard', 0), stackingLip);
}

describe('wallThicknessDelta', () => {
  it('is zero at the wall the shared shell model was calibrated on', () => {
    expect(socketed(SHELL_REFERENCE_WALL_MM, true)).toBe(0);
    expect(socketed(SHELL_REFERENCE_WALL_MM, false)).toBe(0);
  });

  it('adds material for a thicker wall and removes it for a thinner one', () => {
    expect(socketed(2, true)).toBeGreaterThan(0);
    expect(socketed(0.4, true)).toBeLessThan(0);
  });

  it('matches the exported 2x1x6 solid from 1.2 to 2.0mm walls', () => {
    expect(socketed(2, true)).toBeCloseTo(39925 - 33800, -2);
    expect(socketed(2, false)).toBeCloseTo(38095 - 31560, -2);
  });

  it('counts less of the wall under a lip, which already fills its top', () => {
    expect(socketed(2, true)).toBeLessThan(socketed(2, false));
  });

  it('is zero for a wall with no height', () => {
    expect(socketed(2, true, 0)).toBe(0);
  });

  it('gives back the floor a flat base does not build', () => {
    const wall = SHELL_REFERENCE_WALL_MM;
    const flatFloor = binFloorMm(wall, 'flat', 0);
    const slab = (W - 2 * wall) * (D - 2 * wall) * (binFloorMm(wall, 'standard', 0) - flatFloor);
    const delta = wallThicknessDelta(W, D, WALL_HEIGHT, wall, flatFloor, true);
    // Less the corner rounding, which the slab's rectangle overcounts.
    expect(delta).toBeLessThan(-slab * 0.99);
    expect(delta).toBeGreaterThan(-slab);
  });
});

describe('stackingLipVolume', () => {
  it('matches the exported lip of a 1x1 and a 4x3 bin', () => {
    expect(stackingLipVolume(41.5, 41.5)).toBeCloseTo(1440, -1);
    expect(stackingLipVolume(167.5, 125.5)).toBeCloseTo(5414, -1);
  });

  it('never goes negative on a degenerate footprint', () => {
    expect(stackingLipVolume(0, 0)).toBe(0);
  });
});
