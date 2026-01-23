/**
 * Gridfinity dimension constants.
 *
 * Source of truth: Kennetek's gridfinity-rebuilt-openscad
 * https://github.com/kennetek/gridfinity-rebuilt-openscad
 */

/** All Gridfinity dimension constants in millimeters */
export const GRIDFINITY = {
  // Base grid
  GRID_SIZE: 42, // mm per 1x1 unit
  HEIGHT_UNIT: 7, // mm per height unit

  // Tolerances
  TOLERANCE: 0.5, // mm clearance for bin-to-baseplate fit

  // Base profile
  BASE_HEIGHT: 5, // mm total base height
  BASE_BOTTOM_FILLET: 0.8, // mm bottom edge radius
  BASE_TOP_FILLET: 2.15, // mm top edge radius (stacking interface)

  // Stacking lip
  LIP_HEIGHT: 4.4, // mm
  LIP_FILLET: 1.6, // mm

  // Magnet holes
  MAGNET_DIAMETER: 6.5, // mm (6mm magnet + tolerance)
  MAGNET_DEPTH: 2.4, // mm (2mm magnet + tolerance)
  MAGNET_INSET: 4.8, // mm from corner

  // Screw holes
  SCREW_DIAMETER: 3, // mm (M3)
  SCREW_DEPTH: 6, // mm

  // Walls
  WALL_THICKNESS: 1.2, // mm default (standard style)
  BOTTOM_THICKNESS: 0.7, // mm above base structure

  // Fillets
  OUTER_FILLET: 3.75, // mm on outer vertical edges
  INNER_FILLET: 1.6, // mm on inner vertical edges
} as const;

/** Wall thickness per bin style (mm) */
export const STYLE_WALL_THICKNESS: Record<string, number> = {
  standard: 1.2,
  lite: 0.8,
  solid: 1.6,
  vase: 0.4,
  rugged: 2.0,
} as const;

/** Dimension constraints for bin parameters */
export const DESIGNER_CONSTRAINTS = {
  MIN_DIMENSION: 0.5, // grid units
  MAX_DIMENSION: 6, // grid units
  DIMENSION_STEP: 0.5, // grid units
  MIN_HEIGHT: 1, // height units
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
