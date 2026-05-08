/**
 * Gridfinity specification constants used across generator modules.
 *
 * All values are in millimeters unless otherwise noted.
 * Sources: Gridfinity spec v5, measured from reference models.
 */

import { GRIDFINITY } from '@/shared/constants/bin';
export const SIZE = GRIDFINITY.GRID_SIZE;
export const HEIGHT_UNIT = GRIDFINITY.HEIGHT_UNIT;
export const CLEARANCE = GRIDFINITY.TOLERANCE;
export const CORNER_RADIUS = GRIDFINITY.SOCKET_CORNER_RADIUS;
export const BOX_CORNER_RADIUS = GRIDFINITY.BOX_CORNER_RADIUS;
export const SOCKET_HEIGHT = GRIDFINITY.SOCKET_HEIGHT;
export const SOCKET_SMALL_TAPER = GRIDFINITY.SOCKET_SMALL_TAPER;
export const SOCKET_BIG_TAPER = GRIDFINITY.SOCKET_BIG_TAPER;
export const SOCKET_VERTICAL_PART = SOCKET_HEIGHT - SOCKET_SMALL_TAPER - SOCKET_BIG_TAPER;
export const SOCKET_TAPER_WIDTH = SOCKET_SMALL_TAPER + SOCKET_BIG_TAPER;
export const TOP_FILLET = GRIDFINITY.TOP_FILLET;
export const LIP_SMALL_TAPER = GRIDFINITY.LIP_SMALL_TAPER; // 0.7mm bottom chamfer
export const LIP_VERTICAL_PART = GRIDFINITY.LIP_VERTICAL_PART; // 1.8mm vertical
export const LIP_BIG_TAPER = GRIDFINITY.LIP_BIG_TAPER; // 1.9mm top chamfer
export const LIP_HEIGHT = LIP_SMALL_TAPER + LIP_VERTICAL_PART + LIP_BIG_TAPER; // 4.4mm total
export const LIP_TAPER_WIDTH = LIP_SMALL_TAPER + LIP_BIG_TAPER; // 2.6mm horizontal inset
export const LIP_OVERLAP = GRIDFINITY.LIP_OVERLAP;

/** Corner radius for baseplate outer perimeter (same as socket corner radius) */
export const PLATE_CORNER_RADIUS = CORNER_RADIUS;

/** Thin floor under each magnet hole — retains the magnet (mm) */
export const MAGNET_FLOOR = 0.5;

/** Z extension above/below to avoid coplanar boolean failures (mm). */
export const COPLANAR_MARGIN = 1;

/**
 * Tiny volumetric overlap between mating solids at a fuse/cut interface.
 * Defeats OCCT's coplanar-face handling, which otherwise produces
 * non-manifold topology that slicers repair as solid infill.
 * Used by slot cutters (slotBuilder) and dovetail tongues (baseplateGenerator).
 */
export const COPLANAR_OVERLAP = 0.01;

/** Distance from cell center to magnet position (Gridfinity spec, mm) */
export const HOLE_OFFSET = 13;

/** Inset at pocket bottom (same taper profile as bin socket at full cell size) */
export const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

/** Magnet position offsets relative to cell center (4 corners per cell) */
export const MAGNET_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-HOLE_OFFSET, -HOLE_OFFSET],
  [HOLE_OFFSET, -HOLE_OFFSET],
  [HOLE_OFFSET, HOLE_OFFSET],
  [-HOLE_OFFSET, HOLE_OFFSET],
];

/** Compute pocket corner radius for a given cell size (clamped to fit) */
export function pocketCornerRadius(cellW_mm: number, cellD_mm: number): number {
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  return Math.min(CORNER_RADIUS, maxRadius);
}

/**
 * Resolve per-corner radii from params, applying defaults and clamping.
 * Priority: cornerRadii > cornerRadius > PLATE_CORNER_RADIUS (spec default).
 */
export function resolveCornerRadii(
  params: {
    cornerRadius?: number;
    cornerRadii?: { tl: number; tr: number; bl: number; br: number };
  },
  maxRadius: number
): { tl: number; tr: number; bl: number; br: number } {
  const defaultR = params.cornerRadius ?? PLATE_CORNER_RADIUS;
  const radii = params.cornerRadii ?? { tl: defaultR, tr: defaultR, bl: defaultR, br: defaultR };
  const clamp = (r: number): number => Math.max(0, Math.min(r, maxRadius));
  return {
    tl: clamp(radii.tl),
    tr: clamp(radii.tr),
    bl: clamp(radii.bl),
    br: clamp(radii.br),
  };
}

// Split baseplate pieces use discrete dovetail connectors at grid cell boundary
// intersections along join edges. Each connector is a trapezoidal prism with the
// classic dovetail fan shape visible from the top (X-Y plane): narrower at the
// wall (BASE_HALF), wider at the protruding tip (TIP_HALF).
// Assembly: pieces drop in from above (Z-axis). The dovetail taper is in the
// X-Y plane, so vertical insertion is unimpeded. Once seated, the wider tip
// prevents horizontal pull-out through the narrower groove opening.
// Convention: left/front edges get tongues (male), right/back get grooves (female).

