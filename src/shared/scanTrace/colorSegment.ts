/**
 * Classical tool segmentation on colour, for photos of tools on a plain
 * surface.
 *
 * Each pixel is scored by how far its colour sits from the surface, read in
 * CIE Lab. Lightness counts half: a cast shadow changes lightness but barely
 * changes colour, so down-weighting it is what keeps shadows out. The surface
 * is sampled from the band just inside the search region's edge (the frame,
 * or a sheet's marker ring), never from the middle where the tools are.
 * Before scoring, a plane fitted to that band's lightness is taken out, so
 * light falling off across the frame does not read as an object; fitting the
 * band alone, not blurring the whole image, keeps a large tool from flattening
 * its own contrast. The surface colour is the band's median, so a tool running
 * into the band does not move it.
 *
 * The score is thresholded at the midpoint of Otsu's maximum-variance plateau,
 * over a histogram capped near black on white, cleaned with a small open then close, and thin parts the opening erased (a
 * screwdriver's shaft) are restored, but only where they join exactly one
 * tool, so a stray line between two tools never bridges them.
 */

import type { ImageDataLike, Mask, Point } from './types';
import { computeOtsuThreshold, usesAlphaMask } from './mask';
import { labelComponents } from './components';

export interface ColorSegmentOptions {
  /**
   * How readily faint pixels count as tool, -127 to 128; 0 is automatic and
   * higher includes more. Scales the threshold rather than shifting it, so it
   * feels the same on photos with very different contrast.
   */
  readonly sensitivity?: number;
  /** Where to look, a polygon in image pixels; the whole frame when absent. */
  readonly region?: readonly Point[];
  /** Polygons to ignore outright, such as a size reference's card or markers. */
  readonly exclude?: readonly (readonly Point[])[];
}

/** Alpha at or above this counts as tool in a cut-out PNG. */
const ALPHA_CUTOFF = 128;
/** Samples per statistic over the band, enough for a stable median. */
const MAX_BAND_SAMPLES = 50_000;
/**
 * Where the threshold's histogram stops counting: about black on white. A
 * saturated orange scores far past a black handle, and left uncapped Otsu
 * would cut between the two and lose the handle; past this, every pixel is
 * plainly not the surface and how far past does not matter.
 */
const HISTOGRAM_CAP = 40;

const LINEAR = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

const labF = (t: number): number =>
  t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;

/** sRGB to CIE Lab under D65, lightness 0 to 100. */
export function toLab(img: ImageDataLike): { L: Float32Array; a: Float32Array; b: Float32Array } {
  const n = img.width * img.height;
  const L = new Float32Array(n);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = LINEAR[img.data[i * 4]];
    const g = LINEAR[img.data[i * 4 + 1]];
    const bl = LINEAR[img.data[i * 4 + 2]];
    const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * bl) / 0.95047;
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * bl;
    const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * bl) / 1.08883;
    const fx = labF(x);
    const fy = labF(y);
    const fz = labF(z);
    L[i] = 116 * fy - 16;
    a[i] = 500 * (fx - fy);
    b[i] = 200 * (fy - fz);
  }
  return { L, a, b };
}

/** Pixels whose centre lies inside `poly` (even-odd), as a 0/1 map. */
export function fillPolygon(poly: readonly Point[], width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  if (poly.length < 3) return out;
  const ys = poly.map((p) => p.y);
  const y0 = Math.max(0, Math.ceil(Math.min(...ys)));
  const y1 = Math.min(height - 1, Math.floor(Math.max(...ys)));
  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k]));
      const to = Math.min(width - 1, Math.floor(xs[k + 1]));
      for (let x = from; x <= to; x++) out[y * width + x] = 1;
    }
  }
  return out;
}

