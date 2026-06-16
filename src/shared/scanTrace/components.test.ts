import { describe, it, expect } from 'vitest';
import { largestComponent } from './components';
import type { Mask } from './types';

function mask(w: number, h: number, isFg: (x: number, y: number) => boolean): Mask {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[y * w + x] = isFg(x, y) ? 1 : 0;
    }
  }
  return { width: w, height: h, data };
}

const countOnes = (m: Mask): number => m.data.reduce((a, v) => a + v, 0);

describe('largestComponent', () => {
  it('keeps the larger of two regions and drops the smaller', () => {
    // 4×4 block at top-left, 2×2 block at bottom-right (disconnected).
    const m = mask(12, 12, (x, y) => (x < 4 && y < 4) || (x >= 10 && y >= 10));
    const result = largestComponent(m);
    expect(result.area).toBe(16);
    expect(countOnes(result.mask)).toBe(16);
    expect(result.start).toEqual({ x: 0, y: 0 });
  });

  it('discards single-pixel speckle', () => {
    const m = mask(
      10,
      10,
      (x, y) => (x >= 3 && x <= 6 && y >= 3 && y <= 6) || (x === 9 && y === 0)
    );
    const result = largestComponent(m);
    expect(result.area).toBe(16);
    expect(result.mask.data[0 * 10 + 9]).toBe(0); // speckle removed
  });

  it('connects diagonally (8-connectivity)', () => {
    const m = mask(6, 6, (x, y) => (x === 1 && y === 1) || (x === 2 && y === 2));
    expect(largestComponent(m).area).toBe(2);
  });

  it('returns a null start for an empty mask', () => {
    const result = largestComponent(mask(5, 5, () => false));
    expect(result.area).toBe(0);
    expect(result.start).toBeNull();
  });
});
