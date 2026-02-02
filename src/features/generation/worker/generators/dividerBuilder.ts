/**
 * Divider piece geometry builder for slotted bin style.
 *
 * Generates removable divider pieces — flat rectangular walls whose
 * length includes tab engagement depth on each end so they slot into
 * the wall cuts. Single extrusion per piece (no boolean fuse needed).
 */

import { drawRectangle } from 'brepjs';
import type { Shape3D, PlaneName, SketchInterface, Drawing } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { calculateDividerHeight, calculateDividerLength } from '@/shared/utils/slotMath';
import { getEffectiveSlotDimensions } from './slotBuilder';

// Re-export shared math so existing imports from generation internals still work
export { calculateDividerHeight, calculateDividerLength };

/** Narrow Drawing.sketchOnPlane to SketchInterface (single closed wire). */
function sketch(drawing: Drawing, plane?: PlaneName, origin?: number): SketchInterface {
  return drawing.sketchOnPlane(plane, origin) as SketchInterface;
}

/**
 * Build a single divider piece laid flat for FDM printing.
 *
 * The divider is oriented with its largest face (length × height) on the
 * XY build plate and extruded upward by wall thickness. This gives the
 * strongest layer orientation — lines run along the wall rather than
 * across the thin dimension.
 *
 * @param length Total divider length in mm (including tab engagement)
 * @param thickness Divider wall thickness in mm
 * @param height Divider height in mm (becomes Y in flat orientation)
 */
export function buildDividerPiece(length: number, thickness: number, height: number): Shape3D {
  return sketch(drawRectangle(length, height), 'XY').extrude(thickness);
}

/**
 * Build one divider piece per unique shape for a slotted bin.
 *
 * X-axis and Y-axis dividers may differ in length (they span different
 * interior dimensions), so up to two distinct pieces are returned.
 * Users duplicate instances in their slicer as needed.
 *
 * @returns Array of 1-2 divider solids (one per enabled axis), or empty
 */
export function buildUniqueDividerPieces(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
): Shape3D[] {
  if (params.style !== 'slotted') return [];

  const { slotConfig, dividerPieces } = params;
  const { slotDepth } = getEffectiveSlotDimensions(params);
  const { thickness, clearance } = dividerPieces;

  const dividerHeight = calculateDividerHeight(dividerPieces, wallHeight, hasLip);

  const pieces: Shape3D[] = [];

  // One X-axis divider (spans width)
  if (slotConfig.x.enabled) {
    const length = calculateDividerLength(innerW, slotDepth, clearance);
    pieces.push(buildDividerPiece(length, thickness, dividerHeight));
  }

  // One Y-axis divider (spans depth) — offset in Y if both axes enabled
  if (slotConfig.y.enabled) {
    const length = calculateDividerLength(innerD, slotDepth, clearance);
    const piece = buildDividerPiece(length, thickness, dividerHeight);
    const yOffset = pieces.length > 0 ? dividerHeight + 5 : 0;
    pieces.push(piece.translate([0, yOffset, 0]));
  }

  return pieces;
}
