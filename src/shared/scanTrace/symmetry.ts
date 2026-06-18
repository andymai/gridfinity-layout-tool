/**
 * Gated bilateral symmetrization of a traced outline.
 *
 * Manufactured tools (game controllers, calipers, pliers) are usually mirror-
 * symmetric, but a phone-photo silhouette is slightly lopsided from lighting and
 * segmentation noise. We find the dominant mirror axis (a principal axis of the
 * shape), SCORE how symmetric the outline already is by reflecting it and
 * measuring overlap (IoU), and only average the two halves when the score is
 * high. A genuinely asymmetric tool scores low and is left untouched — the
 * regularization is never applied blindly.
 */

import type { Point } from './types';

const DEFAULT_MIN_SCORE = 0.9;
const RESAMPLE_N = 160;
const RASTER = 72;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Resample a closed polygon to `n` points spaced evenly by arc length. */
function resampleClosed(pts: readonly Point[], n: number): Point[] {
  const m = pts.length;
  if (m < 3) return pts.slice();
  let total = 0;
  for (let i = 0; i < m; i++) total += dist(pts[i], pts[(i + 1) % m]);
  if (total === 0) return pts.slice();
  const step = total / n;
  const out: Point[] = [];
  let seg = 0;
  let segStart = pts[0];
  let segEnd = pts[1 % m];
  let segLen = dist(segStart, segEnd);
  let walked = 0;
  for (let k = 0; k < n; k++) {
    const target = k * step;
    while (walked + segLen < target && seg < m) {
      walked += segLen;
      seg++;
      segStart = pts[seg % m];
      segEnd = pts[(seg + 1) % m];
      segLen = dist(segStart, segEnd);
    }
    const t = segLen > 0 ? (target - walked) / segLen : 0;
    out.push({
      x: segStart.x + (segEnd.x - segStart.x) * t,
      y: segStart.y + (segEnd.y - segStart.y) * t,
    });
  }
  return out;
}

function centroid(pts: readonly Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/** Two principal-axis angles (major, then perpendicular) from the point cloud. */
function principalAngles(pts: readonly Point[], c: Point): [number, number] {
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const major = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return [major, major + Math.PI / 2];
}

function reflect(p: Point, c: Point, angle: number): Point {
  // Reflect across the line through c at `angle`.
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const cos2 = Math.cos(2 * angle);
  const sin2 = Math.sin(2 * angle);
  return { x: c.x + dx * cos2 + dy * sin2, y: c.y + dx * sin2 - dy * cos2 };
}

function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Overlap (IoU) of the polygon and its reflection, by rasterizing a small grid. */
function reflectionIoU(pts: readonly Point[], c: Point, angle: number): number {
  const refl = pts.map((p) => reflect(p, c, angle));
  // Raster over the union of both shapes' bounds — sampling only the original's
  // box would miss reflected area outside it, under-counting the union and
  // inflating the score for an off-centre axis.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of [...pts, ...refl]) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  let inter = 0;
  let union = 0;
  for (let gy = 0; gy < RASTER; gy++) {
    for (let gx = 0; gx < RASTER; gx++) {
      const sample = { x: minX + ((gx + 0.5) / RASTER) * w, y: minY + ((gy + 0.5) / RASTER) * h };
      const a = pointInPolygon(sample, pts);
      const b = pointInPolygon(sample, refl);
      if (a || b) union++;
      if (a && b) inter++;
    }
  }
  return union === 0 ? 0 : inter / union;
}

/** Best mirror axis (through the centroid) and how symmetric the outline is (0–1). */
export function mirrorSymmetry(pts: readonly Point[]): {
  angle: number;
  score: number;
  center: Point;
} {
  const sampled = resampleClosed(pts, RESAMPLE_N);
  const c = centroid(sampled);
  let best = { angle: 0, score: -1, center: c };
  for (const base of principalAngles(sampled, c)) {
    for (let d = -0.1; d <= 0.1 + 1e-9; d += 0.02) {
      const angle = base + d;
      const score = reflectionIoU(sampled, c, angle);
      if (score > best.score) best = { angle, score, center: c };
    }
  }
  return best;
}

function closestOnPolygon(p: Point, poly: readonly Point[]): Point {
  let best = poly[0];
  let bestD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t =
      lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = dist(p, q);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/** Average each point with the nearest point on the reflected outline. */
function symmetrize(pts: readonly Point[], angle: number, center: Point): Point[] {
  const sampled = resampleClosed(pts, RESAMPLE_N);
  const reflected = sampled.map((p) => reflect(p, center, angle));
  return sampled.map((p) => {
    const mirror = closestOnPolygon(p, reflected);
    return { x: (p.x + mirror.x) / 2, y: (p.y + mirror.y) / 2 };
  });
}

/**
 * Symmetrize the outline only if it already reads as mirror-symmetric (score ≥
 * `minScore`). Otherwise return it unchanged — never force symmetry on a tool
 * that genuinely isn't.
 */
export function symmetrizeIfRegular(pts: readonly Point[], minScore = DEFAULT_MIN_SCORE): Point[] {
  if (pts.length < 8) return pts.slice();
  const { angle, score, center } = mirrorSymmetry(pts);
  if (score < minScore) return pts.slice();
  return symmetrize(pts, angle, center);
}
