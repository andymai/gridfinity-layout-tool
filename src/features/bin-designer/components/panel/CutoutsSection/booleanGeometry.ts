/**
 * 2D pathfinder boolean ops on cutout shapes for the editor preview.
 *
 * Mirrors the worker's `combineGroupSolids` semantics in 2D space so the
 * editor can render the same result the BREP pipeline will produce, without
 * waiting for a worker round-trip. The worker remains authoritative — this
 * module is purely visual.
 *
 * Coordinate system: mm, Y-up, origin at the bin interior's bottom-left
 * corner (same frame as `Cutout.x` / `Cutout.y` and `PathPoint.x` /
 * `PathPoint.y`). Polygon-clipping doesn't care about winding for boolean
 * ops on simple polygons, but we keep CCW outer rings + CW holes so the
 * three.js `Shape` consumer can interpret holes correctly.
 */

import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import type { Cutout, GroupOp } from '@/features/bin-designer/types';
import {
  DEFAULT_GROUP_OP,
  MIN_PATH_POINTS,
  DEFAULT_POLYGON_SIDES,
} from '@/features/bin-designer/types';
import {
  regularPolygonPoints,
  slotCornerRadius,
  clampPolygonSides,
} from '@/shared/utils/cutoutPolygon';
import { flattenPath, type Point2D } from './pathGeometryBezier';

/** Number of segments used to flatten a circular cutout outline. */
const CIRCLE_SEGMENTS = 64;

/** Number of segments per 90° of arc for a rounded rectangle corner. */
const CORNER_SEGMENTS_PER_QUADRANT = 8;

/**
 * Rotate a point `[x, y]` around `(cx, cy)` by `angleDeg` (CCW).
 */
function rotatePair(
  x: number,
  y: number,
  cx: number,
  cy: number,
  angleDeg: number
): [number, number] {
  if (angleDeg === 0) return [x, y];
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

/**
 * Build the outline ring for a rectangle cutout (with optional rounded corners),
 * already rotated around its center.
 */
function rectangleRing(c: Cutout): Ring {
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  const r = Math.max(0, Math.min(c.cornerRadius, c.width / 2, c.depth / 2));
  const ring: Ring = [];

  const push = (x: number, y: number): void => {
    ring.push(rotatePair(x, y, cx, cy, c.rotation));
  };

  if (r === 0) {
    push(c.x, c.y);
    push(c.x + c.width, c.y);
    push(c.x + c.width, c.y + c.depth);
    push(c.x, c.y + c.depth);
    return ring;
  }

  // Arc helper: sample CORNER_SEGMENTS_PER_QUADRANT points along a 90° arc
  // from startAngle (in radians) to startAngle + 90°, centered at (acx, acy).
  const arc = (acx: number, acy: number, startAngle: number): void => {
    const step = Math.PI / 2 / CORNER_SEGMENTS_PER_QUADRANT;
    for (let i = 0; i <= CORNER_SEGMENTS_PER_QUADRANT; i++) {
      const a = startAngle + step * i;
      push(acx + r * Math.cos(a), acy + r * Math.sin(a));
    }
  };

  // Walk CCW starting from bottom-left arc center.
  arc(c.x + r, c.y + r, Math.PI); // bottom-left (180° → 270°)
  arc(c.x + c.width - r, c.y + r, -Math.PI / 2); // bottom-right (270° → 360°)
  arc(c.x + c.width - r, c.y + c.depth - r, 0); // top-right
  arc(c.x + r, c.y + c.depth - r, Math.PI / 2); // top-left
  return ring;
}

/** Build the outline ring for a circle cutout (width = diameter). */
function circleRing(c: Cutout): Ring {
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  // Circle's radius collapses to half the smaller bbox dim so non-square
  // bounding rects (which only happen via resize bugs) still produce a
  // valid loop instead of an ellipse polygon-clipping can choke on.
  const r = Math.min(c.width, c.depth) / 2;
  const ring: Ring = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    ring.push(rotatePair(cx + r * Math.cos(a), cy + r * Math.sin(a), cx, cy, c.rotation));
  }
  return ring;
}

/** Build the outline ring for a regular-polygon cutout, rotated around center. */
function polygonRing(c: Cutout): Ring | null {
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  const pts = regularPolygonPoints(
    clampPolygonSides(c.sides ?? DEFAULT_POLYGON_SIDES),
    c.width,
    c.depth
  );
  if (pts.length < 3) return null;
  // Points are centered at origin; offset to the cutout center, then rotate.
  return pts.map((p): [number, number] => rotatePair(cx + p.x, cy + p.y, cx, cy, c.rotation));
}

