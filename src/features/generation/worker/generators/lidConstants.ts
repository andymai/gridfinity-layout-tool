/**
 * Click-lock lid geometry constants.
 *
 * Profiles below model the standard click-lock lid geometry — a lid
 * floor with an inverted-lip mating shell underneath plus tapered click
 * rails on each straight wall.
 *
 * Coordinate convention (lid-local):
 *   Z = 0          : top surface of the lid floor
 *   Z = -topThickness : bottom of the lid floor (top of mating cavity)
 *   Z negative     : mating shell + click rails extend down
 *   Z positive     : optional Gridfinity stack grid
 *
 * All values are in millimeters.
 */

import { LIP_BIG_TAPER, LIP_VERTICAL_PART, LIP_HEIGHT } from './generatorConstants';
import {
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_TOP_THICKNESS_BASE,
  LID_MAGNET_CEILING,
} from '@/shared/types/bin';

/* ──────────────────────────────────────────────────────────────────────
 * Public lid dimensions live in `@/features/bin-designer/types/lid.ts`
 * (single source of truth shared with the panel/preview). Re-exported
 * here so worker callers keep their existing import path.
 * ──────────────────────────────────────────────────────────────────────── */

export { LID_CORNER_RADIUS, LID_FIT_CLEARANCE, LID_TOP_THICKNESS_BASE, LID_MAGNET_CEILING };

/** Side-wall thickness in the lip-mating zone. Derived: the outer chamfer
 *  steps inward by `LIP_BIG_TAPER` and the inner cavity face sits at
 *  `LID_CORNER_RADIUS - LID_FIT_CLEARANCE`, so the wall is
 *  `(LID_CORNER_RADIUS - LID_FIT_CLEARANCE) - LIP_BIG_TAPER = 1.85mm`. */
export const LID_WALL_THICKNESS = LID_CORNER_RADIUS - LID_FIT_CLEARANCE - LIP_BIG_TAPER;

/**
 * Floor plate thickness when magnet pockets are enabled. The pocket
 * needs at least `magnetDepth` of depth, plus a thin ceiling so the
 * pocket doesn't break through into the cavity. Falls back to the
 * baseline when magnets are off.
 */
export function lidTopThickness(magnetHoles: boolean, magnetDepth: number): number {
  if (!magnetHoles) return LID_TOP_THICKNESS_BASE;
  return Math.max(LID_TOP_THICKNESS_BASE, magnetDepth + LID_MAGNET_CEILING);
}

/** Extra clearance baked into the anchor calculation to compensate for
 *  first-layer squish (mm). */
export const LID_EXTRA_HEIGHT = 0.2;

/**
 * Anchor Z position — where the lid's mating cavity starts opening up to
 * receive the bin's stacking lip when the lid is snapped on.
 *
 *   anchorZ = -heightUnitMm - extra + LIP_HEIGHT + sqrt(2)*fitClearance*2
 *
 * The sqrt(2)*2*fitClearance term applies clearance along the diagonal
 * direction at the corner (where two perpendicular shifts compose).
 *
 * @param heightUnitMm Gridfinity height unit (default 7mm — total lid height)
 * @param fitClearance Per-side clearance for the chosen fit
 */
export function lidAnchorZ(heightUnitMm: number, fitClearance: number): number {
  return -heightUnitMm - LID_EXTRA_HEIGHT + LIP_HEIGHT + Math.SQRT2 * fitClearance * 2;
}

/**
 * Bottom of the mating wall in lid-local Z coords.
 *
 * Below this Z, the lid wall is finished — the click rails take over from here.
 */
export function lidWallBottomZ(heightUnitMm: number, fitClearance: number): number {
  return lidAnchorZ(heightUnitMm, fitClearance) - LIP_BIG_TAPER - LIP_VERTICAL_PART;
}

/* ──────────────────────────────────────────────────────────────────────
 * Click rail cross-section dimensions (X = outward from corner-radius
 * line, Y = vertical). The polygon protrudes OUTWARD (positive X) to form
 * the rail bump that catches the lip's bottom chamfer when the lid clicks on.
 *
 * Body shape (top to bottom):
 *   - Top entry chamfer at TOP_CHAMFER thick lets the lid slide on smoothly
 *   - Bump face protrudes by OUT, then drops in by INSET via ENTRY_CHAMFER
 *   - Vertical rail body for BUMP + 0.1mm
 *   - Exit chamfer relieves geometry past the bump
 *   - Drop + tail provide structural depth below
 *   - Inner face (INNER) pushes into the bin cavity for grip
 * ──────────────────────────────────────────────────────────────────────── */

/** Click rail engagement depth (the snap "bump" height). */
export const LID_CLICK_RAIL_BUMP = 0.6;
/** Rail entry chamfer depth (lid slides on smoothly). */
export const LID_CLICK_RAIL_ENTRY_CHAMFER = 0.8;
/** Rail exit chamfer (geometry stability). */
export const LID_CLICK_RAIL_EXIT_CHAMFER = 0.2;
/** Vertical extension below the rail bump. */
export const LID_CLICK_RAIL_DROP = 0.8;
/** Final tail length below the rail body. */
export const LID_CLICK_RAIL_TAIL = 1.25;
/** How far the rail's outer face protrudes from the corner-radius line. */
export const LID_CLICK_RAIL_OUT = 1.85;
/** Inward shift for the rail's body relative to outer protrusion. */
export const LID_CLICK_RAIL_INSET = 0.8;
/** Inner face of the rail (inside the bin cavity). */
export const LID_CLICK_RAIL_INNER = -0.8;
/** Top entry chamfer (lid slides over lip easily). */
export const LID_CLICK_RAIL_TOP_CHAMFER = 0.8;

/* ──────────────────────────────────────────────────────────────────────
 * Magnet positions are shared with the bin base via magnetPositionsForCell
 * (see lidMagnets.ts), so the lid holes always line up with the sockets of a
 * bin stacked on top — including the wall-distance clamp on small/non-square
 * cells. No lid-local offset constant is kept, to avoid the two drifting.
 * ──────────────────────────────────────────────────────────────────────── */

/** Coplanar margin used at boolean cut/fuse interfaces. */
export const LID_COPLANAR_MARGIN = 0.1;

/** Tiny safety floor for rounded rectangle corner radii (avoids OCCT
 *  degeneracy when an inner inset equals the outer corner radius). */
export const LID_MIN_CORNER_RADIUS = 0.1;
