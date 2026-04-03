/**
 * Gridfinity specification constants used across generator modules.
 *
 * All values are in millimeters unless otherwise noted.
 * Sources: Gridfinity spec v5, measured from reference models.
 */

import { GRIDFINITY } from '@/shared/constants/bin';
export const SIZE = GRIDFINITY.GRID_SIZE;
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

/**
 * Z overlap (mm) when fusing the stacking lip onto the bin shell.
 * Prevents a coplanar face at Z=wallHeight that the boolean would preserve
 * as a visible seam. Must remain < LIP_SMALL_TAPER (0.7mm) so that
 * interiorHeight still clears the actual lip base.
 */
export const LIP_OVERLAP = 0.1;

/** Corner radius for baseplate outer perimeter (same as socket corner radius) */
export const PLATE_CORNER_RADIUS = CORNER_RADIUS;

/** Thin floor under each magnet hole — retains the magnet (mm) */
export const MAGNET_FLOOR = 0.5;

/** Z extension above/below to avoid coplanar boolean failures (mm). */
export const COPLANAR_MARGIN = 1;

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
