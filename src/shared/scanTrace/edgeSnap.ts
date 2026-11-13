/**
 * Move a traced outline onto the edge it traced, to a fraction of a pixel.
 *
 * A mask puts the outline where a score crosses one threshold for the whole
 * photo. On a blurred edge that crossing sits outside a tool that stands out
 * strongly and inside one that stands out weakly, by up to a pixel either
 * way, and a traced mask adds its own staircase. Here each point of the
 * outline is judged alone: along its normal, the edge is the steepest fall in
 * the score.
 *
 * Colour is scored as the segmenter scores it, lightness at half weight. A
 * cast shadow beside the tool is then a smaller and softer step than the
 * tool's own edge, and the steepest fall stays on the tool.
 *
 * Where on that fall the edge lies is read in linear light, not from the
 * score. A lens mixes light before the camera encodes it, so a pixel half on
 * a dark tool and half on white paper is far brighter than half way between
 * their pixel values. The half-way pixel value lies inside a dark tool, by
 * about half the blur's width, and that much would come off every side.
 */

import { polylineCrosses } from '@/shared/utils/outlineSegments';
import type { ImageDataLike, Point } from './types';
import { toLab } from './colorSegment';

export interface EdgeSnapOptions {
  /** How far a point may move along its normal, in pixels. */
  readonly reach?: number;
  /** The ring is a hole: the tool is outside it and the surface inside. */
  readonly hole?: boolean;
}

const DEFAULT_REACH = 4;
/** Spacing of the points the outline is judged at, in pixels. */
const SPACING = 1;
/** Spacing of the samples along each normal, in pixels. */
const STEP = 0.25;
/** A step smaller than this, in score levels, is noise or a tool the colour of its surface. */
const MIN_CONTRAST = 6;
/** Linear-light colours closer than this, squared, are one colour with no step to place. */
const MIN_LIGHT_STEP = 1e-4;
/**
 * How far past a step its two levels may be looked for, in pixels: far enough
 * to reach level ground either side of a soft-focus edge.
 */
const PLATEAU = 5;
/** The score counts as level once it changes by less than this share of the step's steepest fall. */
const LEVEL_SHARE = 0.06;
/** A step under this share of the ring's usual steepness is not the tool's edge. */
const WEAK_SHARE = 0.35;
/** Points either side that set a point's tangent, so a staircase does not tilt it. */
const TANGENT_SPAN = 3;
/** Points either side averaged into the line the edge is looked for from. */
const BASE_SPAN = 2;
/** Points either side whose edges say which of several crossings is this point's. */
const AGREE_SPAN = 8;

/** A fall in the score along a normal: where it is half way down, and how steep it is. */
interface Step {
  readonly at: number;
  readonly steep: number;
}

const LINEAR = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

function resample(ring: readonly Point[], spacing: number): Point[] {
  const n = ring.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += Math.hypot(ring[(i + 1) % n].x - ring[i].x, ring[(i + 1) % n].y - ring[i].y);
  }
  const count = Math.max(8, Math.round(total / spacing));
  const step = total / count;
  const out: Point[] = [];
  let walked = 0;
  let next = 0;
  for (let i = 0; i < n && out.length < count; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    while (next <= walked + length && out.length < count) {
      const t = length > 0 ? (next - walked) / length : 0;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      next += step;
    }
    walked += length;
  }
  return out;
}

