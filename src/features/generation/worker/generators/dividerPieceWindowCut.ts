import { cut, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, WallCutoutShape } from '@/shared/types/bin';
import {
  clearOfNotches,
  keepBottomBand,
  planPieceWindow,
  windowReach,
  WINDOW_BOTTOM_BAND_MM,
} from '@/shared/utils/dividerPieceWindow';
import type { PieceWindow } from '@/shared/utils/dividerPieceWindow';
import { dividerGrooveDepth } from '@/shared/utils/slotMath';
import type { PieceGeometry } from './dividerPiecePatternBuilder';
import { dividerJointClearance, partLengthBudget, tongueBandHalf } from './dividerSeamPlan';
import type { DividerBedFit } from './dividerSeamPlan';
import { CUT_RIM_CLEARANCE } from './generatorConstants';
import { sketch } from './meshUtils';
import { buildCutoutProfile } from './wallCutoutBuilder';

/** Reach of the cutter past each face of the flat piece. */
const FACE_OVERSHOOT = 1;
/** Room over a seam's tongue band, so the band clears the window's floor. */
const JOINT_BAND_MARGIN = 0.5;

/**
 * Cut the interior wall cutout into one flat divider piece: length along X,
 * installed height along Y with the top edge at `+height / 2`, thickness along
 * Z from 0. Consumes `piece`; passes it through when there is no window.
 *
 * The profile is the one a fixed divider's cutter uses, with the same
 * `CUT_RIM_CLEARANCE` above the top edge, so the shoulder round-over meets
 * the piece's top edge the way it meets a divider's.
 */
export function cutPieceWindow(
  piece: Shape3D,
  window: PieceWindow | null,
  shape: WallCutoutShape,
  height: number,
  thickness: number
): Shape3D {
  if (!window) return piece;
  const profile = buildCutoutProfile(
    shape,
    window.width,
    window.depth,
    CUT_RIM_CLEARANCE,
    window.cornerSlack,
    window.radii
  );
  const extruded = sketch(profile, 'XY', -FACE_OVERSHOOT).extrude(thickness + 2 * FACE_OVERSHOOT);
  // The profile is centred on its own height, depth + clearance, and its rim
  // line sits the clearance under the profile's top.
  const centreY = height / 2 - window.depth / 2 + CUT_RIM_CLEARANCE / 2;
  const tool = translate(extruded, [window.offset, centreY, 0]);
  extruded.delete();
  try {
    const carved = unwrap(cut(piece, tool));
    piece.delete();
    return carved;
  } finally {
    tool.delete();
  }
}

/** The part of a piece that stands in the cavity, from the piece's centre. */
export interface ExposedSpan {
  readonly from: number;
  readonly to: number;
}

/**
 * The window step for a bin's pieces: cuts each piece and adds the window to
 * its geometry, so the pattern and the bed seams plan around it.
 *
 * The window sits on the part of the piece between its seats, `exposed` when
 * the caller knows it, else the length less `tabEngagement` at each end. A
 * piece in a floor groove is measured from the floor, the way a fixed divider
 * is. Over a cross-lap notch, `notchDepth` deep, the window stops short of it.
 * Under it a solid band stays: on a piece the bed will split, a band that a
 * seam's tongue fits in, so the seam can go anywhere along it.
 */
export function pieceWindowCutter(
  params: BinParams,
  height: number,
  thickness: number,
  notchDepth: number,
  fit?: DividerBedFit
): (
  piece: Shape3D,
  geometry: PieceGeometry,
  exposed?: ExposedSpan
) => { cutPiece: Shape3D; geometry: PieceGeometry } {
  const standing = height - dividerGrooveDepth(params);
  const budget = fit ? partLengthBudget(height, fit.printBed) : null;
  const jointBand = fit
    ? 2 * tongueBandHalf(dividerJointClearance(fit.nozzleSizeMm)) + JOINT_BAND_MARGIN
    : 0;
  return (piece, geometry, exposed) => {
    const half = geometry.length / 2;
    const { from, to } = exposed ?? {
      from: -half + geometry.tabEngagement,
      to: half - geometry.tabEngagement,
    };
    const planned = planPieceWindow(
      params.walls,
      params.wallThickness,
      to - from,
      (from + to) / 2,
      standing
    );
    const splits = budget !== null && geometry.length > budget;
    const band = splits ? Math.max(WINDOW_BOTTOM_BAND_MM, jointBand) : WINDOW_BOTTOM_BAND_MM;
    const clear = planned && clearOfNotches(planned, geometry.notches ?? [], height, notchDepth);
    const window = clear && keepBottomBand(clear, height, band);
    if (!window) return { cutPiece: piece, geometry };
    // The keep-out covers the whole opening, round-overs included.
    const opening = { offset: window.offset, width: 2 * windowReach(window), depth: window.depth };
    return {
      cutPiece: cutPieceWindow(piece, window, params.walls.shape, height, thickness),
      geometry: { ...geometry, window: opening },
    };
  };
}
