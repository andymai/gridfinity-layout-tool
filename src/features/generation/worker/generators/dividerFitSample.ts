/**
 * Divider fit sample: a short section of the bin wall with one real slot, and
 * a short divider piece end beside it, so a maker finds the piece fit their
 * printer needs in minutes rather than by printing a bin.
 *
 * The wall section is cut by `buildSlotSectionCutters`, the same cutters and
 * inputs as the bin's own slots: the slot profile, its retention throat and
 * head pocket, and the floor groove when the design has one. The piece end
 * goes through `relieveTabSeats`, the same cuts as every real piece, so it
 * carries the design's current piece fit. Once the wall section is printed,
 * only the piece needs reprinting while the fit is tuned.
 *
 * What the section cannot show is anything that depends on the whole bin: the
 * lip channel the piece drops through, and the wall-to-wall length.
 *
 * Export mirrors `slideFitSample`: parts → compound → one ready-to-slice file.
 */

import { box, compound, cut, exportSTEP, fuseAll, mesh, translate, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateDividerPieceHeight,
  dividerGrooveDepth,
  dividerSeatZ,
  getDividerLockPlan,
  MIN_WALL_FOR_SLOTS,
  tabEngagement,
} from '@/shared/utils/slotMath';
import type { ExportFormat } from '../../bridge/types';
import { deriveDimensions } from './pipeline/context';
import { buildSlotSectionCutters, getEffectiveSlotDimensions } from './slotBuilder';
import type { DividerSeat } from './slotBuilder';
import { buildDividerPiece, relieveTabSeats } from './dividerBuilder';
import { resolvePieceSeatFit } from './dividerPieceSeat';
import { buildBaseplateSTL } from './baseplateSTL';
import { COPLANAR_MARGIN } from './generatorConstants';
import { PREVIEW_ANGULAR_TOLERANCE_RAD } from './utils/tolerances';

/** Slot height above the seat: tall enough to guide the piece down past the throat. */
const DIVIDER_FIT_SECTION_HEIGHT = 10;
const SECTION_SPAN = 20;
/** Floor in front of the wall, long enough to seat the piece's floor edge. */
const FLOOR_REACH = 12;
export const DIVIDER_FIT_PIECE_LENGTH = 24;
const GAP = 6;

export interface DividerFitSectionPlan {
  /** Where the bin's slots start, as `slotCutsFeature` cuts them. */
  readonly seat: DividerSeat;
  /** Slot height in the real bin, which decides whether it carries the lock. */
  readonly binSlotHeight: number;
  readonly sectionHeight: number;
  readonly pieceHeight: number;
}

export function planDividerFitSection(params: BinParams): DividerFitSectionPlan {
  const dims = deriveDimensions(params, true);
  const seat: DividerSeat = { floorZ: dims.floorThickness, grooveDepth: dims.dividerGrooveDepth };
  const binSlotHeight = dims.interiorHeight - (seat.floorZ - seat.grooveDepth);
  const sectionHeight = Math.min(binSlotHeight, DIVIDER_FIT_SECTION_HEIGHT);
  const pieceSeatZ = dividerSeatZ(
    params.wallThickness,
    params.base.style,
    dividerGrooveDepth(params)
  );
  const dividerHeight = calculateDividerPieceHeight(
    params.dividerPieces,
    dims.wallHeight,
    params.base.stackingLip,
    pieceSeatZ
  );
  return {
    seat,
    binSlotHeight,
    sectionHeight,
    pieceHeight: Math.min(dividerHeight, sectionHeight),
  };
}

/**
 * The wall section in the slot cutters' frame: the wall's inner face on X = 0
 * with the wall at +X, the slot centred on Y = 0, Z as in the bin body.
 */
export function buildDividerFitWall(params: BinParams): Shape3D {
  const { seat, binSlotHeight, sectionHeight } = planDividerFitSection(params);
  const wall = params.wallThickness;
  const topZ = seat.floorZ - seat.grooveDepth + sectionHeight;

  const block = box(FLOOR_REACH + wall, SECTION_SPAN, topZ, {
    at: [(wall - FLOOR_REACH) / 2, 0, topZ / 2],
  });
  // The open space above the floor strip, overrunning every open side.
  const spaceX = FLOOR_REACH + COPLANAR_MARGIN;
  const spaceZ = topZ - seat.floorZ + COPLANAR_MARGIN;
  const space = box(spaceX, SECTION_SPAN + 2 * COPLANAR_MARGIN, spaceZ, {
    at: [-spaceX / 2, 0, seat.floorZ + spaceZ / 2],
  });
  const section = unwrap(cut(block, space));
  block.delete();
  space.delete();

  const cutters = buildSlotSectionCutters(
    params,
    seat,
    binSlotHeight,
    sectionHeight,
    -FLOOR_REACH - COPLANAR_MARGIN
  );
  const tool = cutters.length === 1 ? cutters[0] : unwrap(fuseAll(cutters as ValidSolid[]));
  try {
    return unwrap(cut(section, tool));
  } finally {
    section.delete();
    if (tool !== cutters[0]) tool.delete();
    for (const c of cutters) c.delete();
  }
}

/** The sample piece, flat in the same print frame as every real piece. */
export function buildDividerFitPiece(params: BinParams): Shape3D {
  const { pieceHeight } = planDividerFitSection(params);
  const { thickness, clearance } = params.dividerPieces;
  const { slotDepth } = getEffectiveSlotDimensions(params);
  return relieveTabSeats(
    buildDividerPiece(DIVIDER_FIT_PIECE_LENGTH, thickness, pieceHeight),
    DIVIDER_FIT_PIECE_LENGTH,
    pieceHeight,
    thickness,
    tabEngagement(slotDepth, clearance),
    getDividerLockPlan(thickness, clearance),
    resolvePieceSeatFit(params, params.base.stackingLip)
  );
}

/** Both parts laid out on the plate: the wall section, and the piece in front of it. */
export function buildDividerFitSample(params: BinParams): Shape3D[] {
  // The bin cuts no slot here, so a sample of one would test a fit it never has.
  if (params.style !== 'slotted' || params.wallThickness < MIN_WALL_FOR_SLOTS) {
    throw new Error('This bin has no divider slots to test');
  }
  const { pieceHeight } = planDividerFitSection(params);
  const wall = buildDividerFitWall(params);
  const piece = buildDividerFitPiece(params);
  const placed = translate(piece, [
    (params.wallThickness - FLOOR_REACH) / 2,
    -(SECTION_SPAN / 2 + GAP + pieceHeight / 2),
    0,
  ]);
  piece.delete();
  return [wall, placed];
}

export async function exportDividerFitSample(
  params: BinParams,
  format: ExportFormat
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const parts = buildDividerFitSample(params);
  let assembled: Shape3D;
  try {
    assembled = compound(parts);
  } finally {
    for (const p of parts) p.delete();
  }

  try {
    const name = 'divider_fit_sample';
    if (format === 'step') {
      const blob = unwrap(exportSTEP(assembled));
      return { data: await blob.arrayBuffer(), fileName: `${name}.step` };
    }
    // Every face here is planar, so a coarse tolerance loses nothing.
    const meshResult = mesh(assembled, {
      tolerance: 0.05,
      angularTolerance: PREVIEW_ANGULAR_TOLERANCE_RAD,
    });
    return { data: buildBaseplateSTL(meshResult, name), fileName: `${name}.stl` };
  } finally {
    assembled.delete();
  }
}
