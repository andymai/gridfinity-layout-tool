/**
 * Wall-pattern cuts for REMOVABLE divider pieces.
 *
 * Reuses the integrated-divider panel factory and only changes the frame: a
 * removable piece is built lying flat for printing (length along X, installed
 * height along Y, thickness along Z), whereas the panel factory emits its
 * panels standing up (span along X, band along Z, thickness along Y). So the
 * panel is rotated -90 degrees about X and dropped onto the piece.
 *
 * The keep-outs come from `dividerPiecePatterns.planPiecePattern`, which knows
 * about the joinery a removable piece carries and the bin body does not.
 */

import { cut, rotate, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { resolvePanelFactory } from './dividerPatternBuilder';
import type { PanelFactory } from './dividerPatternBuilder';
import { planPiecePattern } from './dividerPiecePatterns';
import type { PieceObstruction } from './dividerPiecePatterns';

/**
 * Overshoot past each face of a flat piece, per side (mm). A removable piece
 * sits alone on the plate, so unlike the in-bin dividers there is nothing
 * nearby a deeper prism could reach — this only needs to clear the faces.
 */
const PIECE_CUT_OVERSHOOT = 1;

/** Resolved per-bin state for patterning removable pieces. */
export interface PiecePatternContext {
  readonly factory: PanelFactory;
  readonly thickness: number;
  readonly height: number;
  readonly cutDepth: number;
}

/** The joinery on one piece that the pattern must not perforate. */
export interface PieceGeometry {
  readonly length: number;
  /** Tab engagement at EACH end; 0 for an abutting T-junction end. */
  readonly tabEngagement: number;
  readonly notches?: readonly PieceObstruction[];
  readonly grooves?: readonly PieceObstruction[];
}

/**
 * Resolve the pattern context for a slotted bin, or null when removable
 * dividers shouldn't be patterned.
 *
 * `innerW`/`innerD` feed the kumiko perimeter so a piece's lattice matches the
 * bin walls' — the pieces live inside that bin, so they should read as the same
 * pattern even though they print separately.
 */
export function resolvePiecePatternContext(
  params: BinParams,
  innerW: number,
  innerD: number,
  height: number,
  thickness: number
): PiecePatternContext | null {
  const wallPattern = params.wallPattern as typeof params.wallPattern | undefined;
  if (!wallPattern?.enabled || wallPattern.dividers !== true) return null;
  if (thickness <= 0 || height <= 0) return null;

  const factory = resolvePanelFactory(params, innerW, innerD);
  if (!factory) return null;

  return {
    factory,
    thickness,
    height,
    cutDepth: thickness + 2 * PIECE_CUT_OVERSHOOT,
  };
}

/**
 * Cut the wall pattern into one flat divider piece.
 *
 * Consumes and replaces `piece`. Returns it unchanged whenever the pattern
 * can't be applied — too short, no band, or every element blocked by joinery —
 * so a piece is never silently destroyed by an unpatternable configuration.
 */
export function cutPiecePattern(
  piece: Shape3D,
  ctx: PiecePatternContext,
  geometry: PieceGeometry
): Shape3D {
  const plan = planPiecePattern({
    length: geometry.length,
    height: ctx.height,
    tabEngagement: geometry.tabEngagement,
    notches: geometry.notches ?? [],
    grooves: geometry.grooves ?? [],
    border: ctx.factory.border,
  });
  if (!plan) return piece;
  if (plan.bandHeight < ctx.factory.minPatternHeight) return piece;

  const panel = ctx.factory.build(plan, plan.bandZ0, plan.bandHeight, ctx.cutDepth);
  if (!panel) return piece;

  // Stand the panel down into the piece's print frame: band Z -> Y, panel
  // thickness Y -> Z. Band z is measured from the installed bottom edge, which
  // is at Y = -height/2.
  let tool = rotate(panel, -90, { axis: [1, 0, 0] });
  panel.delete();
  const bandCentreFromBottom = plan.bandZ0 + plan.bandHeight / 2;
  const positioned = translate(tool, [
    0,
    -ctx.height / 2 + bandCentreFromBottom,
    ctx.thickness / 2,
  ]);
  tool.delete();
  tool = positioned;

  try {
    const carved = unwrap(cut(piece, tool));
    piece.delete();
    return carved;
  } catch {
    // A failed pattern cut must not cost the user the divider itself.
    return piece;
  } finally {
    try {
      tool.delete();
    } catch {
      /* already cleaned */
    }
  }
}
