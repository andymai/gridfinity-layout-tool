/**
 * Stage 1: RGBA image → binary foreground mask.
 *
 * Grayscale (Rec. 601 luma) → threshold (Otsu by default) → foreground mask.
 * Polarity is inferred from the image border (the majority border class is
 * background), so a dark tool on white and a light tool on black both trace.
 * Images with real transparency (e.g. an iOS subject-lift cutout) are masked
 * directly by alpha.
 */

import type { ImageDataLike, Mask, TraceOptions } from './types';

const DEFAULT_ALPHA_THRESHOLD = 128;
/** Fraction of translucent pixels above which alpha drives the mask. */
const ALPHA_MODE_FRACTION = 0.05;

export function toGrayscale(img: ImageDataLike): Uint8Array {
  const { data } = img;
  const n = img.width * img.height;
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    gray[i] = (data[o] * 299 + data[o + 1] * 587 + data[o + 2] * 114) / 1000;
  }
  return gray;
}

/**
 * Per-pixel colorfulness: max−min of the RGB channels (already 0–255). A neutral
 * grey/metal surface scores ~0; a saturated one scores high. Lets the tracer
 * separate a color-neutral card from a colored background that matches it in
 * brightness — invisible to {@link toGrayscale}.
 */
export function toChroma(img: ImageDataLike): Uint8Array {
  const { data } = img;
  const n = img.width * img.height;
  const chroma = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    chroma[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  return chroma;
}

/** Otsu's method: the 0–255 cutoff maximizing between-class variance. */
export function computeOtsuThreshold(gray: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  // Track the full plateau of thresholds that tie on max variance. A cleanly
  // separated (bimodal) image ties across the whole gap between the two modes;
  // returning the plateau midpoint puts the cut between them instead of at an
  // edge, where a strict `<` comparison would misclassify the object.
  let tLow = 127;
  let tHigh = 127;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      tLow = t;
      tHigh = t;
    } else if (between === maxVar) {
      tHigh = t;
    }
  }
  return Math.floor((tLow + tHigh) / 2);
}

function fractionTranslucent(img: ImageDataLike): number {
  const { data } = img;
  const n = img.width * img.height;
  let translucent = 0;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] < 250) translucent++;
  }
  return n === 0 ? 0 : translucent / n;
}

/**
 * True when the image carries enough real transparency that alpha drives the
 * mask outright — in which case the luma/chroma `channel` choice is moot.
 */
export function usesAlphaMask(img: ImageDataLike): boolean {
  return fractionTranslucent(img) > ALPHA_MODE_FRACTION;
}

/** True when border pixels are, on balance, darker than the threshold. */
function borderIsDark(gray: Uint8Array, width: number, height: number, threshold: number): boolean {
  let dark = 0;
  let count = 0;
  const sample = (x: number, y: number): void => {
    count++;
    if (gray[y * width + x] < threshold) dark++;
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y);
    sample(width - 1, y);
  }
  return count > 0 && dark * 2 > count;
}

export function buildMask(img: ImageDataLike, options: TraceOptions = {}): Mask {
  const { width, height } = img;
  const n = width * height;
  const data = new Uint8Array(n);

  // Alpha-driven mask when the image carries real transparency.
  if (usesAlphaMask(img)) {
    const cutoff = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
    for (let i = 0; i < n; i++) {
      const fg = img.data[i * 4 + 3] >= cutoff;
      data[i] = (options.invert ? !fg : fg) ? 1 : 0;
    }
    return { width, height, data };
  }

  const channel = options.channel === 'chroma' ? toChroma(img) : toGrayscale(img);
  const threshold = options.threshold ?? computeOtsuThreshold(channel);
  // The object is whichever side the border is NOT.
  const foregroundIsDark = !borderIsDark(channel, width, height, threshold);

  for (let i = 0; i < n; i++) {
    const isDark = channel[i] < threshold;
    const fg = foregroundIsDark ? isDark : !isDark;
    data[i] = (options.invert ? !fg : fg) ? 1 : 0;
  }
  return { width, height, data };
}
