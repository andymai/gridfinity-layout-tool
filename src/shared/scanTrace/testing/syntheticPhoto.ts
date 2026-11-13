/**
 * Synthetic photos with a known answer, for measuring how far a traced
 * outline sits from the edge it traced.
 *
 * Shapes are drawn by coverage (supersampled), then blurred as a lens would,
 * so an edge falls between pixels the way it does in a photo. Light mixes
 * before a camera encodes it, so the drawing and the blur are done in linear
 * light and encoded to sRGB last: the true edge is where the light, not the
 * pixel value, is half way.
 */

import type { ImageDataLike, Point } from '../types';

export type Rgb = readonly [number, number, number];

export interface Layer {
  /** A closed polygon in image pixels. */
  readonly outline: readonly Point[];
  readonly colour: Rgb;
  /** 0 to 1; below 1 the layer darkens what is under it, as a shadow does. */
  readonly opacity?: number;
  /** Extra blur for this layer alone, in pixels: a soft shadow's edge. */
  readonly soften?: number;
}

export interface PhotoSpec {
  readonly width: number;
  readonly height: number;
  readonly surface: Rgb;
  readonly layers: readonly Layer[];
  /** Lens blur, as a Gaussian sigma in pixels. */
  readonly blur?: number;
  /** Peak sensor noise, in levels either way. */
  readonly noise?: number;
}

const SUPER = 4;

const toLinear = (level: number): number => {
  const c = level / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (light: number): number => {
  const c = Math.min(1, Math.max(0, light));
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
};

function insidePolygon(x: number, y: number, poly: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Share of each pixel that `poly` covers. A pixel is the unit square centred on its coordinate. */
function coverage(poly: readonly Point[], width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1);
  const x1 = Math.min(width - 1, Math.ceil(Math.max(...xs)) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1);
  const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let hits = 0;
      for (let sy = 0; sy < SUPER; sy++) {
        for (let sx = 0; sx < SUPER; sx++) {
          if (insidePolygon(x - 0.5 + (sx + 0.5) / SUPER, y - 0.5 + (sy + 0.5) / SUPER, poly)) {
            hits++;
          }
        }
      }
      out[y * width + x] = hits / (SUPER * SUPER);
    }
  }
  return out;
}

function gaussian(field: Float32Array, width: number, height: number, sigma: number): Float32Array {
  if (!(sigma > 0)) return field;
  const radius = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) =>
    Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma))
  );
  const total = kernel.reduce((s, k) => s + k, 0);
  const pass = (src: Float32Array, dx: number, dy: number): Float32Array => {
    const dst = new Float32Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = Math.min(width - 1, Math.max(0, x + k * dx));
          const yy = Math.min(height - 1, Math.max(0, y + k * dy));
          sum += src[yy * width + xx] * kernel[k + radius];
        }
        dst[y * width + x] = sum / total;
      }
    }
    return dst;
  };
  return pass(pass(field, 1, 0), 0, 1);
}

export function renderPhoto(spec: PhotoSpec): ImageDataLike {
  const { width, height, surface, layers, blur = 0, noise = 0 } = spec;
  const n = width * height;
  const channels = [0, 1, 2].map((c) => new Float32Array(n).fill(toLinear(surface[c])));
  for (const layer of layers) {
    const alpha = gaussian(
      coverage(layer.outline, width, height),
      width,
      height,
      layer.soften ?? 0
    );
    const opacity = layer.opacity ?? 1;
    for (let c = 0; c < 3; c++) {
      const channel = channels[c];
      for (let i = 0; i < n; i++) {
        const a = alpha[i] * opacity;
        channel[i] = channel[i] * (1 - a) + toLinear(layer.colour[c]) * a;
      }
    }
  }
  const blurred = channels.map((channel) => gaussian(channel, width, height, blur));
  const data = new Uint8ClampedArray(n * 4);
  let seed = 12345;
  const jitter = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff - 0.5) * 2 * noise;
  };
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      data[i * 4 + c] = toSrgb(blurred[c][i]) + (noise > 0 ? jitter() : 0);
    }
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t =
    lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from `p` to the boundary of `poly`, positive outside it and negative inside. */
export function signedDistance(p: Point, poly: readonly Point[]): number {
  let least = Infinity;
  for (let i = 0; i < poly.length; i++) {
    least = Math.min(least, toSegment(p, poly[i], poly[(i + 1) % poly.length]));
  }
  return insidePolygon(p.x, p.y, poly) ? -least : least;
}

/** Points along a closed polygon, about `step` apart. */
export function sampleRing(poly: readonly Point[], step: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < count; k++) {
      out.push({ x: a.x + ((b.x - a.x) * k) / count, y: a.y + ((b.y - a.y) * k) / count });
    }
  }
  return out;
}

export interface OutlineError {
  /** Mean signed distance of the traced outline from the true edge; positive is oversize. */
  readonly bias: number;
  readonly meanAbs: number;
  readonly p95: number;
  /** Farthest any part of the true edge lies from the traced outline: a feature lost. */
  readonly missed: number;
}

/** How far `traced` sits from `truth`, both closed polygons in the same units. */
export function outlineError(traced: readonly Point[], truth: readonly Point[]): OutlineError {
  const perimeter = traced.reduce(
    (s, p, i) =>
      s +
      Math.hypot(p.x - traced[(i + 1) % traced.length].x, p.y - traced[(i + 1) % traced.length].y),
    0
  );
  const step = Math.max(perimeter / 2000, 1e-3);
  const offsets = sampleRing(traced, step).map((p) => signedDistance(p, truth));
  const abs = offsets.map(Math.abs).sort((a, b) => a - b);
  const missed = Math.max(
    ...sampleRing(truth, step).map((p) => Math.abs(signedDistance(p, traced)))
  );
  return {
    bias: offsets.reduce((s, d) => s + d, 0) / offsets.length,
    meanAbs: abs.reduce((s, d) => s + d, 0) / abs.length,
    p95: abs[Math.floor(abs.length * 0.95)],
    missed,
  };
}
