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
// The re-export above is not a local binding, so `minHeightUnits` needs its own
// import to read the socket height it has to clear.
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

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
  // A spacer is floorless, so the "usable cavity" rationale behind MIN_HEIGHT
  // doesn't apply — 1u is what lets a stack be shimmed from odd to even total
  // height and back.
  MIN_SPACER_HEIGHT: 1, // height units
  /**
   * Shortest wall (mm) a socketed body may be built with. `wallHeight` is
   * `height * heightUnitMm - SOCKET_HEIGHT`, so a short height unit can drive it
   * to zero or below: at 0 the box extrude is a zero vector and generation
   * throws, and below 0 OCCT happily extrudes DOWNWARD, burying an inverted box
   * and the stacking lip inside the foot. Only a spacer can reach it — every
   * other socketed base is held at `MIN_HEIGHT` (2u), which clears the socket at
   * any permitted height unit.
   */
  MIN_BODY_WALL_MM: 1,
  // Height units. Matches `CONSTRAINTS.GRID_MAX`, which already bounds a layout
  // bin's height on both the client and the wire. While this was lower, a legal
  // layout bin taller than it could not be linked to a design at all, because
  // `validateDesignerShare` rejected the height `emitLinkedBinResize` had just
  // written.
  //
  // Height is close to free to generate: the wall is the same topology extruded
  // further, so a plain 3x3 measures ~260ms and 5,176 triangles at every height
  // from 4u to 50u (`__kernel-tests__/height.perf`). Only a wall pattern pays,
  // and it grows roughly linearly past 20u (17s at 20u, 40s at 30u, 85s at
  // 50u), against the full 180s budget `computeGenerationTimeoutMs` grants from
  // 30u up. That is the same pattern-cut ceiling a wide short bin already hits,
  // not a new failure mode.
  MAX_HEIGHT: 50,
  HEIGHT_STEP: 1, // height units
  MIN_COMPARTMENT_GRID: 1, // min rows/cols
  // Max rows/cols. Bumped from 8 to 12 after measuring generation
  // time across grid sizes (see
  // `src/features/generation/worker/generators/__kernel-tests__/compartments.perf.test.ts`):
  // worst case (no label tabs) 12×12 finishes in ~14s, under the 30s base
  // timeout. 16×16 hits ~39s and risks timeout failures, so 12 is the safe
  // ceiling without also raising `BASE_TIMEOUT_MS`.
  MAX_COMPARTMENT_GRID: 12,
  // Bento stash cap. Server mirror rejects over this (CONSTRAINTS.MAX_STASH_ENTRIES
  // in api/lib/designerValidationConstants.ts); client actions refuse past it so
  // honest payloads are never silently dropped. Each entry can carry a label,
  // so the cap also keeps stash text well under the moderation traversal's
  // MAX_TEXT_FIELDS budget.
  MAX_STASH_ENTRIES: 36,
  MIN_COMPARTMENT_THICKNESS: 0.4, // mm divider wall thickness
  MAX_COMPARTMENT_THICKNESS: 2.4, // mm divider wall thickness
  COMPARTMENT_THICKNESS_STEP: 0.1, // mm (legacy — use WALL_THICKNESS_OPTIONS)
  MIN_COMPARTMENT_SIZE: 5, // mm (minimum viable compartment dimension)
  // Label tabs
  MIN_LABEL_TAB_DEPTH: 8, // mm
  // Raised from 20 → 50 so tuck-under ledges for wire bins have
  // enough material to actually retain springy contents. Runtime clamp in
  // the UI tightens the stepper to `min(50, innerD - 1)` so the tab can't
  // span past the opposite wall on small bins.
  MAX_LABEL_TAB_DEPTH: 50, // mm
  LABEL_TAB_DEPTH_STEP: 1, // mm
  MIN_LABEL_TAB_WIDTH: 10, // % of compartment column width
  MAX_LABEL_TAB_WIDTH: 100, // %
  LABEL_TAB_WIDTH_STEP: 5, // %
  // Inset moves the tab inward from its anchor wall. Hard ceiling here;
  // the UI tightens further per compartment depth and edges mode so two
  // tabs in 'both' mode can't collide.
  MIN_LABEL_TAB_INSET: 0, // mm
  MAX_LABEL_TAB_INSET: 100, // mm
  LABEL_TAB_INSET_STEP: 1, // mm
  // Tab height is the Z position of the shelf TOP above the cavity floor (mm).
  // Default (field absent) = wall top. Lowering creates a tuck-under pocket
  // between the rim and the shelf. The dynamic max is the interior wall
  // height (computed at render time); the dynamic min is `tabDepth + 1` so
  // the gusset retains 1mm of clearance above the floor.
  MIN_LABEL_TAB_HEIGHT: 9, // mm — derived from MIN_LABEL_TAB_DEPTH + 1
  MAX_LABEL_TAB_HEIGHT: 350, // mm — derived from MAX_HEIGHT (50) * heightUnitMm (7)
  LABEL_TAB_HEIGHT_STEP: 1, // mm
  // Label lip: a raised rim on the tab's free edge to retain loose
  // labels. Height reserves that much shelf headroom so the rim tops at the
  // interior ceiling. Bounds mirror LABEL_TAB_LIP_HEIGHT_{MIN,MAX}_MM.
  MIN_LABEL_TAB_LIP_HEIGHT: 0.4, // mm
  MAX_LABEL_TAB_LIP_HEIGHT: 5, // mm
  LABEL_TAB_LIP_HEIGHT_STEP: 0.2, // mm
  MAX_HISTORY: 100, // undo/redo states
  MIN_WALL_THICKNESS: 0.4, // mm (1-wall for 0.4mm nozzle)
  MAX_WALL_THICKNESS: 2.4, // mm (3-wall for 0.8mm nozzle)
  WALL_THICKNESS_STEP: 0.1, // mm (legacy — use WALL_THICKNESS_OPTIONS)
  // Magnet holes (diameter in UI and store)
  MIN_MAGNET_DIAMETER: 4.0, // mm
  MAX_MAGNET_DIAMETER: 10.0, // mm
  MAGNET_DIAMETER_STEP: 0.1, // mm
  MIN_MAGNET_HEIGHT: 1.0, // mm
  MAX_MAGNET_HEIGHT: 4.0, // mm
  MAGNET_HEIGHT_STEP: 0.1, // mm
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
  MIN_SCOOP_RADIUS: 5, // mm — floor for both the height (rise) and run inputs
  MAX_SCOOP_RADIUS: 25, // mm — default auto-height ceiling; also the legacy manual cap
  SCOOP_RADIUS_STEP: 1, // mm
  // Two-variable custom scoop: height (rise) and run (length along the floor)
  // are steppable up to these generous ceilings; the geometry then clamps each
  // to the real interior height / compartment depth, so these only bound the UI.
  MAX_SCOOP_HEIGHT: 350, // mm — MAX_HEIGHT (50) × heightUnitMm (7)
  MAX_SCOOP_RUN: 140, // mm
  // A scoop steeper than this height:run ratio prints with rough overhangs and
  // is awkward to reach into — surface a non-blocking warning past it.
  SCOOP_STEEP_WARN_RATIO: 2,
  // Per-side body overhang (fills the drawer-fit gap; outward-only)
  MIN_OVERHANG: 0, // mm
  MAX_OVERHANG: 21, // mm (half a 42mm grid unit — beyond this, add a grid cell)
  OVERHANG_STEP: 0.5, // mm
  // Outer-wall flare (drawer-fit "curved" bins,). Per-side value is the
  // width added at the rim above the base overhang — chamfer inset or fillet
  // radius. Independent of that side's overhang.
  MIN_TAPER: 0, // mm
  // Flare sits above the drawer's curve, where no extra grid cell could ever
  // fit, so MAX_OVERHANG's "add a cell instead" ceiling doesn't apply to it.
  MAX_TAPER: 42, // mm (one full grid unit)
  TAPER_STEP: 0.5, // mm
  MIN_TAPER_BAND: 0, // mm — band height (how far up the wall the taper rises)
  MAX_TAPER_BAND: 350, // mm — capped at MAX_SCOOP_HEIGHT; clamped to wall height at build
  TAPER_BAND_STEP: 0.5, // mm
  // Extra exterior wall height — raises the perimeter walls + stacking lip
  // above the nominal bin height (collar). Bounds mirror the lid's
  // extraHeightMm so a bin-side collar and a taller lid stay symmetric.
  MIN_EXTRA_WALL_HEIGHT: 0, // mm
  MAX_EXTRA_WALL_HEIGHT: 100, // mm — capped so the upright print stays within a typical printer's Z
  EXTRA_WALL_HEIGHT_STEP: 1, // mm
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
  MIN_HANDLE_VERTICAL_POSITION: 0.2, // fraction from floor
  MAX_HANDLE_VERTICAL_POSITION: 0.9, // fraction from floor
  HANDLE_VERTICAL_POSITION_STEP: 0.05,
  // Handle count per wall
  MIN_HANDLE_COUNT: 1,
  MAX_HANDLE_COUNT: 3,
} as const;