/** Build the outline ring for a bezier path cutout (vertices are absolute mm). */
function pathRing(c: Cutout): Ring | null {
  if (!c.path || c.path.length < MIN_PATH_POINTS) return null;
  const flat: Point2D[] = flattenPath(c.path);
  if (flat.length < 3) return null;
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  return flat.map((p): [number, number] => rotatePair(p.x, p.y, cx, cy, c.rotation));
}

/**
 * Convert a cutout to a polygon-clipping `Polygon` (single outer ring,
 * no holes). Returns `null` for cutouts that are too degenerate to outline.
 *
 * Insertion `clearance` is intentionally NOT applied here: the editor shows the
 * nominal size the user typed, while the worker expands by clearance at cut
 * time. For grouped Pathfinder previews this means two insert shapes can read
 * as touching-but-separate in the preview yet merge in the exported mesh — a
 * sub-millimetre discrepancy we accept so the on-screen outline matches the
 * entered dimensions. Don't "fix" this by adding clearance without revisiting
 * that trade-off.
 */
export function cutoutToPolygon(c: Cutout): Polygon | null {
  if (c.shape === 'path') {
    const ring = pathRing(c);
    return ring ? [ring] : null;
  }
  if (c.width <= 0 || c.depth <= 0) return null;
  if (c.shape === 'circle') return [circleRing(c)];
  if (c.shape === 'polygon') {
    const ring = polygonRing(c);
    return ring ? [ring] : null;
  }
  if (c.shape === 'slot') {
    // Stadium = rounded rect with fully-rounded ends (radius = half short side).
    return [rectangleRing({ ...c, cornerRadius: slotCornerRadius(c.width, c.depth) })];
  }
  return [rectangleRing(c)];
}

/**
 * Apply the pathfinder boolean op across a group's members.
 *
 *  - `union` fuses every member.
 *  - `subtract` carves the union of all but the top z-indexed member out
 *    using that top member as the cutter (Illustrator "Minus Front").
 *  - `intersect` keeps only the region common to every member.
 *  - `exclude` returns XOR (union minus intersection).
 *
 * Returns `null` when the result is empty (e.g. Intersect with no overlap)
 * so callers can show a "no result" hint instead of silently rendering
 * nothing. Members that fail to outline are skipped, never block the op.
 */
export function applyGroupOp(
  members: readonly Cutout[],
  op: GroupOp = DEFAULT_GROUP_OP
): MultiPolygon | null {
  const polygons = members
    .map((c) => ({ cutout: c, polygon: cutoutToPolygon(c) }))
    .filter((e): e is { cutout: Cutout; polygon: Polygon } => e.polygon !== null);

  if (polygons.length === 0) return null;
  if (polygons.length === 1) return [polygons[0].polygon];

  const allPolys = polygons.map((e) => e.polygon);
  const [first, ...rest] = allPolys;

  switch (op) {
    case 'union': {
      const result = polygonClipping.union(first, ...rest);
      return result.length > 0 ? result : null;
    }
    case 'intersect': {
      const result = polygonClipping.intersection(first, ...rest);
      return result.length > 0 ? result : null;
    }
    case 'exclude': {
      // The worker computes Exclude as `union − intersection` ("in some but
      // not all"). For 2 members that matches `xor` (symmetric difference)
      // exactly, but for 3+ members it diverges: a region present in two
      // members but not the third is part of `union − intersection` yet
      // disappears under `xor` (which keeps only odd-count regions).
      // Mirror the worker so the 2D preview agrees with the exported mesh.
      const unionResult = polygonClipping.union(first, ...rest);
      const intersectionResult = polygonClipping.intersection(first, ...rest);
      if (intersectionResult.length === 0) {
        return unionResult.length > 0 ? unionResult : null;
      }
      const result = polygonClipping.difference(unionResult, intersectionResult);
      return result.length > 0 ? result : null;
    }
    case 'subtract': {
      // Top z-index is the cutter; everything else is the base. Stable tie
      // break on array order so swapping two equal-z members doesn't flip the
      // result. Matches the worker's `combineGroupSolids` ordering.
      const indexed = polygons.map((e, i) => ({ ...e, i }));
      indexed.sort((a, b) => {
        const za = a.cutout.zIndex ?? 0;
        const zb = b.cutout.zIndex ?? 0;
        if (za !== zb) return zb - za;
        return b.i - a.i;
      });
      const cutter = indexed[0].polygon;
      const basePolys = indexed.slice(1).map((e) => e.polygon);
      if (basePolys.length === 0) return null;
      const base =
        basePolys.length === 1
          ? basePolys[0]
          : polygonClipping.union(basePolys[0], ...basePolys.slice(1));
      const result = polygonClipping.difference(base, cutter);
      return result.length > 0 ? result : null;
    }
  }
}

export type { MultiPolygon, Polygon, Ring };
