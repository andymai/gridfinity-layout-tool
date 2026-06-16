import { describe, it, expect } from 'vitest';
import { toGrayscale, computeOtsuThreshold, buildMask } from './mask';
import type { ImageDataLike } from './types';

function img(
  w: number,
  h: number,
  isObj: (x: number, y: number) => boolean,
  obj: readonly [number, number, number, number] = [0, 0, 0, 255],
  bg: readonly [number, number, number, number] = [255, 255, 255, 255]
): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const c = isObj(x, y) ? obj : bg;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = c[3];
    }
  }
  return { width: w, height: h, data };
}

const countOnes = (m: { data: Uint8Array }): number => m.data.reduce((a, v) => a + v, 0);
const inBlock = (x: number, y: number): boolean => x >= 3 && x <= 6 && y >= 3 && y <= 6; // 4×4 = 16

describe('toGrayscale', () => {
  it('applies Rec.601 luma weights', () => {
    const gray = toGrayscale(img(1, 1, () => true, [255, 0, 0, 255]));
    expect(gray[0]).toBe(76); // 255 * 0.299
  });
});

describe('computeOtsuThreshold', () => {
  it('separates a bimodal distribution', () => {
    const gray = new Uint8Array(100);
    gray.fill(50, 0, 50);
    gray.fill(200, 50, 100);
    const t = computeOtsuThreshold(gray);
    expect(t).toBeGreaterThan(50);
    expect(t).toBeLessThan(200);
  });
});

describe('buildMask', () => {
  it('marks a dark object on a light background as foreground', () => {
    const mask = buildMask(img(10, 10, inBlock));
    expect(countOnes(mask)).toBe(16);
    expect(mask.data[3 * 10 + 3]).toBe(1);
    expect(mask.data[0]).toBe(0);
  });

  it('marks a light object on a dark background as foreground (polarity auto-detect)', () => {
    const mask = buildMask(img(10, 10, inBlock, [255, 255, 255, 255], [0, 0, 0, 255]));
    expect(countOnes(mask)).toBe(16);
  });

  it('uses alpha directly when the image is mostly transparent', () => {
    // Opaque object, transparent background — color identical so only alpha distinguishes.
    const mask = buildMask(img(10, 10, inBlock, [120, 120, 120, 255], [120, 120, 120, 0]));
    expect(countOnes(mask)).toBe(16);
  });

  it('honors an explicit invert', () => {
    const normal = countOnes(buildMask(img(10, 10, inBlock)));
    const inverted = countOnes(buildMask(img(10, 10, inBlock), { invert: true }));
    expect(normal).toBe(16);
    expect(inverted).toBe(100 - 16);
  });
});
