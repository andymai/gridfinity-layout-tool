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

  // Base socket (per-cell interface that slides onto baseplate grid)
  SOCKET_HEIGHT: 5, // mm total socket depth below bin floor
  SOCKET_SMALL_TAPER: 0.8, // mm bottom 45° chamfer (matches BASE_BOTTOM_FILLET)
  SOCKET_BIG_TAPER: 2.4, // mm upper 45° chamfer
  // Derived: SOCKET_VERTICAL_PART = SOCKET_HEIGHT - SMALL_TAPER - BIG_TAPER = 1.8mm
  // Derived: SOCKET_TAPER_WIDTH = SMALL_TAPER + BIG_TAPER = 3.2mm (inset from outer edge)

  // Corner radius for socket profile
  SOCKET_CORNER_RADIUS: 4, // mm (r_base from spec)

  // Fillets (used for BREP generation)
  OUTER_FILLET: 3.75, // mm on outer vertical edges (r_fo1 = 7.5/2)
  INNER_FILLET: 2.8, // mm on inner vertical edges (r_f2)
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
  MIN_HEIGHT: 2, // height units (1U = base only, no cavity)
  MAX_HEIGHT: 20, // height units (expanded: tall bins for tools/bottles)
  HEIGHT_STEP: 1, // height units
  MAX_DIVIDERS: 10, // per axis
  MIN_DIVIDER_THICKNESS: 0.8, // mm
  MAX_DIVIDER_THICKNESS: 2.0, // mm
  MIN_COMPARTMENT_SIZE: 5, // mm (minimum viable compartment after dividers)
  MIN_WALL_CUTOUT: 20, // % (minimum when > 0)
  MAX_WALL_CUTOUT: 100, // %
  MAX_LABEL_LENGTH: 20, // characters
  MAX_HISTORY: 50, // undo/redo states
  MAGNET_MIN_DEPTH: 2.0, // mm
  MAGNET_MAX_DEPTH: 4.0, // mm
  MIN_SCOOP_RADIUS: 2.0, // mm (minimum useful scoop)
  MAX_SCOOP_RADIUS: 30.0, // mm (large scoops for deep bins)
  // Wall thickness
  MIN_WALL_THICKNESS: 0.8, // mm (single-wall FDM minimum)
  MAX_WALL_THICKNESS: 2.4, // mm (3 standard 0.4mm nozzle lines × 2)
  WALL_THICKNESS_STEP: 0.1, // mm
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
