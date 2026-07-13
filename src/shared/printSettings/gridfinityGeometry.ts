/**
 * Gridfinity dimension constants shared across features.
 *
 * Extracted from bin-designer so that print-export and other features
 * can compute accurate bin geometry without importing feature-internal modules.
 *
 * Dimensions sourced from Kennetek's gridfinity-rebuilt-openscad for
 * interoperability with the open Gridfinity ecosystem.
 * https://github.com/kennetek/gridfinity-rebuilt-openscad
 */

/** All Gridfinity dimension constants in millimeters.
 *
 * Dimensions for interoperability with the open Gridfinity ecosystem.
 * Reference: Kennetek's gridfinity-rebuilt-openscad (standard.scad)
 * https://github.com/kennetek/gridfinity-rebuilt-openscad
 *
 * Height convention: height units INCLUDE the base.
 * A "3U" bin is 3×7=21mm tall (body), with lip adding 4.4mm on top.
 * Cavity height = (height - 1) × 7mm.
 */
export const GRIDFINITY_SPEC = {
  // Base grid
  GRID_SIZE: 42, // mm per 1x1 unit
  HEIGHT_UNIT: 7, // mm per height unit (includes base in first unit)

  // Tolerances
  TOLERANCE: 0.5, // mm clearance for bin-to-baseplate fit (BASE_GAP_MM)

  // Base profile (total dead space from bottom to cavity floor)
  BASE_HEIGHT: 7, // mm total (profile + bridge structure per spec)

  // Stacking lip (sits on top of bin body) - per spec v5
  LIP_HEIGHT: 4.4, // mm total (0.7 + 1.8 + 1.9)
  LIP_SMALL_TAPER: 0.7, // mm bottom 45° chamfer
  LIP_VERTICAL_PART: 1.8, // mm vertical section
  LIP_BIG_TAPER: 1.9, // mm top 45° chamfer
  // Z overlap when fusing the lip onto the bin shell. The lip translates
  // to wallTop − LIP_OVERLAP so its top face lands at wallTop + LIP_HEIGHT
  // − LIP_OVERLAP. Must remain < LIP_SMALL_TAPER so the interior cavity
  // still clears the lip base.
  LIP_OVERLAP: 0.1, // mm

  // Magnet holes (spec defaults; configurable via BinParams.base)
  MAGNET_DIAMETER: 6.5, // mm (6mm magnet + tolerance)
  MAGNET_DEPTH: 2.4, // mm (MAGNET_HEIGHT + 2*LAYER_HEIGHT)

  // Screw holes (spec defaults; configurable via BinParams.base)
  SCREW_DIAMETER: 3, // mm (M3)

  // Walls
  WALL_THICKNESS: 0.95, // mm (d_wall from spec: outer_fillet - inner_fillet)

  // Base socket (per-cell interface that slides onto baseplate grid)
  SOCKET_HEIGHT: 5, // mm total socket depth below bin floor
  SOCKET_SMALL_TAPER: 0.8, // mm bottom 45° chamfer (matches BASE_BOTTOM_FILLET)
  SOCKET_BIG_TAPER: 2.4, // mm upper 45° chamfer
  // Derived: SOCKET_VERTICAL_PART = SOCKET_HEIGHT - SMALL_TAPER - BIG_TAPER = 1.8mm
  // Derived: SOCKET_TAPER_WIDTH = SMALL_TAPER + BIG_TAPER = 3.2mm (inset from outer edge)

  // Corner radius for socket profile
  SOCKET_CORNER_RADIUS: 4, // mm (r_base from spec)

  // Corner radius for box body (outer wall profile)
  // Per gridfinity.xyz spec: boxes use 3.75mm, baseplates use 4mm.
  // The 0.25mm difference creates a slight interference fit so bins seat
  // flush on the baseplate without magnets.
  BOX_CORNER_RADIUS: 3.75, // mm (r_base - 0.25mm per original spec)

  // Fillets (used for BREP generation)
  TOP_FILLET: 0, // mm — original spec has no fillet at stacking lip peak
} as const;
/**
 * Number of perimeter walls per nozzle size, matching common slicer defaults.
 *
 * Most slicers default to 2 perimeters. For very small nozzles (0.2mm),
 * 4 perimeters are common to maintain structural integrity.
 * For very large nozzles (1.0mm), a single perimeter suffices.
 */
export const NOZZLE_WALL_COUNTS: Partial<Record<number, number>> = {
  0.2: 4,
  0.4: 2,
  0.6: 2,
  0.8: 2,
  1.0: 1,
};

/**
 * Minimum solid pad margin around a magnet hole, keyed by standard nozzle.
 *
 * Sized to clear whole perimeters at the slicer's line width (≈ nozzle × 1.025,
 * measured from a Bambu profile), not a bare multiple of nozzle diameter, so the
 * wall around the hole prints as solid perimeters instead of a partial-bead gap
 * (issue #2559). 3 perimeters at 0.8mm (line width ~0.82mm) need 2.46mm → 2.5mm;
 * at 0.6mm (~0.615mm) need 1.85mm → 1.9mm.
 */
const MAGNET_PAD_MARGINS: Partial<Record<number, number>> = {
  0.6: 1.9,
  0.8: 2.5,
  1.0: 2.0,
};

/**
 * Compute wall thickness for a given nozzle size.
 *
 * Returns nozzleSizeMm × perimeterCount for known nozzle sizes,
 * or falls back to the Gridfinity spec default (0.95mm).
 *
 * @param nozzleSizeMm - Nozzle diameter in mm
 * @returns Wall thickness in mm
 */
export function wallThicknessForNozzle(nozzleSizeMm: number): number {
  const count = NOZZLE_WALL_COUNTS[nozzleSizeMm];
  if (count !== undefined) {
    return nozzleSizeMm * count;
  }
  return GRIDFINITY_SPEC.WALL_THICKNESS;
}

/**
 * Minimum solid pad margin around a magnet hole.
 *
 * Values are tuned to retain a printable bridge around the hole while keeping
 * the legacy 0.4mm geometry unchanged. Unknown nozzle sizes use the resolved
 * wall thickness plus one bead as a conservative fallback.
 */
export function magnetPadMarginForNozzle(nozzleSizeMm?: number): number {
  if (nozzleSizeMm === undefined || nozzleSizeMm <= 0.4) return 1;
  return (
    MAGNET_PAD_MARGINS[nozzleSizeMm] ??
    Math.max(1, wallThicknessForNozzle(nozzleSizeMm) + nozzleSizeMm)
  );
}

/**
 * Additional outside-edge margin for the optional lightweight floor relief.
 *
 * Keep the 0.4mm/omitted-nozzle relief byte-compatible; wider nozzles need the
 * relief to stop short of the pocket-bottom edge so the magnet pad has material
 * on both its inner and outer sides.
 */
export function magnetOuterWallMarginForNozzle(nozzleSizeMm?: number): number {
  if (nozzleSizeMm === undefined || nozzleSizeMm <= 0.4) return 0;
  return magnetPadMarginForNozzle(nozzleSizeMm);
}
