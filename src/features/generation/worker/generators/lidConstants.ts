/**
 * Click-lock lid geometry constants.
 *
 * Reference: AnyLid OpenSCAD by rngcntr (gridfinity-bin-lids.scad). The
 * profiles below are direct translations of the SCAD modules `BottomShape`,
 * `ClickShape`, `TopShape`, and `BottomChamferShape`.
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

/** SCAD reference's `measured_extra_height` — 0.2mm of extra clearance baked
 *  into the anchor calculation to compensate for first-layer squish. */
export const LID_EXTRA_HEIGHT = 0.2;

/**
 * Anchor Z position — where the lid's mating cavity starts opening up to
 * receive the bin's stacking lip when the lid is snapped on.
 *
 * SCAD: `anchor() = -7 - measured_extra + LIP_HEIGHT + sqrt(2)*Cl*2`
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
 * ClickShape geometry — translates SCAD's `ClickShape` polygon.
 *
 * SCAD polygon (with X = outward from corner-radius line, Y = vertical):
 *   [0, anchor-3.7]                          start, on the corner-radius line
 *   [3.75-1.9, anchor-3.7]                   = [1.85, anchor-3.7]
 *   [3.75-1.9-0.8, anchor-3.7-0.8]           = [1.05, anchor-4.5]    entry chamfer
 *   [3.75-1.9-0.8, anchor-3.7-0.8-CR-0.1]    rail body (vertical)
 *   [3.75-1.9-0.8+0.2, anchor-3.7-0.8-CR-0.1-0.2]  exit chamfer
 *   [3.75-1.9-0.8+0.2, anchor-3.7-0.8-CR-0.1-0.2-0.8]
 *   [0, anchor-3.7-0.8-CR-0.1-0.2-0.8-1.25]  bottom-right
 *   [-0.8, anchor-3.7-0.8-CR-0.1-0.2-0.8-1.25]  bottom-left
 *   [-0.8, anchor-3.7]                       up the inside face
 *   [0, anchor-3.7+0.8]                      top entry chamfer
 *
 * The shape protrudes OUTWARD (positive X) to form the rail bump; the bump
 * is the part that catches the lip's bottom chamfer when the lid clicks on.
 * ──────────────────────────────────────────────────────────────────────── */

/** Click rail engagement depth (the snap "bump" height). SCAD `Click_Rail_mm`. */
export const LID_CLICK_RAIL_BUMP = 0.6;
/** Rail entry chamfer depth (lid slides on smoothly). */
export const LID_CLICK_RAIL_ENTRY_CHAMFER = 0.8;
/** Rail exit chamfer (geometry stability). */
export const LID_CLICK_RAIL_EXIT_CHAMFER = 0.2;
/** Vertical extension below the rail bump (sets total ClickShape Y range). */
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
