import { describe, it, expect } from 'vitest';
import { simplifyRdp } from './simplify';
import type { Point } from './types';

describe('simplifyRdp', () => {
  it('removes collinear interior points but keeps corners', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(simplifyRdp(points, 0.5)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]);
  });

  it('keeps a corner that exceeds the tolerance', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 1 },
      { x: 10, y: 0 },
    ];
    expect(simplifyRdp(points, 0.5)).toHaveLength(3);
  });

  it('drops a corner that falls within the tolerance', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0.2 },
      { x: 10, y: 0 },
    ];
    expect(simplifyRdp(points, 0.5)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it('returns a copy when there are fewer than 3 points', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const out = simplifyRdp(points, 1);
    expect(out).toEqual(points);
    expect(out).not.toBe(points);
  });
});
