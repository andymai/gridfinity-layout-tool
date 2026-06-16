/**
 * Reduce a traced contour to its four corners and score how rectangle-like it
 * is. A bank card scores near 1 (its contour hugs a 4-sided polygon); an
 * irregular tool scores low. That fitness is what lets the detector pick the
 * card out of a photo that also contains the tool.
 */

import type { Point } from './types';

export interface Quad {
  /** Corners ordered clockwise from top-left: [TL, TR, BR, BL]. */
  readonly corners: readonly [Point, Point, Point, Point];
  /** Fraction of contour points lying on the quad perimeter (0–1). */
  readonly fitness: number;
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Perpendicular signed distance of p from the line through a→b. */
function signedLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** Distance from p to the segment a→b (clamped at the endpoints). */
function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Order four points clockwise starting at the top-left corner. */
export function orderCorners(pts: readonly Point[]): [Point, Point, Point, Point] {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  const ring = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );

  let startIdx = 0;
  let best = Infinity;
  ring.forEach((p, i) => {
    if (p.x + p.y < best) {
      best = p.x + p.y;
      startIdx = i;
    }
  });

  const tl = ring[startIdx];
  const n1 = ring[(startIdx + 1) % 4];
  const n2 = ring[(startIdx + 3) % 4];
  const br = ring[(startIdx + 2) % 4];
  // The more-rightward neighbor of TL is TR; the other is BL (keeps winding CW).
  const tr = n1.x >= n2.x ? n1 : n2;
  const bl = n1.x >= n2.x ? n2 : n1;
  return [tl, tr, br, bl];
}

type Vec3 = readonly [number, number, number];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Recover the TRUE aspect ratio (long/short, ≥1) of a rectangle from its
 * perspective image, given the principal point and assuming square pixels.
 * He & Zhang's method (the image-of-the-absolute-conic constraint) — this is
 * angle-invariant, so a tilted card still reads ~1.586. Returns null if the
 * geometry is degenerate.
 *
 * Corners must be ordered [TL, TR, BR, BL].
 */
export function estimateRectAspect(
  corners: readonly [Point, Point, Point, Point],
  principalX: number,
  principalY: number
): number | null {
  const u0 = principalX;
  const v0 = principalY;
  // The He–Zhang formula labels corners in Z-order (m1=TL, m2=TR, m3=BL,
  // m4=BR) so that m1 and m4 are diagonally opposite.
  const [tl, tr, br, bl] = corners;
  const m1: Vec3 = [tl.x, tl.y, 1];
  const m2: Vec3 = [tr.x, tr.y, 1];
  const m3: Vec3 = [bl.x, bl.y, 1];
  const m4: Vec3 = [br.x, br.y, 1];

  const d2 = dot3(cross3(m2, m4), m3);
  const d3 = dot3(cross3(m3, m4), m2);

  // Fronto-parallel (parallel edges in the image) → the image edge ratio is
  // already the true aspect; the projective solve below is degenerate there.
  const topLen = Math.hypot(m2[0] - m1[0], m2[1] - m1[1]);
  const leftLen = Math.hypot(m3[0] - m1[0], m3[1] - m1[1]);
  const edgeAspect = topLen >= leftLen ? topLen / leftLen : leftLen / topLen;
  if (Math.abs(d2) < 1e-9 || Math.abs(d3) < 1e-9) {
    return Number.isFinite(edgeAspect) ? edgeAspect : null;
  }

  const k2 = dot3(cross3(m1, m4), m3) / d2;
  const k3 = dot3(cross3(m1, m4), m2) / d3;
  const n2: Vec3 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
  const n3: Vec3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];

  const denom = n2[2] * n3[2];
  if (Math.abs(denom) < 1e-9) return Number.isFinite(edgeAspect) ? edgeAspect : null;

  const fSquared =
    -((n2[0] - u0 * n2[2]) * (n3[0] - u0 * n3[2]) + (n2[1] - v0 * n2[2]) * (n3[1] - v0 * n3[2])) /
    denom;
  if (!(fSquared > 0)) return Number.isFinite(edgeAspect) ? edgeAspect : null;

  // whRatio² = |A⁻¹n2|² / |A⁻¹n3|², with |A⁻¹n|² = ((nx−u0·nz)²+(ny−v0·nz)²)/f² + nz².
  const metric = (n: Vec3): number =>
    ((n[0] - u0 * n[2]) ** 2 + (n[1] - v0 * n[2]) ** 2) / fSquared + n[2] ** 2;
  const ratioSq = metric(n2) / metric(n3);
  if (!(ratioSq > 0)) return null;

  const ratio = Math.sqrt(ratioSq);
  return ratio >= 1 ? ratio : 1 / ratio;
}

/**
 * Find the four extreme corners of a contour and measure quad fitness.
 *
 * Corners: farthest-from-centroid, farthest-from-that, then the points of
 * greatest perpendicular distance on each side of that diagonal — the classic
 * inscribed-quadrilateral construction, robust without tolerance tuning.
 */
export function contourToQuad(contour: readonly Point[]): Quad | null {
  if (contour.length < 4) return null;

  const cx = contour.reduce((s, p) => s + p.x, 0) / contour.length;
  const cy = contour.reduce((s, p) => s + p.y, 0) / contour.length;
  const centroid: Point = { x: cx, y: cy };

  const farthestFrom = (anchor: Point): Point =>
    contour.reduce((best, p) => (dist(p, anchor) > dist(best, anchor) ? p : best), contour[0]);

  const a = farthestFrom(centroid);
  const c = farthestFrom(a);

  let b = a;
  let d = a;
  let maxPos = 0;
  let maxNeg = 0;
  for (const p of contour) {
    const s = signedLineDistance(p, a, c);
    if (s > maxPos) {
      maxPos = s;
      b = p;
    } else if (s < maxNeg) {
      maxNeg = s;
      d = p;
    }
  }

  const corners = orderCorners([a, b, c, d]);

  // Fitness: how tightly the contour hugs the quad's 4 edges.
  const diag = Math.max(dist(corners[0], corners[2]), dist(corners[1], corners[3]));
  if (diag === 0) return null;
  const tol = 0.04 * diag;
  let onEdge = 0;
  for (const p of contour) {
    const dEdge = Math.min(
      pointToSegment(p, corners[0], corners[1]),
      pointToSegment(p, corners[1], corners[2]),
      pointToSegment(p, corners[2], corners[3]),
      pointToSegment(p, corners[3], corners[0])
    );
    if (dEdge <= tol) onEdge++;
  }

  return { corners, fitness: onEdge / contour.length };
}
