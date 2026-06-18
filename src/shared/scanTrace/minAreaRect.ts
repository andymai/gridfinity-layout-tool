/**
 * Smallest-area oriented rectangle enclosing a point set.
 *
 * Unlike the extreme-corner fit in `contourToQuad`, this is driven by the
 * convex hull, so a concave bite out of one side — e.g. a glossy logo that
 * erodes a card corner out of its mask — is bridged by the hull and can't skew
 * the result. The rect is recovered from the card's surviving straight edges.
 * Fronto-parallel by construction (no perspective), so it's for near-flat shots.
 */

import type { Point } from './types';
import { orderCorners } from './quad';

export interface MinAreaRect {
  /** Corners ordered clockwise from top-left: [TL, TR, BR, BL]. */
  readonly corners: readonly [Point, Point, Point, Point];
  /** Longer side length. */
  readonly width: number;
  /** Shorter side length. */
  readonly height: number;
}

/**
 * Andrew's monotone-chain convex hull. Returns the hull vertices with no repeat;
 * inputs of fewer than 3 points are returned as-is (no hull to compute).
 */
export function convexHull(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const cross = (o: Point, a: Point, b: Point): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const half = (source: readonly Point[]): Point[] => {
    const h: Point[] = [];
    for (const p of source) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };

  return half(pts).concat(half([...pts].reverse()));
}

export function minAreaRect(points: readonly Point[]): MinAreaRect | null {
  const hull = convexHull(points);
  if (hull.length < 3) return null;

  let best: {
    area: number;
    ux: number;
    uy: number;
    vx: number;
    vy: number;
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
  } | null = null;

  // The min-area rect always has one side flush with a hull edge, so test each
  // edge's orientation and keep the tightest bounding box. This is O(h²) over
  // hull vertices, but h stays small: the card rescue only calls this on
  // components that already scored as a clean quad (fitness ≥ 0.8), whose hull
  // is a near-rectangle — a handful of vertices, not the full contour.
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const vx = -uy;
    const vy = ux;

    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of hull) {
      const pu = p.x * ux + p.y * uy;
      const pv = p.x * vx + p.y * vy;
      if (pu < minU) minU = pu;
      if (pu > maxU) maxU = pu;
      if (pv < minV) minV = pv;
      if (pv > maxV) maxV = pv;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) best = { area, ux, uy, vx, vy, minU, maxU, minV, maxV };
  }
  if (!best) return null;

  const { ux, uy, vx, vy, minU, maxU, minV, maxV } = best;
  // A point with basis projection (U,V) sits at U·u + V·v (u,v orthonormal).
  const at = (u: number, v: number): Point => ({ x: u * ux + v * vx, y: u * uy + v * vy });
  const corners = orderCorners([at(minU, minV), at(maxU, minV), at(maxU, maxV), at(minU, maxV)]);
  const w = maxU - minU;
  const h = maxV - minV;
  return { corners, width: Math.max(w, h), height: Math.min(w, h) };
}
