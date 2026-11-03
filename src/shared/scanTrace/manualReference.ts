/**
 * Size references the user marks by hand, for a photo with nothing the
 * detectors recognise: a ruler drawn between two points a known distance
 * apart, or the four corners of a sheet of paper.
 */

import { err, ok, type Result } from '@/core/result';
import type { Point } from './types';
import type { SceneReference } from './traceScene';
import { solveHomography } from './perspective';

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

/** Focal lengths outside this share of the photo's longer side are a misread. */
const FOCAL_SHARE_RANGE = [0.25, 4] as const;

/**
 * Lenses a photo could come from, as a share of its longer side: an
 * ultra-wide to a short telephoto.
 */
const LENS_SHARE_RANGE = [0.4, 1.5] as const;

const UNIT_SQUARE: [Point, Point, Point, Point] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/**
 * Whether the marked sheet's TL→TR side is its long one, taking the principal
 * point at the photo's middle, or null when the photo cannot say.
 *
 * The two sides are the homography's first two columns, measured through the
 * camera. The focal length comes from their being square to each other. When
 * an edge pair stays parallel in the photo that gives no answer, and the
 * sides are compared at both ends of the lens range instead: a shot tilted
 * gently reads the same through any lens, while one tilted steeply on that
 * one axis can read either way, and guessing would stretch every tool.
 */
function longSideFirst(
  corners: readonly [Point, Point, Point, Point],
  frame: { readonly width: number; readonly height: number }
): boolean | null {
  const [tl, tr, , bl] = corners;
  const looks = Math.hypot(tr.x - tl.x, tr.y - tl.y) >= Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const h = solveHomography(UNIT_SQUARE, corners);
  if (!h) return looks;
  const cx = frame.width / 2;
  const cy = frame.height / 2;
  const long = Math.max(frame.width, frame.height);
  const u = (col: 0 | 1) => [h[col] - cx * h[6 + col], h[3 + col] - cy * h[6 + col], h[6 + col]];
  const [a, b] = [u(0), u(1)];
  const norm = (v: number[], f2: number) => (v[0] ** 2 + v[1] ** 2) / f2 + v[2] ** 2;
  const wideAt = (f2: number) => norm(a, f2) >= norm(b, f2);
  const solved = -(a[0] * b[0] + a[1] * b[1]) / (a[2] * b[2]);
  const [lo, hi] = FOCAL_SHARE_RANGE;
  if (Number.isFinite(solved) && solved >= (lo * long) ** 2 && solved <= (hi * long) ** 2) {
    return wideAt(solved);
  }
  const [wide, tele] = LENS_SHARE_RANGE.map((share) => wideAt((share * long) ** 2));
  return wide === tele ? wide : null;
}

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
 * Why marked corners make no sheet: they do not bound one (not four finite
 * points, folded in on themselves, or too small to measure by), or the photo
 * is too steep to tell the sheet's long side from its short one.
 */
export type PaperError = 'notSheet' | 'tooSteep';

/**
 * The sheet whose corners are `points` in a photo `frame` wide and high.
 *
 * Which marked edge is the sheet's long side comes from the camera's view of
 * the quad, not from how long each edge looks: tilted far enough, the long
 * side of a sheet shows shorter than its short side, and taking the look at
 * its word would stretch every tool on it.
 */
export function paperReference(
  points: readonly Point[],
  size: PaperSize,
  frame: { readonly width: number; readonly height: number }
): Result<SceneReference, PaperError> {
  if (points.length !== 4 || !points.every(finite)) return err('notSheet');
  const corners = clockwise(points);
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const p = corners[i];
    const q = corners[(i + 1) % 4];
    const r = corners[(i + 2) % 4];
    // Every turn the same way round, or the quad is dented and no sheet.
    if ((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) <= 0) return err('notSheet');
    area += p.x * q.y - q.x * p.y;
  }
  if (area / 2 < MIN_PAPER_AREA_PX) return err('notSheet');
  const wide = longSideFirst(corners, frame);
  if (wide === null) return err('tooSteep');
  const { longMm, shortMm } = PAPER_SIZES[size];
  return ok({
    kind: 'paper',
    paper: { corners, widthMm: wide ? longMm : shortMm, heightMm: wide ? shortMm : longMm },
  });
}