/**
 * Lowest height (in height units) a bin may be built at.
 *
 * The single source of truth for that floor: the stepper bound, the client
 * validator and the base toggles' clamp all read it, so none can let through a
 * height another rejects. Mirrored server-side in
 * `api/lib/designerValidation.ts` (which cannot import from `src/`).
 *
 * The relaxed 1u floor tracks the EFFECTIVE spacer, matching `deriveDimensions`
 * (`isSpacer = base.spacer && !isFlat`) — a spacer needs a socket to shell
 * through, so the flag is inert on a flat base. Keying off `base.spacer` alone
 * would let `{ style: 'flat', spacer: true, height: 1 }` through as a 1u bin
 * with an ordinary floor.
 *
 * A base-only bin takes the same relaxed floor for the same reason: its wall
 * height is pinned to 0 and its real height comes from `assembledHeight`, so
 * `height` is inert data that only has to clear the validators. It is stored as
 * 1 rather than its true 0.71u so no fractional-height carve-out is needed here
 * or in the server mirror.
 */
export function minHeightUnits(
  base: {
    readonly spacer: boolean;
    readonly tile?: boolean;
    readonly style: string;
  },
  /**
   * Height unit in mm. Only a spacer reads it, and only to keep its body above
   * the socket it stands on; omit it to accept the 7mm default, at which the
   * spacer floor is 1u either way.
   */
  heightUnitMm: number = GRIDFINITY_SPEC.HEIGHT_UNIT
): number {
  // Matches `deriveDimensions`: the flag is inert on any socketless base, so
  // a `{ style: 'lid', spacer: true, height: 1 }` payload must not buy the
  // relaxed floor either.
  const socketless = base.style === 'flat' || base.style === 'lid';
  if (socketless) return DESIGNER_CONSTRAINTS.MIN_HEIGHT;
  // A tray's wall is pinned to 0 and its height is inert data stored as 1, so it
  // takes the flat relaxed floor and must NOT take the spacer's socket-clearing
  // one: raising it would reject every tray at a height unit of 5mm or less,
  // since the store pins the field rather than floors it.
  if (base.tile === true) return DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT;
  if (!base.spacer) return DESIGNER_CONSTRAINTS.MIN_HEIGHT;
  // A spacer keeps its walls, so its body has to reach above the 5mm socket it
  // subtracts. 1u only clears that at the 7mm default; at a 3mm unit a 1u spacer
  // asks for a -2mm wall. Ceil so the floor lands on a whole height unit.
  const unit =
    Number.isFinite(heightUnitMm) && heightUnitMm > 0 ? heightUnitMm : GRIDFINITY_SPEC.HEIGHT_UNIT;
  const clearsSocket = Math.ceil(
    (GRIDFINITY_SPEC.SOCKET_HEIGHT + DESIGNER_CONSTRAINTS.MIN_BODY_WALL_MM) / unit
  );
  return Math.max(DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT, clearsSocket);
}

/**
 * Valid wall thickness options — multiples of common FDM nozzle sizes (0.4, 0.6, 0.8mm).
 * Used for both exterior wall thickness and interior divider walls.
 */
export const WALL_THICKNESS_OPTIONS = [0.4, 0.6, 0.8, 1.2, 1.6, 1.8, 2.0, 2.4, 2.6] as const;
