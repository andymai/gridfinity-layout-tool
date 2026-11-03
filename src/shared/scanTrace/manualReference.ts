/**
 * Size references the user marks by hand, for a photo with nothing the
 * detectors recognise: a ruler drawn between two points a known distance
 * apart, or the four corners of a sheet of paper.
 */

import type { Point } from './types';
import type { SceneReference } from './traceScene';

/** Sheet sizes paper can be marked as, long side first. */
export const PAPER_SIZES = {
  a4: { longMm: 297, shortMm: 210 },
  letter: { longMm: 279.4, shortMm: 215.9 },
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;

/** Shortest ruler taken, in image pixels: two clicks closer than this are a slip. */
export const MIN_RULER_PX = 10;

/** Smallest marked sheet taken, in square image pixels. */
const MIN_PAPER_AREA_PX = 2500;

const finite = (p: Point): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

/** A ruler from `a` to `b` that is `lengthMm` long, or null when either is unusable. */
export function rulerReference(a: Point, b: Point, lengthMm: number): SceneReference | null {
  if (!finite(a) || !finite(b) || !Number.isFinite(lengthMm) || lengthMm <= 0) return null;
  if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_RULER_PX) return null;
  return { kind: 'ruler', ruler: { a, b, lengthMm } };
}

/**
 * Four points clockwise on screen, starting nearest the top left, whatever
 * order they were clicked in. Clockwise matters: the homography maps them
 * onto the sheet's corners in that order, and the other way round would
 * mirror every tool on it.
 */
function clockwise(points: readonly Point[]): [Point, Point, Point, Point] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  // Image y runs down, so a rising angle turns clockwise on screen.
  const ring = [...points].sort(
    (p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx)
  );
  const start = ring.reduce(
    (best, p, i) => (p.x + p.y < ring[best].x + ring[best].y ? i : best),
    0
  );
  return [0, 1, 2, 3].map((k) => ring[(start + k) % 4]) as [Point, Point, Point, Point];
}

/**
 * The sheet whose corners are `points`, or null when they do not bound one:
 * not four finite points, folded in on itself, or too small to measure by.
 */
export function paperReference(points: readonly Point[], size: PaperSize): SceneReference | null {
  if (points.length !== 4 || !points.every(finite)) return null;
  const corners = clockwise(points);
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const p = corners[i];
    const q = corners[(i + 1) % 4];
    const r = corners[(i + 2) % 4];
    // Every turn the same way round, or the quad is dented and no sheet.
    if ((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) <= 0) return null;
    area += p.x * q.y - q.x * p.y;
  }
  if (area / 2 < MIN_PAPER_AREA_PX) return null;
  return { kind: 'paper', paper: { corners, ...PAPER_SIZES[size] } };
}