/** `poly` pushed out from its centroid by about `margin` pixels. */
function grown(poly: readonly Point[], margin: number): Point[] {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  return poly.map((p) => {
    const d = Math.hypot(p.x - cx, p.y - cy);
    const push = d > 0 ? (margin * Math.SQRT2) / d : 0;
    return { x: p.x + (p.x - cx) * push, y: p.y + (p.y - cy) * push };
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((p, q) => p - q);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Least-squares plane c0 + c1·x + c2·y through the samples, or null when degenerate. */
function fitPlane(
  samples: readonly number[],
  values: Float32Array,
  width: number
): [number, number, number] | null {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sv = 0;
  let sxv = 0;
  let syv = 0;
  for (const i of samples) {
    const x = i % width;
    const y = (i - x) / width;
    const v = values[i];
    n++;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sv += v;
    sxv += x * v;
    syv += y * v;
  }
  const det = n * (sxx * syy - sxy * sxy) - sx * (sx * syy - sxy * sy) + sy * (sx * sxy - sxx * sy);
  if (n === 0 || Math.abs(det) <= 1e-9 * n * sxx * syy) return null;
  const c0 =
    (sv * (sxx * syy - sxy * sxy) - sx * (sxv * syy - sxy * syv) + sy * (sxv * sxy - sxx * syv)) /
    det;
  const c1 =
    (n * (sxv * syy - sxy * syv) - sv * (sx * syy - sxy * sy) + sy * (sx * syv - sxv * sy)) / det;
  const c2 =
    (n * (sxx * syv - sxv * sxy) - sx * (sx * syv - sxv * sy) + sv * (sx * sxy - sxx * sy)) / det;
  return [c0, c1, c2];
}

/**
 * A square min (`all`) or max (`any`) filter of side `k`. Replicating the edge
 * pixels gives the same answer as clamping the window, since a repeated edge
 * pixel is already in it, so both are one pass of prefix sums per axis.
 */
function boxFilter(
  data: Uint8Array,
  width: number,
  height: number,
  k: number,
  all: boolean
): Uint8Array {
  const r = k >> 1;
  const rows = new Uint8Array(data.length);
  const prefix = new Int32Array(Math.max(width, height) + 1);
  const keep = (count: number, span: number) => (all ? count === span : count > 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) prefix[x + 1] = prefix[x] + data[y * width + x];
    for (let x = 0; x < width; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(width - 1, x + r);
      rows[y * width + x] = keep(prefix[hi + 1] - prefix[lo], hi - lo + 1) ? 1 : 0;
    }
  }
  const out = new Uint8Array(data.length);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) prefix[y + 1] = prefix[y] + rows[y * width + x];
    for (let y = 0; y < height; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(height - 1, y + r);
      out[y * width + x] = keep(prefix[hi + 1] - prefix[lo], hi - lo + 1) ? 1 : 0;
    }
  }
  return out;
}

const erode = (d: Uint8Array, w: number, h: number, k: number) => boxFilter(d, w, h, k, true);
const dilate = (d: Uint8Array, w: number, h: number, k: number) => boxFilter(d, w, h, k, false);

/** The morphology kernel: about a three-hundredth of the shorter side, odd, at least 3. */
export function kernelSize(width: number, height: number): number {
  const k = Math.max(3, Math.round(Math.min(width, height) / 300));
  return k % 2 === 0 ? k + 1 : k;
}

/** Width of the surface sample band: 2% of the shorter side, at least 8 pixels. */
export function bandWidth(width: number, height: number): number {
  return Math.max(8, Math.round(0.02 * Math.min(width, height)));
}

/**
 * Pixels of `region` within `band` of its edge or the frame's, minus `skip`,
 * thinned evenly to at most `limit`.
 */
function bandSamples(
  region: Uint8Array,
  skip: Uint8Array,
  width: number,
  height: number,
  band: number,
  limit: number
): number[] {
  const deep = erode(region, width, height, 2 * band + 1);
  const inBand: number[] = [];
  for (let y = 0; y < height; y++) {
    const rowDeep = y >= band && y < height - band;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (region[i] === 0 || skip[i] === 1) continue;
      if (rowDeep && x >= band && x < width - band && deep[i] === 1) continue;
      inBand.push(i);
    }
  }
  if (inBand.length <= limit) return inBand;
  const step = inBand.length / limit;
  return Array.from({ length: limit }, (_, k) => inBand[Math.floor(k * step)]);
}

/**
 * How far each usable pixel's colour is from the surface, 0 to 255: half the
 * lightness difference plus both colour differences, after the band's
 * lighting slope is taken out. Pixels outside `usable` score 0.
 */
export function colorScore(img: ImageDataLike, usable: Uint8Array, band: number[]): Uint8Array {
  const { width } = img;
  const n = img.width * img.height;
  const { L, a, b } = toLab(img);
  const plane = fitPlane(band, L, width);
  if (plane) {
    // Held at its level at the band's own centre, so the surface keeps its brightness.
    const at = band.reduce(
      (s, i) => {
        const x = i % width;
        return { x: s.x + x, y: s.y + (i - x) / width };
      },
      { x: 0, y: 0 }
    );
    const level = plane[0] + (plane[1] * at.x + plane[2] * at.y) / band.length;
    for (let i = 0; i < n; i++) {
      const x = i % width;
      const y = (i - x) / width;
      L[i] -= plane[0] + plane[1] * x + plane[2] * y - level;
    }
  }
  const refL = median(band.map((i) => L[i]));
  const refA = median(band.map((i) => a[i]));
  const refB = median(band.map((i) => b[i]));
  const score = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (usable[i] === 0) continue;
    const s = 0.5 * Math.abs(L[i] - refL) + Math.abs(a[i] - refA) + Math.abs(b[i] - refB);
    score[i] = Math.min(255, Math.round(s));
  }
  return score;
}

