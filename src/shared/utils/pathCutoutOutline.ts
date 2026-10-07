/**
 * The outline a path cutout is cut to. Kernel-free so the fit-test plan can
 * bound exactly what the worker's builder cuts, instead of a second guess at it.
 */

import type { PathPoint } from '@/shared/types/bin';
import { MIN_PATH_POINTS } from '@/shared/types/bin';
import { dropCoincidentPoints } from '@/shared/utils/polyline';
import { offsetClosedPolygonWithinReach, refineForOffset } from '@/shared/utils/polygonOffset';
import type { Pt } from '@/shared/utils/polygonOffset';

export const BEZIER_SEGMENTS = 12;

/** Flatten a closed bezier path to an open polyline for 3D generation.
 * Returns points for each anchor and bezier intermediates — without duplicating
 * the first point at the end, since brepjs `close()` handles wire closure.
 */
export function flattenPathToPolyline(path: readonly PathPoint[]): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  const n = path.length;

  for (let i = 0; i < n; i++) {
    const p0 = path[i];
    const p1 = path[(i + 1) % n];

    result.push({ x: p0.x, y: p0.y });

    // Flatten bezier curves between consecutive anchors (including closing segment)
    if (p0.handleOut || p1.handleIn) {
      const bx = p0.handleOut ? p0.x + p0.handleOut.dx : p0.x;
      const by = p0.handleOut ? p0.y + p0.handleOut.dy : p0.y;
      const cx = p1.handleIn ? p1.x + p1.handleIn.dx : p1.x;
      const cy = p1.handleIn ? p1.y + p1.handleIn.dy : p1.y;

      // Skip s=0 (p0 already pushed) and s=BEZIER_SEGMENTS (next iteration pushes p1,
      // or for closing segment we omit to avoid duplicating first point)
      for (let s = 1; s < BEZIER_SEGMENTS; s++) {
        const t = s / BEZIER_SEGMENTS;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = mt3 * p0.x + 3 * mt2 * t * bx + 3 * mt * t2 * cx + t3 * p1.x;
        const y = mt3 * p0.y + 3 * mt2 * t * by + 3 * mt * t2 * cy + t3 * p1.y;
        result.push({ x, y });
      }

      // p1 is pushed as p0 of the next iteration for non-closing segments.
      // For the closing segment, brepjs close() handles the connection back to start.
    }
  }

  return result;
}

/** Check if a closed polyline self-intersects (any non-adjacent edges cross). */
export function polylineSelfIntersects(poly: readonly { x: number; y: number }[]): boolean {
  const n = poly.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (j === n - 1 && i === 0) continue; // adjacent (closing edge)
      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];
      const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
      if (Math.abs(d) < 1e-10) continue;
      const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
      const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
      const eps = 1e-6;
      if (t > eps && t < 1 - eps && u > eps && u < 1 - eps) return true;
    }
  }
  return false;
}

/** Centered, flattened, validated outline for a path cutout (or null if degenerate). */
export function pathCutoutOutline(cutout: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly path?: readonly PathPoint[];
}): Array<{ x: number; y: number }> | null {
  const path = cutout.path;
  if (!path || path.length < MIN_PATH_POINTS) return null;
  const polyline = dropCoincidentPoints(flattenPathToPolyline(path));
  if (polyline.length < 3 || polylineSelfIntersects(polyline)) return null;
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  return polyline.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

/** The two outlines a path cutout is cut between, vertex for vertex. */
export interface PathCutoutSections {
  /** The insertion clearance: the straight wall, floor to where the chamfer starts. */
  readonly base: Pt[];
  /** The opening the entry chamfer flares to at the rim; `base` without one. */
  readonly rim: Pt[];
}

/**
 * A centered outline offset by its insertion clearance and, at the rim, its
 * entry chamfer as well, as one loft's sections. A notch too tight for the full
 * offset takes what it can hold, and the base is capped by the rim's reach
 * there, so every ruled face between them flares outward. Null when the
 * outline cannot be offset, because thinning it to its point budget would
 * make it touch itself.
 */
export function pathCutoutSections(
  outline: readonly Pt[],
  clearance: number,
  chamfer: number
): PathCutoutSections | null {
  const toRim = clearance + Math.max(0, chamfer);
  const refined = refineForOffset(outline, toRim);
  if (!refined) return null;
  const rim = offsetClosedPolygonWithinReach(refined, toRim);
  if (chamfer <= 0) return { base: rim.points, rim: rim.points };
  return {
    base: offsetClosedPolygonWithinReach(refined, clearance, rim.reach).points,
    rim: rim.points,
  };
}

/**
 * What the builder cuts a path cutout to: its {@link pathCutoutSections}, or
 * the bare outline, without clearance or chamfer, when those cannot be built.
 * Null only for a degenerate path, which the builder cuts as its bounding box.
 */
export function pathCutoutCut(
  cutout: Parameters<typeof pathCutoutOutline>[0],
  clearance: number,
  chamfer: number
): PathCutoutSections | null {
  const outline = pathCutoutOutline(cutout);
  if (!outline) return null;
  return pathCutoutSections(outline, clearance, chamfer) ?? { base: outline, rim: outline };
}
