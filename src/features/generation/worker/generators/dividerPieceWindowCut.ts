import { cut, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, WallCutoutShape } from '@/shared/types/bin';
import { clearOfNotches, planPieceWindow, windowReach } from '@/shared/utils/dividerPieceWindow';
import type { PieceWindow } from '@/shared/utils/dividerPieceWindow';
import { dividerGrooveDepth } from '@/shared/utils/slotMath';
import type { PieceGeometry } from './dividerPiecePatternBuilder';
import { CUT_RIM_CLEARANCE } from './generatorConstants';
import { sketch } from './meshUtils';
import { buildCutoutProfile } from './wallCutoutBuilder';

/** Reach of the cutter past each face of the flat piece. */
const FACE_OVERSHOOT = 1;

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

/**
 * The window step for a bin's pieces: cuts each piece and adds the window to
 * its geometry, so the pattern and the bed seams plan around it.
 *
 * The window sits on the part of the piece between its seats: the length less
 * the engagement at each end. A piece in a floor groove is measured from the
 * floor, the way a fixed divider is. Over a cross-lap notch, `notchDepth` deep,
 * the window stops short of it.
 */
export function pieceWindowCutter(
  params: BinParams,
  height: number,
  thickness: number,
  notchDepth: number
): (piece: Shape3D, geometry: PieceGeometry) => { cutPiece: Shape3D; geometry: PieceGeometry } {
  const standing = height - dividerGrooveDepth(params);
  return (piece, geometry) => {
    const span = geometry.length - 2 * geometry.tabEngagement;
    const planned = planPieceWindow(params.walls, params.wallThickness, span, 0, standing);
    const window = planned && clearOfNotches(planned, geometry.notches ?? [], height, notchDepth);
    if (!window) return { cutPiece: piece, geometry };
    // The keep-out covers the whole opening, round-overs included.
    const opening = { offset: window.offset, width: 2 * windowReach(window), depth: window.depth };
    return {
      cutPiece: cutPieceWindow(piece, window, params.walls.shape, height, thickness),
      geometry: { ...geometry, window: opening },
    };
  };
}
