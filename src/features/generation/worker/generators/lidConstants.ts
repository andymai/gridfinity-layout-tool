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

/* ──────────────────────────────────────────────────────────────────────
 * Opinionated lid dimensions, sourced from the AnyLid OpenSCAD reference
 * (gridfinity-bin-lids.scad by rngcntr). The bin uses Kennetek's 3.75mm
 * BOX_CORNER_RADIUS, but the lid SCAD uses its own 4mm `Corner_Radius`
 * with `Clearance = 0.25` — using the bin's value (3.75mm) for the lid
 * shifts the click rails 0.25mm outward and shrinks the wall thickness
 * by 0.65mm, which is why earlier renders had the lid "wider on top" and
 * not engaging the lip correctly.
 * ──────────────────────────────────────────────────────────────────────── */

/** SCAD: `Corner_Radius_mm = 4` — the lid's outer corner radius BEFORE
 *  clearance subtraction. Lid-specific; do NOT reuse `BOX_CORNER_RADIUS`
 *  (3.75mm) which is the bin's spec. */
export const LID_CORNER_RADIUS = 4;

/** Per-side clearance between the lid's mating profile and the bin's
 *  stacking lip. SCAD: `Clearance_mm = 0.25`. Replaces the old
 *  loose/standard/tight preset map — one validated value, no UI knob. */
export const LID_FIT_CLEARANCE = 0.25;

/** Floor plate thickness when no magnet pockets are needed.
 *  SCAD: `Thickness_mm = 0.8`. */
export const LID_TOP_THICKNESS_BASE = 0.8;

/** Side-wall thickness in the lip-mating zone — derived from SCAD's
 *  BottomShape geometry: outer chamfer steps inward by `LIP_BIG_TAPER`
 *  and the inner cavity face sits at `LID_CORNER_RADIUS - Clearance`,
 *  so the wall is `(LID_CORNER_RADIUS - LID_FIT_CLEARANCE) -
 *  LIP_BIG_TAPER = 1.85mm` thick. Implicit in SCAD; we keep it as a
 *  named constant so the rail/cavity helpers can reference it. */
export const LID_WALL_THICKNESS = LID_CORNER_RADIUS - LID_FIT_CLEARANCE - LIP_BIG_TAPER;

/** Minimum solid material above a magnet pocket so it can't punch through
 *  to the cavity face — keeps the lid sealed at typical FDM settings. */
export const LID_MAGNET_CEILING = 0.6;

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
 * Magnet positions — same Gridfinity offsets used by the bin's base sockets.
 * ──────────────────────────────────────────────────────────────────────── */
/** Distance from each cell center where the lid drills its 4 magnet holes. */
export const LID_MAGNET_OFFSET = 13;
export const LID_MAGNET_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-LID_MAGNET_OFFSET, -LID_MAGNET_OFFSET],
  [LID_MAGNET_OFFSET, -LID_MAGNET_OFFSET],
  [LID_MAGNET_OFFSET, LID_MAGNET_OFFSET],
  [-LID_MAGNET_OFFSET, LID_MAGNET_OFFSET],
];

/** Coplanar margin used at boolean cut/fuse interfaces. */
export const LID_COPLANAR_MARGIN = 0.1;

/** Tiny safety floor for rounded rectangle corner radii (avoids OCCT
 *  degeneracy when an inner inset equals the outer corner radius). */
export const LID_MIN_CORNER_RADIUS = 0.1;
