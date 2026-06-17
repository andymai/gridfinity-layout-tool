/**
 * Morphological dilation of a binary mask (square structuring element).
 *
 * Used to bake an FDM fit clearance into a scanned outline: freeform `path`
 * cutouts can't carry the parametric `clearance` field (offsetting an arbitrary
 * outline isn't well-defined in the generator), so we instead grow the silhouette
 * in mask space before tracing. Dilation is topology-safe — no self-intersection
 * math — and a separable two-pass implementation keeps it O(n) for small radii.
 */

import type { Mask, Point } from './types';

/** px-per-mm from a detected card's perimeter (orientation-independent). */
export function cardPxPerMm(corners: readonly Point[], widthMm: number, heightMm: number): number {
  let perim = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    perim += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const realPerim = 2 * (widthMm + heightMm);
  return realPerim > 0 ? perim / realPerim : 0;
}

/** Grow the foreground by `radius` pixels (Chebyshev). radius<=0 returns input. */
export function dilateMask(mask: Mask, radius: number): Mask {
  const r = Math.floor(radius);
  if (r <= 0) return mask;
  const { width, height, data } = mask;

  // Horizontal pass: a pixel is set if any pixel within ±r on its row is set.
  const horiz = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let on = 0;
      const lo = Math.max(0, x - r);
      const hi = Math.min(width - 1, x + r);
      for (let k = lo; k <= hi; k++) {
        if (data[row + k] === 1) {
          on = 1;
          break;
        }
      }
      horiz[row + x] = on;
    }
  }

  // Vertical pass over the horizontal result → full square dilation.
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const lo = Math.max(0, y - r);
    const hi = Math.min(height - 1, y + r);
    for (let x = 0; x < width; x++) {
      let on = 0;
      for (let k = lo; k <= hi; k++) {
        if (horiz[k * width + x] === 1) {
          on = 1;
          break;
        }
      }
      out[y * width + x] = on;
    }
  }

  return { width, height, data: out };
}
