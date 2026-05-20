import { describe, it, expect } from 'vitest';
import { scalePathPoints, translatePathPoints } from './pathTransforms';
import type { PathPoint } from '@/features/bin-designer/types';

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

describe('scalePathPoints', () => {
  it('scales positions around the given origin', () => {
    const result = scalePathPoints([corner(0, 0), corner(10, 0), corner(5, 10)], 2, 3, 0, 0);
    expect(result).toEqual([corner(0, 0), corner(20, 0), corner(10, 30)]);
  });

  it('keeps the origin fixed under scaling', () => {
    const result = scalePathPoints([corner(5, 5), corner(15, 5)], 2, 2, 5, 5);
    expect(result[0]).toEqual(corner(5, 5));
    expect(result[1]).toEqual(corner(25, 5));
  });

  it('scales handles by the same factors as points', () => {
    const pt: PathPoint = {
      x: 10,
      y: 10,
      handleIn: { dx: -2, dy: 1 },
      handleOut: { dx: 2, dy: -1 },
      symmetric: true,
    };
    const result = scalePathPoints([pt], 3, 2, 0, 0);
    expect(result[0].handleIn).toEqual({ dx: -6, dy: 2 });
    expect(result[0].handleOut).toEqual({ dx: 6, dy: -2 });
  });
});

describe('translatePathPoints', () => {
  it('shifts every point by the delta', () => {
    const result = translatePathPoints([corner(0, 0), corner(10, 20)], 5, -3);
    expect(result).toEqual([corner(5, -3), corner(15, 17)]);
  });

  it('leaves relative handles untouched', () => {
    const pt: PathPoint = {
      x: 0,
      y: 0,
      handleIn: { dx: 1, dy: 2 },
      handleOut: { dx: -3, dy: -4 },
      symmetric: false,
    };
    const [moved] = translatePathPoints([pt], 100, 200);
    expect(moved.handleIn).toEqual({ dx: 1, dy: 2 });
    expect(moved.handleOut).toEqual({ dx: -3, dy: -4 });
  });
});
