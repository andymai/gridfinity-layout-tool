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
 */
import { draw } from 'brepjs';
import type { Drawing } from 'brepjs';
import { CLEARANCE } from './generatorConstants';
import { MASK_CELL_SIZE, maskToPolygon, type CellMask } from '@/shared/utils/cellMask';

/**
 * Build a Drawing of the mask's outer polygon, centered on the origin,
 * inset by `CLEARANCE / 2` on each side (matching the rectangle path).
 *
 * The returned Drawing is closed (first vertex == last vertex logically)
 * and suitable for `.sketchOnPlane(...)` + `.extrude(...)` or `.loftWith(...)`.
 *
 * @throws if the polygon has fewer than 3 vertices (caller should
 *   validate the mask first).
 */
export function buildMaskDrawing(mask: CellMask, gridUnitMm: number): Drawing {
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
  const polygon = pen.close();

  // Inset by CLEARANCE/2 so the polygon's nominal dimensions match what
  // `drawRoundedRectangle(w - CLEARANCE, d - CLEARANCE)` produces for the
  // rectangle path. The spike confirmed brepjs handles concave offsets.
  return polygon.offset(-CLEARANCE / 2);
}

/**
 * Build an inner polygon Drawing offset inward by `inset` mm.
 * Used by the lip builder for inner frustum sections.
 */
export function buildMaskDrawingInset(mask: CellMask, gridUnitMm: number, inset: number): Drawing {
  const outer = buildMaskDrawing(mask, gridUnitMm);
  return outer.offset(-inset);
}
