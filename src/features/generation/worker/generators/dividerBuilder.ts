/**
 * Divider piece geometry builder for slotted bin style.
 *
 * Generates removable divider pieces — flat rectangular walls whose
 * length includes tab engagement depth on each end so they slot into
 * the wall cuts. Single extrusion per piece (no boolean fuse needed).
 */

import { drawRectangle } from 'replicad';
import type { Shape3D, Sketch } from 'replicad';
import type { BinParams } from '@/shared/types/bin';
import { calculateDividerHeight, calculateDividerLength } from '@/shared/utils/slotMath';
import { getEffectiveSlotDimensions } from './slotBuilder';

// Re-export shared math so existing imports from generation internals still work
export { calculateDividerHeight, calculateDividerLength };

/**
 * Build a single divider piece as a flat rectangular wall.
 *
 * The divider length already includes tab engagement depth on each end
 * (via calculateDividerLength), and tabThickness simplifies to exactly
 * `thickness` (slotWidth - 2*clearance = thickness + 2*clearance - 2*clearance).
 * So the tab volumes are contained within the wall — a single extrusion
 * produces the correct geometry without expensive BREP boolean fuse ops.
 *
 * @param length Total divider length in mm (including tab engagement)
 * @param thickness Divider wall thickness in mm
 * @param height Divider height in mm
 */
export function buildDividerPiece(length: number, thickness: number, height: number): Shape3D {
  return (drawRectangle(length, thickness).sketchOnPlane('XY') as unknown as Sketch).extrude(
    height
  ) as Shape3D;
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

  // One Y-axis divider (spans depth) — offset if both axes enabled
  if (slotConfig.y.enabled) {
    const length = calculateDividerLength(innerD, slotDepth, clearance);
    const piece = buildDividerPiece(length, thickness, dividerHeight);
    const yOffset = pieces.length > 0 ? thickness + 5 : 0;
    pieces.push(piece.translate([0, yOffset, 0]));
  }

  return pieces;
}
