/**
 * Mask → brepjs Drawing converter for non-rectangular bin footprints.
 *
 * Converts a {@link CellMask} into a closed Drawing suitable for extrusion
 * or lofting. The polygon is centered on the origin (like the rectangular
 * `drawRoundedRectangle` path) and shrunk by `CLEARANCE / 2` on each side
 * to match the tolerance gap used by standard Gridfinity bins.
 *
 * v1 uses sharp corners at every vertex (convex and concave alike).
 * Adding outer-corner fillets so L-shapes match rectangular `BOX_CORNER_RADIUS`
 * is a follow-up — brepjs's `Drawing.fillet(radius, filter)` needs a
 * convex-vs-concave corner finder, which we leave for a separate PR.
 *
 * Insets are computed geometrically on the polygon vertices rather than via
 * `Drawing.offset()`. brepjs 15.x returns a silently-empty Drawing when
 * `offset()` runs on a concave polygon, which later crashes `sketchOnPlane`
 * with "empty drawing". Since every mask polygon is axis-aligned with 90°
 * turns, we can shift each edge perpendicular-inward by the inset distance
 * and recompute vertex intersections in closed form.
 */
import { draw } from 'brepjs';
import type { Drawing } from 'brepjs';
import { CLEARANCE } from './generatorConstants';
import { MASK_CELL_SIZE, maskToPolygon, type CellMask } from '@/shared/utils/cellMask';

interface Point2Mm {
  readonly x: number;
  readonly y: number;
}

/**
 * Inset an axis-aligned CCW polygon by `inset` mm, moving every edge
 * perpendicular-inward. Every edge is horizontal or vertical and every
 * turn is 90° (mask polygons are produced by `maskToPolygon`), so the new
 * vertex is the intersection of the two inset-shifted edges.
 *
 * For a CCW polygon the interior lies on the LEFT of each edge direction.
 * The interior-pointing normal at a 90° corner is the sum of the two
 * adjacent edges' left-normals; shifting the vertex by `inset *` that sum
 * places it at the intersection of the two shifted edges.
 */
function insetAxisAlignedPolygon(vertices: readonly Point2Mm[], inset: number): Point2Mm[] {
  const n = vertices.length;
  const result: Point2Mm[] = [];
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const cur = vertices[i];
    const next = vertices[(i + 1) % n];

    const dxIn = Math.sign(cur.x - prev.x);
    const dyIn = Math.sign(cur.y - prev.y);
    const dxOut = Math.sign(next.x - cur.x);
    const dyOut = Math.sign(next.y - cur.y);

    // Left-normal of direction (dx, dy) is (-dy, dx).
    const nx = -dyIn + -dyOut;
    const ny = dxIn + dxOut;

    result.push({ x: cur.x + inset * nx, y: cur.y + inset * ny });
  }
  return result;
}

/** Build a closed Drawing from mask vertices at given total inset (mm, non-negative). */
function buildMaskDrawingAtInset(mask: CellMask, gridUnitMm: number, insetMm: number): Drawing {
  const gridVertices = maskToPolygon(mask);
  if (gridVertices.length < 3) {
    throw new Error(`mask polygon has only ${gridVertices.length} vertices (need 3+)`);
  }

  const halfWidthMm = (mask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (mask.rows * MASK_CELL_SIZE * gridUnitMm) / 2;

  const mmVertices: Point2Mm[] = gridVertices.map((p) => ({
    x: p.x * gridUnitMm - halfWidthMm,
    y: p.y * gridUnitMm - halfDepthMm,
  }));

  const shrunk = insetMm > 0 ? insetAxisAlignedPolygon(mmVertices, insetMm) : mmVertices;

  let pen = draw([shrunk[0].x, shrunk[0].y]);
  for (let i = 1; i < shrunk.length; i++) {
    pen = pen.lineTo([shrunk[i].x, shrunk[i].y]);
  }
  return pen.close();
}

/**
 * Outer polygon: sharp perimeter inset by `CLEARANCE / 2` to match the
 * tolerance gap used by the rectangle path (`w - CLEARANCE`).
 *
 * @throws if the polygon has fewer than 3 vertices (caller should
 *   validate the mask first).
 */
export function buildMaskDrawing(mask: CellMask, gridUnitMm: number): Drawing {
  return buildMaskDrawingAtInset(mask, gridUnitMm, CLEARANCE / 2);
}

/**
 * Inner polygon: sharp perimeter inset by `CLEARANCE / 2 + inset`. Used by
 * the lip builder and inner-fill paths where each Z level insets a different
 * amount.
 */
export function buildMaskDrawingInset(mask: CellMask, gridUnitMm: number, inset: number): Drawing {
  return buildMaskDrawingAtInset(mask, gridUnitMm, CLEARANCE / 2 + inset);
}
