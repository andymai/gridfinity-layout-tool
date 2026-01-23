/**
 * Gridfinity dimension constants.
 *
 * Source of truth: Kennetek's gridfinity-rebuilt-openscad
 * https://github.com/kennetek/gridfinity-rebuilt-openscad
 */

/** All Gridfinity dimension constants in millimeters.
 *
 * Source: Kennetek's gridfinity-rebuilt-openscad (standard.scad)
 * https://github.com/kennetek/gridfinity-rebuilt-openscad
 *
 * Height convention: height units INCLUDE the base.
 * A "3U" bin is 3×7=21mm tall (body), with lip adding 4.4mm on top.
 * Cavity height = (height - 1) × 7mm.
 */
export const GRIDFINITY = {
  // Base grid
  GRID_SIZE: 42, // mm per 1x1 unit
  HEIGHT_UNIT: 7, // mm per height unit (includes base in first unit)

  // Tolerances
  TOLERANCE: 0.5, // mm clearance for bin-to-baseplate fit (BASE_GAP_MM)

  // Base profile (total dead space from bottom to cavity floor)
  BASE_HEIGHT: 7, // mm total (profile + bridge structure per spec)
  BASE_BOTTOM_FILLET: 0.8, // mm bottom edge radius (r_c1)
  BASE_TOP_FILLET: 2.15, // mm top edge radius (stacking interface)

  // Stacking lip (sits on top of bin body)
  LIP_HEIGHT: 4.4, // mm nominal (actual ~3.55mm with fillet)
  LIP_FILLET: 0.6, // mm fillet radius (STACKING_LIP_FILLET_RADIUS)

  // Magnet holes
  MAGNET_DIAMETER: 6.5, // mm (6mm magnet + tolerance)
  MAGNET_DEPTH: 2.4, // mm (MAGNET_HEIGHT + 2*LAYER_HEIGHT)
  MAGNET_INSET: 4.8, // mm from corner (HOLE_DISTANCE_FROM_BOTTOM_EDGE)

  // Screw holes
  SCREW_DIAMETER: 3, // mm (M3)
  SCREW_DEPTH: 6, // mm

  // Walls
  WALL_THICKNESS: 0.95, // mm (d_wall from spec: outer_fillet - inner_fillet)
  BOTTOM_THICKNESS: 0.7, // mm floor within base (not used in height calc)

  // Fillets (used for future BREP generation, not Alpha boxes)
  OUTER_FILLET: 3.75, // mm on outer vertical edges (r_fo1 = 7.5/2)
  INNER_FILLET: 2.8, // mm on inner vertical edges (r_f2)
} as const;

/** Wall thickness per bin style (mm) */
export const STYLE_WALL_THICKNESS: Record<string, number> = {
  standard: 0.95,
  lite: 0.65,
  solid: 1.6,
  vase: 0.4,
  rugged: 2.0,
} as const;

/** Dimension constraints for bin parameters */
export const DESIGNER_CONSTRAINTS = {
  MIN_DIMENSION: 0.5, // grid units
  MAX_DIMENSION: 6, // grid units
  DIMENSION_STEP: 0.5, // grid units
  MIN_HEIGHT: 2, // height units (1U = base only, no cavity)
  MAX_HEIGHT: 12, // height units
  HEIGHT_STEP: 1, // height units
  MAX_DIVIDERS: 10, // per axis
  MIN_DIVIDER_THICKNESS: 0.8, // mm
  MAX_DIVIDER_THICKNESS: 2.0, // mm
  MIN_WALL_CUTOUT: 20, // % (minimum when > 0)
  MAX_WALL_CUTOUT: 100, // %
  MAX_LABEL_LENGTH: 20, // characters
  MAX_HISTORY: 50, // undo/redo states
  MAGNET_MIN_DEPTH: 2.0, // mm
  MAGNET_MAX_DEPTH: 4.0, // mm
} as const;
