/**
 * Fit smooth Bézier curves to a traced outline, then flatten back to a polygon.
 *
 * Replaces Chaikin corner-cutting. fit-curve (Schneider's Graphics Gems
 * algorithm) splits the contour at corners — keeping them sharp — and fits each
 * smooth run as a single cubic, so straight edges stay straight and curved runs
 * come out as clean arcs, with no shrinkage. The result reads like the
 * manufactured part instead of a faceted pixel boundary.
 */

import fitCurve from 'fit-curve';
import type { Point } from './types';

type Cubic = readonly [readonly number[], readonly number[], readonly number[], readonly number[]];

function cubicAt(b: Cubic, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const c1 = 3 * mt * mt * t;
  const c2 = 3 * mt * t * t;
  const c3 = t * t * t;
  return {
    x: a * b[0][0] + c1 * b[1][0] + c2 * b[2][0] + c3 * b[3][0],
    y: a * b[0][1] + c1 * b[1][1] + c2 * b[2][1] + c3 * b[3][1],
  };
}

const segLen = (b: Cubic, i: number, j: number): number =>
  Math.hypot(b[i][0] - b[j][0], b[i][1] - b[j][1]);

/**
 * Arc-length estimate: the average of the chord (lower bound) and the control
 * polygon (upper bound). The bare chord underestimates a strongly-curved
 * segment, so a chord-only step count would leave the very curves we're trying
 * to smooth looking faceted.
 */
const curveLength = (b: Cubic): number =>
  (segLen(b, 0, 3) + segLen(b, 0, 1) + segLen(b, 1, 2) + segLen(b, 2, 3)) / 2;

/**
 * @param maxError squared-distance tolerance (px²): how far the fitted curve may
 *   stray from the contour before it's split into another segment.
 */
export function fitSmoothPolygon(pts: readonly Point[], maxError: number): Point[] {
  if (pts.length < 4) return pts.slice();

  // fit-curve normalizes tangents by chord length, so consecutive duplicate
  // points would divide by zero — drop them and close the loop explicitly.
  const arr: Array<[number, number]> = [];
  for (const p of pts) {
    if (arr.length === 0) {
      arr.push([p.x, p.y]);
      continue;
    }
    const last = arr[arr.length - 1];
    if (last[0] !== p.x || last[1] !== p.y) arr.push([p.x, p.y]);
  }
  const first = arr[0];
  const end = arr[arr.length - 1];
  if (first[0] !== end[0] || first[1] !== end[1]) arr.push([first[0], first[1]]);
  if (arr.length < 4) return pts.slice();

  let curves: Cubic[];
  try {
    curves = fitCurve(arr, maxError);
  } catch {
    return pts.slice();
  }
  if (curves.length === 0) return pts.slice();

  const out: Point[] = [];
  for (const b of curves) {
    // Sample each segment by length; t=1 is the next segment's t=0, so skip it.
    const steps = Math.max(2, Math.min(24, Math.ceil(curveLength(b) / 3)));
    for (let i = 0; i < steps; i++) out.push(cubicAt(b, i / steps));
  }
  return out.length >= 3 ? out : pts.slice();
}