/** How far the tongue protrudes horizontally from the wall face (mm) */
export const TONGUE_PROTRUSION = 1.5;

/** Half-width at the wall face — narrow end of the dovetail (mm) */
export const TONGUE_BASE_HALF = 1.0;

/** Half-width at the protruding tip — wide end of the dovetail (mm) */
export const TONGUE_TIP_HALF = 1.3;

/** Per-side clearance added to the groove for FDM tolerance (mm) */
export const TONGUE_CLEARANCE = 0.15;
export const NUB_DIAMETER = 1.5;
export const NUB_DEPTH = 0.8;
const HOLE_CLEARANCE = 0.1;
export const HOLE_DIAMETER = NUB_DIAMETER + 2 * HOLE_CLEARANCE;
export const HOLE_DEPTH = NUB_DEPTH + HOLE_CLEARANCE;
export const NUB_CIRCLE_SEGMENTS = 12;

// Snap-clip baseplate connectors — separately printed U-clip + cut-through
// holes in the slab. Modeled after the MakerWorld SnapClip System (model
// 1034973), which is itself a remix of Printables 430144.
//
// Use orientation (clip mounted in baseplate):
//
//      ┌──────────────┐  ← bridge sits on top of slab, spans the seam
//      │  ▓▓▓▓▓▓▓▓▓▓  │
//      │  │        │  │  ← prongs descend through holes in adjacent pieces
//   ───┤  │        │  ├───
//      │  ▽        ▽  │  ← barb tips: lead-in chamfer; widest point sits
//      └──────────────┘    just below slab bottom, hooks back under
//
//          seam (between two baseplate pieces)
//
// Print orientation: the clip generator outputs the part flipped — bridge on
// the build plate (Z=0) with prongs pointing up. This avoids unsupported
// overhangs and lets the slicer take it as-is.
//
// Hole layout: at every grid-cell boundary along a 'join' edge (matching the
// dovetail density). Each clip spans the seam, with one prong inset
// SNAP_PRONG_INSET into each adjacent piece. The inset keeps holes well clear
// of magnet pads at grid-cell corners.

/** Prong shaft diameter (mm). 3mm gives a comfortable PETG flex zone. */
export const SNAP_PRONG_DIAMETER = 3.0;

/** Distance from the seam to each prong's centerline (mm). 5mm clears
 *  magnet pads at grid corners by ~16mm. */
export const SNAP_PRONG_INSET = 5.0;

/** How far the prong overshoots the slab bottom in use, before the barb
 *  starts (mm). Ensures the barb's wide point seats below the floor. */
export const SNAP_PRONG_OVERSHOOT = 0.5;

/** Bridge plate thickness above the slab (mm). */
export const SNAP_BRIDGE_THICKNESS = 1.5;

/** Bridge plate width perpendicular to the seam (mm). */
export const SNAP_BRIDGE_WIDTH = 6.0;

/** Bridge plate length margin past the prong centers on each side (mm).
 *  Total bridge length = 2 * (INSET + LENGTH_MARGIN). */
export const SNAP_BRIDGE_LENGTH_MARGIN = 2.0;

/** Radial flare at the barb's widest point above the prong radius (mm).
 *  Compression on insertion ≈ flare/clearance ratio — 0.25 keeps PETG
 *  in its elastic range while still snapping audibly. */
export const SNAP_BARB_FLARE = 0.25;

/** Barb is a two-frustum profile (use orientation, prong points DOWN):
 *
 *      ──┬──  Z = -prongLength                  ┐
 *        │ │  prong shaft (radius PRONG_R)      │ slab thickness
 *      ──┼──  Z = -prongLength + RETAIN_H       ┘
 *       ╱ ╲   retention shoulder (steep ~27°)    upper frustum
 *      ╱   ╲  PRONG_R → BARB_R (= PRONG_R+FLARE)
 *     ──┼──   widest point: barb max radius
 *      ╲   ╱
 *       ╲ ╱   lead-in cone (gentle ~37°)         lower frustum
 *        ▽    BARB_R → TIP_R (= PRONG_R-0.5)
 *      ──┼──  Z = -prongLength - RETAIN_H - LEAD_H
 *
 * The asymmetry — steep top, gentle bottom — gives easy push-in and high
 * pull-out resistance, which is the whole point of a snap clip. */
export const SNAP_BARB_RETAIN_HEIGHT = 0.5;
export const SNAP_BARB_LEAD_HEIGHT = 1.0;
export const SNAP_BARB_HEIGHT = SNAP_BARB_RETAIN_HEIGHT + SNAP_BARB_LEAD_HEIGHT;

/** Tip flat-radius (mm). A pinpoint tip prints poorly on FDM (rounded
 *  elephant's foot); a 1mm flat tip is the smallest reliable feature. */
export const SNAP_TIP_RADIUS = 1.0;

/** Per-side clearance between prong and through-hole (mm). */
export const SNAP_HOLE_CLEARANCE = 0.2;

/** Computed hole diameter through the slab. */
export const SNAP_HOLE_DIAMETER = SNAP_PRONG_DIAMETER + 2 * SNAP_HOLE_CLEARANCE;

/** Circle segment count for prong/hole tessellation. */
export const SNAP_CIRCLE_SEGMENTS = 24;
