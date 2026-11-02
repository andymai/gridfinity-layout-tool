/**
 * Shape-agnostic path-point transforms used by both the cutout store and the
 * CutoutsSection editor. Lives outside `components/` so the store can import
 * it without crossing the one-way `components → store` layer boundary.
 */

import type { PathPoint } from '@/features/bin-designer/types';

/** Scale all path points (and their bezier handles) proportionally around an origin. */
export function scalePathPoints(
  points: readonly PathPoint[],
  scaleX: number,
  scaleY: number,
  originX: number,
  originY: number
): PathPoint[] {
  return points.map((pt) => ({
    ...pt,
    x: originX + (pt.x - originX) * scaleX,
    y: originY + (pt.y - originY) * scaleY,
    handleIn: pt.handleIn ? { dx: pt.handleIn.dx * scaleX, dy: pt.handleIn.dy * scaleY } : null,
    handleOut: pt.handleOut ? { dx: pt.handleOut.dx * scaleX, dy: pt.handleOut.dy * scaleY } : null,
  }));
}

/** Translate all path points by a delta. Handles are relative, so they're unaffected. */
export function translatePathPoints(
  points: readonly PathPoint[],
  dx: number,
  dy: number
): PathPoint[] {
  return points.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy }));
}

/**
 * A cutout's outline and islands, each ring passed through `move`, holding only
 * the fields it has. Islands live in the outline's frame, so anything that
 * moves, scales or mirrors one has to do the same to the other.
 */
export function mapPathRings(
  c: { readonly path?: readonly PathPoint[]; readonly holes?: readonly (readonly PathPoint[])[] },
  move: (ring: readonly PathPoint[]) => PathPoint[]
): { path?: PathPoint[]; holes?: PathPoint[][] } {
  return {
    ...(c.path ? { path: move(c.path) } : {}),
    ...(c.holes ? { holes: c.holes.map(move) } : {}),
  };
}