/** The score's cutoff: Otsu's plateau midpoint, scaled by the sensitivity. */
export function scoreThreshold(scores: Uint8Array, sensitivity = 0): number {
  const bias = 128 - Math.max(-127, Math.min(128, sensitivity));
  return Math.max(1, Math.min(254, Math.round((computeOtsuThreshold(scores) * bias) / 128)));
}

/**
 * Give back above-threshold pixels the opening erased, region by region: a
 * region returns when it touches exactly one tool's solid core, or no core and
 * exactly one kept piece. One touching two cores is a stray line between two
 * tools and stays out, as does a speck touching nothing.
 */
function restoreThin(
  above: Uint8Array,
  kept: Uint8Array,
  width: number,
  height: number,
  k: number
): Uint8Array {
  const n = width * height;
  const pieces = labelComponents({ width, height, data: kept });
  // A core holds a fully kept square of half-width k.
  const solid = erode(kept, width, height, 2 * k + 1);
  const isCore = new Uint8Array(pieces.components.length);
  for (let i = 0; i < n; i++) if (solid[i] === 1) isCore[pieces.labels[i]] = 1;

  const lost = new Uint8Array(n);
  for (let i = 0; i < n; i++) lost[i] = above[i] === 1 && kept[i] === 0 ? 1 : 0;
  const regions = labelComponents({ width, height, data: lost });
  const count = regions.components.length;
  // Up to two distinct labels per region: enough to tell one from many.
  const cores = new Int32Array(count * 2).fill(-1);
  const touched = new Int32Array(count * 2).fill(-1);
  const note = (slots: Int32Array, region: number, label: number) => {
    const at = region * 2;
    if (slots[at] === label || slots[at + 1] === label) return;
    if (slots[at] === -1) slots[at] = label;
    else if (slots[at + 1] === -1) slots[at + 1] = label;
  };
  for (let i = 0; i < n; i++) {
    if (lost[i] === 0) continue;
    const region = regions.labels[i];
    const x = i % width;
    const y = (i - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width || (dx === 0 && dy === 0)) continue;
        const q = ny * width + nx;
        if (kept[q] === 0) continue;
        const piece = pieces.labels[q];
        note(touched, region, piece);
        if (isCore[piece] === 1) note(cores, region, piece);
      }
    }
  }
  const filled = (slots: Int32Array, r: number) =>
    (slots[r * 2] !== -1 ? 1 : 0) + (slots[r * 2 + 1] !== -1 ? 1 : 0);
  const restore = new Uint8Array(count);
  for (let r = 0; r < count; r++) {
    const coreCount = filled(cores, r);
    restore[r] = coreCount === 1 || (coreCount === 0 && filled(touched, r) === 1) ? 1 : 0;
  }
  const out = new Uint8Array(kept);
  for (let i = 0; i < n; i++) if (lost[i] === 1 && restore[regions.labels[i]] === 1) out[i] = 1;
  return out;
}

/** The tools in a photo as one mask, each tool a separate region of it. */
export function segmentTools(img: ImageDataLike, options: ColorSegmentOptions = {}): Mask {
  const { width, height } = img;
  const n = width * height;
  const empty = { width, height, data: new Uint8Array(n) };
  if (n === 0) return empty;
  const k = kernelSize(width, height);

  const region = options.region
    ? fillPolygon(options.region, width, height)
    : new Uint8Array(n).fill(1);
  const skip = new Uint8Array(n);
  for (const poly of options.exclude ?? []) {
    const hole = fillPolygon(grown(poly, Math.max(2, k)), width, height);
    for (let i = 0; i < n; i++) skip[i] |= hole[i];
  }
  const usable = new Uint8Array(n);
  for (let i = 0; i < n; i++) usable[i] = region[i] & (skip[i] ^ 1);

  if (usesAlphaMask(img)) {
    const data = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      data[i] = usable[i] === 1 && img.data[i * 4 + 3] >= ALPHA_CUTOFF ? 1 : 0;
    }
    return { width, height, data };
  }

  const band = bandSamples(region, skip, width, height, bandWidth(width, height), MAX_BAND_SAMPLES);
  if (band.length === 0) return empty;
  const score = colorScore(img, usable, band);
  const inside: number[] = [];
  for (let i = 0; i < n; i++) if (usable[i] === 1) inside.push(Math.min(score[i], HISTOGRAM_CAP));
  const threshold = scoreThreshold(Uint8Array.from(inside), options.sensitivity);
  const above = new Uint8Array(n);
  for (let i = 0; i < n; i++) above[i] = usable[i] === 1 && score[i] >= threshold ? 1 : 0;

  const opened = dilate(erode(above, width, height, k), width, height, k);
  const closed = erode(dilate(opened, width, height, k), width, height, k);
  // The close can reach across an excluded marker's edge; keep it to usable pixels.
  for (let i = 0; i < n; i++) closed[i] &= usable[i];
  return { width, height, data: restoreThin(above, closed, width, height, k) };
}
