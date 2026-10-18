import { describe, it, expect } from 'vitest';
import { cornerMarkerPositions } from './cornerMarkerPositions';

const box = { x: 2, y: 3, z: 0, width: 1, depth: 1, height: 1, opacity: 1 };
// Each corner draws three arms of six numbers; the first top corner is the fifth.
const FIRST_TOP = 4 * 18;

describe('cornerMarkerPositions', () => {
  it('marks the corners of an upright box', () => {
    const positions = cornerMarkerPositions([box]);
    expect(positions).toHaveLength(8 * 18);
    expect(positions.slice(FIRST_TOP, FIRST_TOP + 3)).toEqual([2, 3, 1]);
  });

  it('moves the top corners with a slanted top, and tilts their upright arms', () => {
    const positions = cornerMarkerPositions([{ ...box, shear: { x: 1, y: -0.5, pivot: 0.2 } }]);
    const [x, y, z] = positions.slice(FIRST_TOP, FIRST_TOP + 3);
    expect(x).toBeCloseTo(2.8, 6);
    expect(y).toBeCloseTo(2.6, 6);
    expect(z).toBe(1);
    const upright = positions.slice(FIRST_TOP + 12, FIRST_TOP + 18);
    expect(upright[3] - upright[0]).toBeCloseTo(-0.12, 6);
    expect(upright[5] - upright[2]).toBeCloseTo(-0.12, 6);
    expect(positions.slice(0, 3)).toEqual([2, 3, 0]);
  });

  it('keeps the upright arm of a short bin on its wall below the pivot', () => {
    const positions = cornerMarkerPositions([
      { ...box, height: 0.17, shear: { x: 1, y: 0, pivot: 0.11 } },
    ]);
    const upright = positions.slice(FIRST_TOP + 12, FIRST_TOP + 18);
    expect(upright[0]).toBeCloseTo(2 + 0.06, 6);
    expect(upright[3]).toBeCloseTo(2, 6);
  });
});
