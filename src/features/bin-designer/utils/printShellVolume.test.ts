import { describe, it, expect } from 'vitest';
import { SHELL_REFERENCE_WALL_MM, stackingLipVolume, wallThicknessDelta } from './printShellVolume';

const W = 83.5;
const D = 41.5;
const WALL_HEIGHT = 42 - 4.75;

describe('wallThicknessDelta', () => {
  it('is zero at the wall the shared shell model was calibrated on', () => {
    expect(wallThicknessDelta(W, D, WALL_HEIGHT, SHELL_REFERENCE_WALL_MM, true)).toBe(0);
    expect(wallThicknessDelta(W, D, WALL_HEIGHT, SHELL_REFERENCE_WALL_MM, false)).toBe(0);
  });

  it('adds material for a thicker wall and removes it for a thinner one', () => {
    expect(wallThicknessDelta(W, D, WALL_HEIGHT, 2, true)).toBeGreaterThan(0);
    expect(wallThicknessDelta(W, D, WALL_HEIGHT, 0.4, true)).toBeLessThan(0);
  });

  it('matches the exported 2x1x6 solid from 1.2 to 2.0mm walls', () => {
    expect(wallThicknessDelta(W, D, WALL_HEIGHT, 2, true)).toBeCloseTo(39925 - 33800, -2);
    expect(wallThicknessDelta(W, D, WALL_HEIGHT, 2, false)).toBeCloseTo(38095 - 31560, -2);
  });

  it('counts less of the wall under a lip, which already fills its top', () => {
    expect(wallThicknessDelta(W, D, WALL_HEIGHT, 2, true)).toBeLessThan(
      wallThicknessDelta(W, D, WALL_HEIGHT, 2, false)
    );
  });

  it('is zero for a wall with no height', () => {
    expect(wallThicknessDelta(W, D, 0, 2, true)).toBe(0);
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
