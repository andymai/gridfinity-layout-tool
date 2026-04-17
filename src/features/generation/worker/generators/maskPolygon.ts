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
 * All insets are applied in a SINGLE `offset()` call on the raw sharp
 * polygon. Chaining two `.offset(...)` calls on the same concave polygon
 * triggers brepjs's `POINT_NOT_ON_CURVE` error (rounded corners from the
 * first offset split edge curves, making subsequent offsets degenerate).
 */
import { draw } from 'brepjs';
import type { Drawing } from 'brepjs';
import { CLEARANCE } from './generatorConstants';
import { MASK_CELL_SIZE, maskToPolygon, type CellMask } from '@/shared/utils/cellMask';

/**
 * Build the raw sharp-cornered polygon for the mask, centered on origin.
 * Internal helper; callers choose the total inset applied via `.offset()`.
 */
function buildRawMaskPolygon(mask: CellMask, gridUnitMm: number): Drawing {
  const vertices = maskToPolygon(mask);
  if (vertices.length < 3) {
    throw new Error(`mask polygon has only ${vertices.length} vertices (need 3+)`);
  }

  const halfWidthMm = (mask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (mask.rows * MASK_CELL_SIZE * gridUnitMm) / 2;

  const toMm = (p: { x: number; y: number }): [number, number] => [
    p.x * gridUnitMm - halfWidthMm,
    p.y * gridUnitMm - halfDepthMm,
  ];

  const first = toMm(vertices[0]);
  let pen = draw(first);
  for (let i = 1; i < vertices.length; i++) {
    pen = pen.lineTo(toMm(vertices[i]));
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
  return buildRawMaskPolygon(mask, gridUnitMm).offset(-CLEARANCE / 2);
}

/**
 * Inner polygon: sharp perimeter inset by `CLEARANCE / 2 + inset` in a
 * single `offset()` call. Used by the lip builder for inner frustum
 * sections where each Z level insets a different amount.
 */
export function buildMaskDrawingInset(mask: CellMask, gridUnitMm: number, inset: number): Drawing {
  return buildRawMaskPolygon(mask, gridUnitMm).offset(-(CLEARANCE / 2 + inset));
}
