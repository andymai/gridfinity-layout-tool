/**
 * The flat shape of one removable divider piece and the joinery cut into it:
 * rounded corners over an interior fillet, cross-lap notches, face grooves and
 * the lid's keep-out notch. `dividerBuilder` decides which piece gets what;
 * these only shape it.
 */

import { box, cut, draw, fuseAll, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { isSlideLid } from '@/shared/types/bin';
import { calculateDividerHeight } from '@/shared/utils/slotMath';
import { labelShelfKeepoutMm } from '@/shared/utils/lidInteriorRelief';
import { lidKeepoutRing } from '@/shared/constants/lidKeepout';
import type { PieceCorners } from '@/shared/utils/slottedFillet';
import type { PieceObstruction } from './dividerPiecePatterns';
import { COPLANAR_OVERLAP } from './generatorConstants';

/** The length a rounded bottom corner takes at each end that has one. */
export function cornerColumns(
  length: number,
  corners: PieceCorners | null | undefined
): PieceObstruction[] {
  if (!corners) return [];
  const { radius } = corners;
  return [
    ...(corners.low ? [{ offset: -length / 2 + radius / 2, width: radius }] : []),
    ...(corners.high ? [{ offset: length / 2 - radius / 2, width: radius }] : []),
  ];
}

/**
 * Build a single divider piece laid flat for FDM printing.
 *
 * The divider is oriented with its largest face (length × height) on the
 * XY build plate and extruded upward by wall thickness. This gives the
 * strongest layer orientation: lines run along the wall rather than
 * across the thin dimension.
 *
 * With `corners`, each named end's bottom corner is an arc tangent to the end
 * and to the bottom edge, drawn into the outline rather than cut, so no cutter
 * ever grazes a face tangentially.
 *
 * @param length Total divider length in mm (including tab engagement)
 * @param thickness Divider wall thickness in mm
 * @param height Divider height in mm (becomes Y in flat orientation)
 */
export function buildDividerPiece(
  length: number,
  thickness: number,
  height: number,
  corners: PieceCorners | null = null
): Shape3D {
  if (!corners) return box(length, height, thickness, { at: [0, 0, thickness / 2] });
  const x = length / 2;
  const y = height / 2;
  const r = corners.radius;
  const lean = Math.SQRT1_2 * r;
  let pen = draw([-x, y]);
  pen = corners.low
    ? pen.lineTo([-x, -y + r]).threePointsArcTo([-x + r, -y], [-x + r - lean, -y + r - lean])
    : pen.lineTo([-x, -y]);
  pen = corners.high
    ? pen.lineTo([x - r, -y]).threePointsArcTo([x, -y + r], [x - r + lean, -y + r - lean])
    : pen.lineTo([x, -y]);
  return pen.lineTo([x, y]).close().sketchOnPlane('XY', 0).extrude(thickness);
}

/** Cut fused cutters from a piece. Consumes piece and cutters; passthrough when cutters is empty. */
export function applyCuts(piece: Shape3D, cutters: Shape3D[]): Shape3D {
  if (cutters.length === 0) return piece;
  const compound = cutters.length === 1 ? cutters[0] : unwrap(fuseAll(cutters as ValidSolid[]));
  const result = unwrap(cut(piece, compound));
  piece.delete();
  compound.delete();
  if (cutters.length > 1) {
    for (const c of cutters) c.delete();
  }
  return result;
}

/**
 * Cut cross-lap notches into a flat divider piece.
 *
 * In flat orientation the piece is centered at the origin: length along X,
 * installed height along Y (+Y = installed top), thickness along Z. Cross
 * positions are relative to the interior center, which coincides with the
 * piece center, so they map directly to X coordinates.
 *
 * @param piece Flat divider piece (consumed, disposed after the cut)
 * @param positions Crossing centers along the length, relative to center
 * @param notchWidth Notch opening along the length (matches wall slot width)
 * @param notchDepth How far the notch reaches from the edge toward mid-height
 * @param height Divider height in mm
 * @param thickness Divider thickness in mm
 * @param fromTop true → notch from the installed top edge, false → bottom
 */
export function cutCrossLapNotches(
  piece: Shape3D,
  positions: number[],
  notchWidth: number,
  notchDepth: number,
  height: number,
  thickness: number,
  fromTop: boolean
): Shape3D {
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
  return applyCuts(piece, cutters);
}

/**
 * Cut vertical grooves into both faces of a flat divider piece.
 *
 * Grooves run the full installed height (local Y) at each position (local X),
 * recessed into the piece's two thickness faces (local Z). Insert mode uses
 * slot-wide grooves as receptacles a short divider's tab slides into;
 * snappable mode uses narrow, shallow grooves as a symmetric score line so
 * the piece breaks cleanly along the retained web.
 *
 * @param piece Flat divider piece (consumed, disposed after the cut)
 * @param positions Groove centers along the length, relative to center
 * @param grooveWidth Groove opening along the length
 * @param grooveDepth Recess depth per face
 * @param height Divider height in mm
 * @param thickness Divider thickness in mm
 */
export function cutFaceGrooves(
  piece: Shape3D,
  positions: number[],
  grooveWidth: number,
  grooveDepth: number,
  height: number,
  thickness: number
): Shape3D {
  const cutterDepth = grooveDepth + COPLANAR_OVERLAP;
  const cutterHeight = height + 2 * COPLANAR_OVERLAP;

  const cutters: Shape3D[] = positions.flatMap((x) => [
    // Bottom face (Z=0): recess reaches up to grooveDepth
    box(grooveWidth, cutterHeight, cutterDepth, {
      at: [x, 0, (grooveDepth - COPLANAR_OVERLAP) / 2],
    }),
    // Top face (Z=thickness): recess reaches down to thickness − grooveDepth
    box(grooveWidth, cutterHeight, cutterDepth, {
      at: [x, 0, thickness - (grooveDepth - COPLANAR_OVERLAP) / 2],
    }),
  ]);
  return applyCuts(piece, cutters);
}

/**
 * Notch the lid's seating band out of a removable piece's top edge.
 *
 * `lidInteriorReliefStage` cuts this band out of the bin body, which clears the
 * baked compartment dividers with it; a removable piece is a separate solid it
 * never reaches, so the same cut has to happen here or the piece fouls the lid.
 * A capping lid claims only a ring at the wall, so the notch is end-only and
 * inert at an end that seats mid-cavity. A sliding plate sweeps the whole
 * opening, so its band spans the entire piece.
 */
export function cutLidKeepoutRelief(
  piece: Shape3D,
  length: number,
  height: number,
  thickness: number,
  keepout: KeepoutRelief
): Shape3D {
  const yDepth = Math.min(keepout.notchY, height);
  if (yDepth <= 0) return piece;

  const cutY = yDepth + COPLANAR_OVERLAP;
  const cutZ = thickness + 2 * COPLANAR_OVERLAP;
  const bandCenterY = height / 2 - yDepth / 2 + COPLANAR_OVERLAP / 2;

  if (keepout.fullSpan) {
    const cutter = box(length + 2 * COPLANAR_OVERLAP, cutY, cutZ, {
      at: [0, bandCenterY, thickness / 2],
    });
    return applyCuts(piece, [cutter]);
  }

  // Clamp so the two end notches can never meet and shear the whole top off.
  const xExtent = Math.min(keepout.notchX, length / 2 - 0.05);
  if (xExtent <= 0) return piece;
  const cutters: Shape3D[] = [];
  for (const sign of [-1, 1] as const) {
    const outer = sign * (length / 2 + COPLANAR_OVERLAP);
    const inner = sign * (length / 2 - xExtent);
    const cx = (outer + inner) / 2;
    const clen = Math.abs(outer - inner);
    cutters.push(box(clen, cutY, cutZ, { at: [cx, bandCenterY, thickness / 2] }));
  }
  return applyCuts(piece, cutters);
}

export interface KeepoutRelief {
  /** Band below the piece's top edge a seated lid claims (mm); 0 when none does. */
  readonly notchY: number;
  /** Inboard reach of an end notch from a wall end (mm); unused when fullSpan. */
  readonly notchX: number;
  /** Sliding plate: relieve the whole top, not just the wall ends. */
  readonly fullSpan: boolean;
}

/**
 * `labelShelfKeepoutMm` gives the band a lid claims below the ceiling: the same
 * value the label shelf sinks by, with the capping vs sliding depth folded in
 * and 0 when `interiorReliefActive` is false, the gate the bin body's relief
 * uses too. A piece topping out below the ceiling meets that much less of it.
 */
export function resolveKeepoutRelief(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean,
  seatZ: number,
  dividerHeight: number,
  tabDepth: number
): KeepoutRelief {
  const keepoutDepth = labelShelfKeepoutMm(params);
  if (keepoutDepth <= 0) return { notchY: 0, notchX: 0, fullSpan: false };
  const ceilingZ = calculateDividerHeight({ height: 'auto' }, wallHeight, hasLip);
  const notchY = Math.max(0, keepoutDepth - (ceilingZ - (seatZ + dividerHeight)));
  const ring = lidKeepoutRing(innerW, innerD, params.wallThickness);
  // outerHalfX sits at the lip's inner face, inboard of the wall by the
  // (negative) lip inset; the ring reaches `width` further in, and the tab
  // spans from the piece end to that face.
  const lipInset = ring.outerHalfX - innerW / 2;
  return { notchY, notchX: tabDepth + ring.width - lipInset, fullSpan: isSlideLid(params.lid) };
}
