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

  // Stacking lip (sits on top of bin body) - per spec v5
  LIP_HEIGHT: 4.4, // mm total (0.7 + 1.8 + 1.9)
  LIP_SMALL_TAPER: 0.7, // mm bottom 45° chamfer
  LIP_VERTICAL_PART: 1.8, // mm vertical section
  LIP_BIG_TAPER: 1.9, // mm top 45° chamfer

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

  // Fillets (used for BREP generation)
  TOP_FILLET: 0.6, // mm fillet at stacking lip junction
} as const;

/** Wall thickness per bin style (mm) */
export const STYLE_WALL_THICKNESS: Record<string, number> = {
  standard: 0.95,
  lite: 0.65,
  solid: 1.6,
} as const;

/** Dimension constraints for bin parameters */
export const DESIGNER_CONSTRAINTS = {
  MIN_DIMENSION: 0.5, // grid units
  MAX_DIMENSION: 8, // grid units (expanded: standard Gridfinity supports large bins)
  DIMENSION_STEP: 0.5, // grid units
  MIN_HEIGHT: 2, // height units (1U = base only, 2U minimum for usable cavity)
  MAX_HEIGHT: 20, // height units (expanded: tall bins for tools/bottles)
  HEIGHT_STEP: 1, // height units
  // Compartment grid
  MIN_COMPARTMENT_GRID: 1, // min rows/cols
  MAX_COMPARTMENT_GRID: 8, // max rows/cols
  MIN_COMPARTMENT_THICKNESS: 0.4, // mm divider wall thickness
  MAX_COMPARTMENT_THICKNESS: 2.4, // mm divider wall thickness
  COMPARTMENT_THICKNESS_STEP: 0.1, // mm (legacy — use WALL_THICKNESS_OPTIONS)
  MIN_COMPARTMENT_SIZE: 5, // mm (minimum viable compartment dimension)
  MAX_LABEL_LENGTH: 20, // characters
  MAX_HISTORY: 100, // undo/redo states
  // Wall thickness
  MIN_WALL_THICKNESS: 0.4, // mm (1-wall for 0.4mm nozzle)
  MAX_WALL_THICKNESS: 2.4, // mm (3-wall for 0.8mm nozzle)
  WALL_THICKNESS_STEP: 0.1, // mm (legacy — use WALL_THICKNESS_OPTIONS)
  // Magnet holes (radius in UI, diameter in store)
  MIN_MAGNET_RADIUS: 2.0, // mm (diameter 4mm)
  MAX_MAGNET_RADIUS: 5.0, // mm (diameter 10mm)
  MAGNET_RADIUS_STEP: 0.25, // mm
  MIN_MAGNET_HEIGHT: 1.0, // mm
  MAX_MAGNET_HEIGHT: 4.0, // mm
  MAGNET_HEIGHT_STEP: 0.5, // mm
  // Screw holes (radius in UI, diameter in store)
  MIN_SCREW_RADIUS: 1.0, // mm (diameter 2mm)
  MAX_SCREW_RADIUS: 3.0, // mm (diameter 6mm)
  SCREW_RADIUS_STEP: 0.25, // mm
} as const;

/**
 * Valid wall thickness options — multiples of common FDM nozzle sizes (0.4, 0.6, 0.8mm).
 * Used for both exterior wall thickness and interior divider walls.
 */
export const WALL_THICKNESS_OPTIONS = [0.4, 0.6, 0.8, 1.2, 1.6, 1.8, 2.0, 2.4] as const;
