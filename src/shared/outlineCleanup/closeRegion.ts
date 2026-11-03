/**
 * Round a pocket's inside corners by a morphological close: grow the pocket
 * by the radius, then shrink it back. Every corner of the pocket that turns
 * in on itself, and every corner of an island, comes out an arc of that
 * radius, while the pocket never loses area anywhere, so the tool still fits
 * at its own corners.
 *
 * Done on a raster, through exact distance transforms, because the offsets
 * here join their corners square, and a square join would not round anything.
 */

import { fillPolygon } from '@/shared/scanTrace/colorSegment';
import { findToolBlobs } from '@/shared/scanTrace/toolBlobs';
import type { Region } from './mirror';
import type { Pt } from './runs';

/** Finest raster step, in mm. */
const MIN_PIXEL_MM = 0.05;
/** Most pixels the raster may hold, so a big pocket stays quick. */
const MAX_PIXELS = 1_500_000;

/** One-dimensional squared distance transform (Felzenszwalb and Huttenlocher). */
function transform1d(
  f: Float64Array,
  n: number,
  out: Float64Array,
  v: Int32Array,
  z: Float64Array
) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Squared distance, in pixels, from each pixel to the nearest one where `mask` is `target`. */
function squaredDistance(mask: Uint8Array, width: number, height: number, target: number) {
  const big = (width + height) ** 2;
  const grid = new Float64Array(width * height);
  for (let i = 0; i < grid.length; i++) grid[i] = mask[i] === target ? 0 : big;
  const n = Math.max(width, height);
  const f = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = grid[y * width + x];
    transform1d(f, height, out, v, z);
    for (let y = 0; y < height; y++) grid[y * width + x] = out[y];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = grid[y * width + x];
    transform1d(f, width, out, v, z);
    for (let x = 0; x < width; x++) grid[y * width + x] = out[x];
  }
  return grid;
}

/** `ring` pushed out by `d` along each point's averaged normal. */
function nudge(ring: readonly Pt[], d: number): Pt[] {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a.x * b.y - b.x * a.y;
  }
  const sign = area > 0 ? 1 : -1;
  return ring.map((p, i) => {
    const a = ring[(i - 1 + ring.length) % ring.length];
    const b = ring[(i + 1) % ring.length];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    return { x: p.x + (ty / l) * d * sign, y: p.y - (tx / l) * d * sign };
  });
}

export interface ClosedRegion {
  readonly region: Region;
  /** The raster's step, in mm: the traced outline is good to about half of it. */
  readonly pixel: number;
}

/** `region` with every inside corner rounded to `radius` mm, or null if it vanished. */
export function closeRegion(region: Region, radius: number): ClosedRegion | null {
  const xs = region.outline.map((p) => p.x);
  const ys = region.outline.map((p) => p.y);
  const margin = radius + 1;
  const minX = Math.min(...xs) - margin;
  const minY = Math.min(...ys) - margin;
  const spanX = Math.max(...xs) + margin - minX;
  const spanY = Math.max(...ys) + margin - minY;
  const pixel = Math.max(MIN_PIXEL_MM, Math.sqrt((spanX * spanY) / MAX_PIXELS));
  const width = Math.ceil(spanX / pixel) + 1;
  const height = Math.ceil(spanY / pixel) + 1;
  const toPx = (ring: readonly Pt[]) =>
    ring.map((p) => ({ x: (p.x - minX) / pixel, y: (p.y - minY) / pixel }));

  const pocket = fillPolygon(toPx(region.outline), width, height);
  for (const hole of region.holes) {
    const island = fillPolygon(toPx(hole), width, height);
    for (let i = 0; i < pocket.length; i++) if (island[i] === 1) pocket[i] = 0;
  }
  const r2 = (radius / pixel) ** 2;
  const toPocket = squaredDistance(pocket, width, height, 1);
  const grown = new Uint8Array(pocket.length);
  for (let i = 0; i < grown.length; i++) grown[i] = toPocket[i] <= r2 ? 1 : 0;
  const toOutside = squaredDistance(grown, width, height, 0);
  const closed = new Uint8Array(pocket.length);
  for (let i = 0; i < closed.length; i++) {
    closed[i] = pocket[i] === 1 || toOutside[i] > r2 ? 1 : 0;
  }

  // No speck share: an island too small to matter in a photo still stands
  // here, and only the radius decides which go.
  const blob = findToolBlobs({ width, height, data: closed }, 4, 0).at(0);
  if (!blob) return null;
  // Each ring is traced through its own pixels' centres, half a pixel short
  // of the edge between pocket and plastic: push every ring out to it.
  const toMm = (ring: readonly Pt[]) =>
    ring.map((p) => ({ x: minX + p.x * pixel, y: minY + p.y * pixel }));
  return {
    region: {
      outline: nudge(toMm(blob.contour), pixel / 2),
      holes: blob.holes.map((hole) => nudge(toMm(hole), pixel / 2)),
    },
    pixel,
  };
}
