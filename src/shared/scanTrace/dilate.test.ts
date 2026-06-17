import { describe, it, expect } from 'vitest';
import { dilateMask, cardPxPerMm } from './dilate';
import type { Mask, Point } from './types';

/** 5×5 mask with a single centre pixel set. */
function dot(): Mask {
  const data = new Uint8Array(25);
  data[2 * 5 + 2] = 1;
  return { width: 5, height: 5, data };
}

function count(mask: Mask): number {
  return mask.data.reduce((n, v) => n + v, 0);
}

describe('dilateMask', () => {
  it('returns the input unchanged for radius <= 0', () => {
    const m = dot();
    expect(dilateMask(m, 0)).toBe(m);
    expect(count(dilateMask(m, -1))).toBe(1);
  });

  it('grows a single pixel into a (2r+1)² square', () => {
    expect(count(dilateMask(dot(), 1))).toBe(9); // 3×3
    expect(count(dilateMask(dot(), 2))).toBe(25); // 5×5 (fills the grid)
  });

  it('clamps at mask edges', () => {
    const data = new Uint8Array(25);
    data[0] = 1; // top-left corner
    const out = dilateMask({ width: 5, height: 5, data }, 1);
    expect(count(out)).toBe(4); // 2×2 quarter of the 3×3 kernel
  });
});

describe('cardPxPerMm', () => {
  it('derives px/mm from a card quad perimeter', () => {
    // An 85.6×53.98mm card rendered at 5 px/mm → 428 × 269.9 px.
    const corners: Point[] = [
      { x: 0, y: 0 },
      { x: 428, y: 0 },
      { x: 428, y: 269.9 },
      { x: 0, y: 269.9 },
    ];
    expect(cardPxPerMm(corners, 85.6, 53.98)).toBeCloseTo(5, 1);
  });
});
