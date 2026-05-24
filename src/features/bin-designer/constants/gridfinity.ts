/**
 * Gridfinity dimension constants for the bin designer.
 *
 * Core spec constants are defined in the shared module and re-exported here
 * so that existing bin-designer code continues to work without import changes.
 *
 * Source of truth: Kennetek's gridfinity-rebuilt-openscad
 * https://github.com/kennetek/gridfinity-rebuilt-openscad
 */

export { GRIDFINITY_SPEC as GRIDFINITY } from '@/shared/printSettings/gridfinityGeometry';

/** Wall thickness per bin style (mm) */
export const STYLE_WALL_THICKNESS: Record<string, number> = {
  standard: 0.95,
  slotted: 0.95,
} as const;

/** Dimension constraints for bin parameters */
export const DESIGNER_CONSTRAINTS = {
  MIN_DIMENSION: 0.5, // grid units
  MAX_DIMENSION: 16, // grid units (expanded: standard Gridfinity supports large bins)
  DIMENSION_STEP: 0.5, // grid units
  MIN_HEIGHT: 2, // height units (1U = base only, 2U minimum for usable cavity)
  MAX_HEIGHT: 20, // height units (expanded: tall bins for tools/bottles)
  HEIGHT_STEP: 1, // height units
  // Compartment grid
  MIN_COMPARTMENT_GRID: 1, // min rows/cols
  // Max rows/cols. Bumped from 8 to 12 per #1871 after measuring generation
  // time across grid sizes (see
  // `src/features/generation/worker/generators/__kernel-tests__/compartments.perf.test.ts`):
  // worst case (no label tabs) 12×12 finishes in ~14s, under the 30s base
  // timeout. 16×16 hits ~39s and risks timeout failures, so 12 is the safe
  // ceiling without also raising `BASE_TIMEOUT_MS`.
  MAX_COMPARTMENT_GRID: 12,
  MIN_COMPARTMENT_THICKNESS: 0.4, // mm divider wall thickness
  MAX_COMPARTMENT_THICKNESS: 2.4, // mm divider wall thickness
  COMPARTMENT_THICKNESS_STEP: 0.1, // mm (legacy — use WALL_THICKNESS_OPTIONS)
  MIN_COMPARTMENT_SIZE: 5, // mm (minimum viable compartment dimension)
  // Label tabs
  MIN_LABEL_TAB_DEPTH: 8, // mm
  MAX_LABEL_TAB_DEPTH: 20, // mm
  LABEL_TAB_DEPTH_STEP: 1, // mm
  MIN_LABEL_TAB_WIDTH: 10, // % of compartment column width
  MAX_LABEL_TAB_WIDTH: 100, // %
  LABEL_TAB_WIDTH_STEP: 5, // %
  MAX_HISTORY: 100, // undo/redo states
  // Wall thickness
  MIN_WALL_THICKNESS: 0.4, // mm (1-wall for 0.4mm nozzle)
  MAX_WALL_THICKNESS: 2.4, // mm (3-wall for 0.8mm nozzle)
  WALL_THICKNESS_STEP: 0.1, // mm (legacy — use WALL_THICKNESS_OPTIONS)
  // Magnet holes (diameter in UI and store)
  MIN_MAGNET_DIAMETER: 4.0, // mm
  MAX_MAGNET_DIAMETER: 10.0, // mm
  MAGNET_DIAMETER_STEP: 0.1, // mm
  MIN_MAGNET_HEIGHT: 1.0, // mm
  MAX_MAGNET_HEIGHT: 4.0, // mm
  MAGNET_HEIGHT_STEP: 0.5, // mm
  // Screw holes (diameter in UI and store)
  MIN_SCREW_DIAMETER: 2.0, // mm
  MAX_SCREW_DIAMETER: 6.0, // mm
  SCREW_DIAMETER_STEP: 0.1, // mm
  // Slot configuration (slotted style)
  MIN_SLOT_PITCH: 10, // mm between slot centers
  MAX_SLOT_PITCH: 50, // mm
  SLOT_PITCH_STEP: 1, // mm
  MIN_SLOT_WIDTH: 1.8, // mm slot opening
  MAX_SLOT_WIDTH: 3.0, // mm
  SLOT_WIDTH_STEP: 0.1, // mm
  MIN_SLOT_DEPTH: 0.5, // mm cut depth into wall
  MAX_SLOT_DEPTH: 2.0, // mm
  SLOT_DEPTH_STEP: 0.1, // mm
  // Divider piece configuration
  MIN_DIVIDER_THICKNESS: 0.8, // mm
  MAX_DIVIDER_THICKNESS: 2.4, // mm
  DIVIDER_THICKNESS_STEP: 0.1, // mm
  MIN_DIVIDER_CLEARANCE: 0.0, // mm
  MAX_DIVIDER_CLEARANCE: 0.3, // mm
  DIVIDER_CLEARANCE_STEP: 0.05, // mm
  // Finger scoop
  MIN_SCOOP_RADIUS: 5, // mm
  MAX_SCOOP_RADIUS: 25, // mm
  SCOOP_RADIUS_STEP: 1, // mm
  // Handle holes
  MIN_HANDLE_WIDTH: 10, // % of wall span
  MAX_HANDLE_WIDTH: 100, // %
  HANDLE_WIDTH_STEP: 10, // %
  MIN_HANDLE_HEIGHT: 8, // mm (minimum finger clearance)
  MAX_HANDLE_HEIGHT: 30, // mm
  HANDLE_HEIGHT_STEP: 1, // mm
  MIN_HANDLE_CORNER_RADIUS: 0, // mm (sharp rectangle)
  MAX_HANDLE_CORNER_RADIUS: 10, // mm
  HANDLE_CORNER_RADIUS_STEP: 1, // mm
  // Handle vertical position
  MIN_HANDLE_VERTICAL_POSITION: 0.2, // fraction from floor
  MAX_HANDLE_VERTICAL_POSITION: 0.9, // fraction from floor
  HANDLE_VERTICAL_POSITION_STEP: 0.05,
  // Handle count per wall
  MIN_HANDLE_COUNT: 1,
  MAX_HANDLE_COUNT: 3,
} as const;

/**
 * Valid wall thickness options — multiples of common FDM nozzle sizes (0.4, 0.6, 0.8mm).
 * Used for both exterior wall thickness and interior divider walls.
 */
export const WALL_THICKNESS_OPTIONS = [0.4, 0.6, 0.8, 1.2, 1.6, 1.8, 2.0, 2.4, 2.6] as const;