function signedArea(ring: readonly Point[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((p, q) => p - q);
  return sorted[sorted.length >> 1];
}

/**
 * `ring` moved onto the tool's edge in `image`, as points about a pixel
 * apart. A point with no clear edge within reach stays where it was, so a
 * tool the colour of its surface keeps the outline its mask gave it.
 */
export function snapToEdges(
  image: ImageDataLike,
  ring: readonly Point[],
  options: EdgeSnapOptions = {}
): Point[] {
  if (ring.length < 3) return ring.slice();
  const reach = options.reach ?? DEFAULT_REACH;
  const traced = resample(ring, SPACING);
  const n = traced.length;
  // A mask's outline carries spurs a few pixels long, where a shadow or a
  // glint crossed the threshold. Normals taken from it point every way at a
  // spur, so the edge is looked for from the outline averaged along itself.
  const points = traced.map((_, i) => {
    let x = 0;
    let y = 0;
    for (let k = -BASE_SPAN; k <= BASE_SPAN; k++) {
      const p = traced[(i + k + n) % n];
      x += p.x;
      y += p.y;
    }
    return { x: x / (2 * BASE_SPAN + 1), y: y / (2 * BASE_SPAN + 1) };
  });
  // Normals point from the tool to the surface: out of an outline, into a hole.
  const turn = (signedArea(points) >= 0 ? 1 : -1) * (options.hole ? -1 : 1);
  const normals = points.map((_, i) => {
    const a = points[(i - TANGENT_SPAN + n) % n];
    const b = points[(i + TANGENT_SPAN) % n];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (turn * (b.y - a.y)) / length, y: (-turn * (b.x - a.x)) / length };
  });

  const margin = Math.ceil(reach + PLATEAU) + 3;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - margin);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - margin);
  const x1 = Math.min(image.width - 1, Math.ceil(Math.max(...xs)) + margin);
  const y1 = Math.min(image.height - 1, Math.ceil(Math.max(...ys)) + margin);
  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  if (width < 2 || height < 2) return traced;
  const crop = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = ((y + y0) * image.width + x0) * 4;
    crop.set(image.data.subarray(from, from + width * 4), y * width * 4);
  }
  const lab = toLab({ width, height, data: crop });
  const light = [0, 1, 2].map((channel) => {
    const field = new Float32Array(width * height);
    for (let i = 0; i < field.length; i++) field[i] = LINEAR[crop[i * 4 + channel]];
    return field;
  });

  const at = (field: Float32Array, x: number, y: number): number => {
    const fx = Math.min(width - 1.001, Math.max(0, x - x0));
    const fy = Math.min(height - 1.001, Math.max(0, y - y0));
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const i = iy * width + ix;
    return (
      field[i] * (1 - tx) * (1 - ty) +
      field[i + 1] * tx * (1 - ty) +
      field[i + width] * (1 - tx) * ty +
      field[i + width + 1] * tx * ty
    );
  };

  // The surface, as the colour just past reach all the way round. A median,
  // so the part of the ring that faces a neighbour or its own bay does not move it.
  const beyond = points.map((p, i) => ({
    x: p.x + normals[i].x * (reach + 2),
    y: p.y + normals[i].y * (reach + 2),
  }));
  const surface = {
    L: median(beyond.map((p) => at(lab.L, p.x, p.y))),
    a: median(beyond.map((p) => at(lab.a, p.x, p.y))),
    b: median(beyond.map((p) => at(lab.b, p.x, p.y))),
  };
  const score = (x: number, y: number): number =>
    0.5 * Math.abs(at(lab.L, x, y) - surface.L) +
    Math.abs(at(lab.a, x, y) - surface.a) +
    Math.abs(at(lab.b, x, y) - surface.b);

  // Steps are looked for within reach; the profile runs on past it so a step
  // at the end of reach still has both its levels in view.
  const within = Math.round(reach / STEP);
  const plateau = Math.round(PLATEAU / STEP);
  const samples = within + plateau;
  const length = 2 * samples + 1;
  const candidates: Step[][] = [];
  const profile = new Float64Array(length);
  const smooth = new Float64Array(length);
  const lit = [0, 1, 2].map(() => new Float64Array(length));
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const normal = normals[i];
    for (let k = -samples; k <= samples; k++) {
      const x = p.x + normal.x * k * STEP;
      const y = p.y + normal.y * k * STEP;
      profile[k + samples] = score(x, y);
      for (let c = 0; c < 3; c++) lit[c][k + samples] = at(light[c], x, y);
    }
    for (let k = 0; k < length; k++) {
      smooth[k] =
        (profile[Math.max(0, k - 1)] + profile[k] + profile[Math.min(length - 1, k + 1)]) / 3;
    }
    const fall = (k: number): number =>
      smooth[Math.max(0, k - 2)] - smooth[Math.min(length - 1, k + 2)];
    const found: Step[] = [];
    for (let k = plateau; k < length - plateau; k++) {
      const steep = fall(k);
      if (steep <= 0 || steep < fall(k - 1) || steep <= fall(k + 1)) continue;
      // Out from the step each way until the score runs level. A fixed
      // distance would stop short on a blurred edge, and short by a different
      // amount each side, since the score's steepest fall is not the light's.
      let inside = k;
      let outside = k;
      while (inside > k - plateau && smooth[inside - 2] - smooth[inside] > LEVEL_SHARE * steep) {
        inside--;
      }
      while (outside < k + plateau && smooth[outside] - smooth[outside + 2] > LEVEL_SHARE * steep) {
        outside++;
      }
      if (smooth[inside] - smooth[outside] < MIN_CONTRAST) continue;
      // How much of the tool's light each sample holds, 1 on the tool to 0 off it.
      // Each level is a mean round its extreme: the extreme sample alone is the
      // one noise pushed farthest, and would put the half-way point inside.
      const level = (channel: Float64Array, around: number, from: number, to: number): number => {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(from, around - 2); j <= Math.min(to, around + 2); j++) {
          sum += channel[j];
          count++;
        }
        return sum / count;
      };
      const tool = lit.map((channel) => level(channel, inside, 0, inside + 2));
      const surfaceLight = lit.map((channel) => level(channel, outside, outside - 2, length - 1));
      const span = tool.reduce((sum, v, c) => sum + (v - surfaceLight[c]) ** 2, 0);
      if (span < MIN_LIGHT_STEP) continue;
      const share = (j: number): number =>
        lit.reduce(
          (sum, channel, c) => sum + (channel[j] - surfaceLight[c]) * (tool[c] - surfaceLight[c]),
          0
        ) / span;
      let crossing = Number.NaN;
      for (let j = inside; j < outside; j++) {
        const here = share(j);
        const there = share(j + 1);
        if (here < 0.5 || there >= 0.5) continue;
        const candidate = j + (here - 0.5) / (here - there);
        if (Number.isNaN(crossing) || Math.abs(candidate - k) < Math.abs(crossing - k)) {
          crossing = candidate;
        }
      }
      if (!Number.isNaN(crossing)) found.push({ at: (crossing - samples) * STEP, steep });
    }
    candidates.push(found);
  }

  const nearest = (found: readonly Step[], to: number): number =>
    found.reduce(
      (best, c) => (Math.abs(c.at - to) < Math.abs(best - to) ? c.at : best),
      found[0].at
    );
  const around = (values: Float64Array, i: number, span: number): number[] => {
    const near: number[] = [];
    for (let k = -span; k <= span; k++) {
      const value = values[(i + k + n) % n];
      if (!Number.isNaN(value)) near.push(value);
    }
    return near;
  };
  // Where the tool's own edge is faint, a line in the surface's grain can be
  // the steepest thing in reach. A step much weaker than this tool's usual
  // edge is not taken for it.
  const usual = median(
    candidates
      .filter((found) => found.length > 0)
      .map((found) => Math.max(...found.map((c) => c.steep)))
  );
  for (let i = 0; i < n; i++) {
    candidates[i] = candidates[i].filter((c) => c.steep >= WEAK_SHARE * usual);
  }
  // A tool's edge is sharp where a shadow's is soft, so each point starts
  // from its steepest step. Then each takes the step its neighbours agree on.
  const first = Float64Array.from(candidates, (found) =>
    found.length > 0
      ? found.reduce((best, c) => (c.steep > best.steep ? c : best), found[0]).at
      : Number.NaN
  );
  const agreed = Float64Array.from(candidates, (found, i) => {
    if (found.length === 0) return Number.NaN;
    const near = around(first, i, AGREE_SPAN);
    return nearest(found, near.length > 0 ? median(near) : 0);
  });
  // One point's edge can be a glint or a speck; its neighbours agree with each
  // other. A point with too few neighbours that found an edge has none.
  const settled = Float64Array.from(agreed, (_, i) => {
    const near = around(agreed, i, 2);
    return near.length >= 3 ? median(near) : Number.NaN;
  });
  const moved = (share: number): Point[] =>
    points.map((p, i) => {
      const [before, here, after] = [settled[(i - 1 + n) % n], settled[i], settled[(i + 1) % n]];
      // With no edge to go by, the point stays where the mask put it.
      if (Number.isNaN(here)) return traced[i];
      const offset =
        (share *
          ((Number.isNaN(before) ? here : before) +
            2 * here +
            (Number.isNaN(after) ? here : after))) /
        4;
      return { x: p.x + normals[i].x * offset, y: p.y + normals[i].y * offset };
    });
  // A ring that crosses itself is cut as its bounding box, so a snap that
  // folds one gives way: to half the move, then to the outline as traced.
  for (const share of [1, 0.5]) {
    const snapped = moved(share);
    if (!polylineCrosses(snapped)) return snapped;
  }
  return traced;
}
