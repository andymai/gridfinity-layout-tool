/**
 * Divider piece geometry builder for slotted bin style.
 *
 * Generates removable divider pieces — flat rectangular walls whose
 * length includes tab engagement depth on each end so they slot into
 * the wall cuts. When both axes are enabled, cross-lap notches are cut
 * at every crossing position so X and Y dividers interlock egg-crate
 * style: X dividers are notched from the top, Y dividers from the
 * bottom, each to just past half height.
 */

import { box, cut, fuseAll, translate, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateDividerHeight,
  calculateDividerLength,
  calculateSlotPositions,
} from '@/shared/utils/slotMath';
import { getEffectiveSlotDimensions } from './slotBuilder';
import { COPLANAR_OVERLAP, LIP_TAPER_WIDTH } from './generatorConstants';

// Re-export shared math so existing imports from generation internals still work
export { calculateDividerHeight, calculateDividerLength };

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
  return box(length, height, thickness, { at: [0, 0, thickness / 2] });
}

/**
 * Cut cross-lap notches into a flat divider piece.
 *
 * In flat orientation the piece is centered at the origin: length along X,
 * installed height along Y (+Y = installed top), thickness along Z. Cross
 * positions are relative to the interior center, which coincides with the
 * piece center, so they map directly to X coordinates.
 *
 * @param piece Flat divider piece (consumed — disposed after the cut)
 * @param positions Crossing centers along the length, relative to center
 * @param notchWidth Notch opening along the length (matches wall slot width)
 * @param notchDepth How far the notch reaches from the edge toward mid-height
 * @param height Divider height in mm
 * @param thickness Divider thickness in mm
 * @param fromTop true → notch from the installed top edge, false → bottom
 */
function cutCrossLapNotches(
  piece: Shape3D,
  positions: number[],
  notchWidth: number,
  notchDepth: number,
  height: number,
  thickness: number,
  fromTop: boolean
): Shape3D {
  if (positions.length === 0) return piece;

  // Extend past the edge (Y) and through the thickness (Z) so the cutter
  // never leaves coplanar faces with the piece.
  const cutterDepth = notchDepth + COPLANAR_OVERLAP;
  const cutterHeight = thickness + 2 * COPLANAR_OVERLAP;
  const edgeY = fromTop
    ? height / 2 - notchDepth / 2 + COPLANAR_OVERLAP / 2
    : -(height / 2 - notchDepth / 2 + COPLANAR_OVERLAP / 2);

  const cutters: Shape3D[] = positions.map((x) =>
    box(notchWidth, cutterDepth, cutterHeight, { at: [x, edgeY, thickness / 2] })
  );

  const compound = cutters.length === 1 ? cutters[0] : unwrap(fuseAll(cutters as ValidSolid[]));
  const notched = unwrap(cut(piece, compound));

  piece.delete();
  compound.delete();
  if (cutters.length > 1) {
    for (const c of cutters) c.delete();
  }
  return notched;
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
  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);
  const { thickness, clearance } = dividerPieces;

  const dividerHeight = calculateDividerHeight(dividerPieces, wallHeight, hasLip);

  const bothAxes = slotConfig.x.enabled && slotConfig.y.enabled;
  // Cross positions must match the wall slot positions, which the pipeline
  // computes with the lip overhang as edge inset (see buildSlotCutsInScope).
  const edgeInset = hasLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
  // Half height per side leaves the crossing flush; add the fit clearance so
  // over-extrusion can't hold the upper divider proud of the rim.
  const notchDepth = dividerHeight / 2 + clearance;

  const pieces: Shape3D[] = [];

  // One X-axis divider (spans width) — notched from the top at each
  // Y-divider position so bottom-notched Y dividers drop over it
  if (slotConfig.x.enabled) {
    const length = calculateDividerLength(innerW, slotDepth, clearance);
    let piece = buildDividerPiece(length, thickness, dividerHeight);
    if (bothAxes) {
      const crossings = calculateSlotPositions(innerW, slotConfig.y.pitch, edgeInset);
      piece = cutCrossLapNotches(
        piece,
        crossings,
        slotWidth,
        notchDepth,
        dividerHeight,
        thickness,
        true
      );
    }
    pieces.push(piece);
  }

  // One Y-axis divider (spans depth) — offset in Y if both axes enabled
  if (slotConfig.y.enabled) {
    const length = calculateDividerLength(innerD, slotDepth, clearance);
    let piece = buildDividerPiece(length, thickness, dividerHeight);
    if (bothAxes) {
      const crossings = calculateSlotPositions(innerD, slotConfig.x.pitch, edgeInset);
      piece = cutCrossLapNotches(
        piece,
        crossings,
        slotWidth,
        notchDepth,
        dividerHeight,
        thickness,
        false
      );
    }
    const yOffset = pieces.length > 0 ? dividerHeight + 5 : 0;
    // translate() creates a new shape — dispose the pre-translation piece
    // to prevent leaking its intermediate handle across regenerations.
    const translated = translate(piece, [0, yOffset, 0]);
    piece.delete();
    pieces.push(translated);
  }

  return pieces;
}
