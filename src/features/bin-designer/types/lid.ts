/**
 * Click-lock lid type definitions.
 *
 * The lid is a parametric companion piece of a bin design that mates with
 * the bin's stacking lip via angled rails on its underside. Its outer
 * footprint is auto-derived from the bin's dimensions (or cellMask polygon)
 * and its mating profile uses the bin's existing LIP_* constants so fit
 * tracks the lip spec automatically.
 *
 * Wall thickness, top thickness, and fit clearance are intentionally
 * NOT user-configurable: the click-lock geometry is a single validated
 * set of numbers, and exposing those knobs invited mis-prints. See
 * `lidConstants.ts` for the live values.
 */

/**
 * Per-side clearance in mm between the lid's mating profile and the bin's
 * stacking lip surface. Single FDM-validated value — no UI knob.
 */
export const LID_FIT_CLEARANCE = 0.25;

/** Lid outer corner radius (mm) BEFORE clearance subtraction. Lid-specific —
 *  do NOT use the bin's `BOX_CORNER_RADIUS` (3.75mm), which would shrink
 *  the wall and shift rails. */
export const LID_CORNER_RADIUS = 4;

/** Floor plate thickness (mm) when no magnet pockets are needed. */
export const LID_TOP_THICKNESS_BASE = 0.8;

/** Minimum solid material above a magnet pocket (mm) so it can't punch
 *  through to the cavity face. */
export const LID_MAGNET_CEILING = 0.6;

/** Minimum rail length (mm) below which the worker drops the rail. */
export const LID_MIN_RAIL_LENGTH = 4;

/**
 * Available click-rail coverage options as a percentage of edge length.
 * Lower values save filament; higher values give more grip surface.
 * 100% = full edge-to-edge rails.
 */
export const LID_CLICK_RAIL_COVERAGE_OPTIONS: readonly number[] = [50, 75, 100] as const;

/** Wall sides that can carry a click rail. Same axis convention as the bin. */
export type LidRailSide = 'front' | 'back' | 'left' | 'right';
export const LID_RAIL_SIDES: readonly LidRailSide[] = ['front', 'back', 'left', 'right'] as const;

/**
 * Per-side click-rail toggle. Each wall is independent — users can ship
 * a one-sided "hinge" lid (only front/back), a label-friendly symmetric
 * pair (left/right only), or any other combination. All four false ⇒
 * friction-fit lid (no snap engagement at all).
 */
export interface LidClickRails {
  readonly front: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/** Click-lock lid configuration. Stored as a sub-object on `BinParams`. */
export interface LidConfig {
  /** Master toggle. When false, no lid is generated regardless of other fields. */
  readonly enabled: boolean;
  /** Include Gridfinity stack-grid pattern on top of lid (other bins stack on it). */
  readonly stackableTop: boolean;
  /** Include magnet holes in the lid (uses bin's BaseConfig magnetDiameter).
   *  Requires `stackableTop`: pockets only do something when a bin can
   *  stack on the lid above them. */
  readonly magnetHoles: boolean;
  /**
   * Print the stack-grid baseplate as a SEPARATE companion piece instead of
   * fusing it onto the lid's top. Requires `stackableTop` — the baseplate IS
   * the stack grid, so it only exists when a stackable top is enabled.
   *
   * Why split: on export the lid rotates 180° (floor down) so its mating
   * cavity/rails print support-free — but that same rotation flips a fused
   * stack grid pockets-down onto the bed, a mess of overhangs. Split, the
   * baseplate prints flat (pockets up, glue-face down) and the user glues it
   * onto the lid's flat top. The glue face is the slab's flat Z=0 bottom and
   * its outline matches the lid footprint, so edges seat flush.
   */
  readonly separateStackPlate: boolean;
  /**
   * Per-side click-rail engagement. Each wall is independent. When all
   * four are `false`, the lid is friction-fit only (mating cavity wraps
   * the lip, no positive snap). When some are `false` the lid clicks
   * asymmetrically — useful for hinged-feel removal or for designs
   * where one wall has cutouts/labels that conflict with a rail.
   * `clickRailCoverage` applies to whichever sides are enabled.
   *
   * Migration: legacy `boolean` values get expanded by `migrateParams`:
   * `true` → all four sides true, `false` → all four false.
   */
  readonly clickRails: LidClickRails;
  /**
   * Click-rail coverage as a percentage of each wall's edge length (50–100).
   * Rails are always centered on their wall; lower values shorten them
   * symmetrically to save filament. Use a value from
   * `LID_CLICK_RAIL_COVERAGE_OPTIONS`. Only affects sides where
   * `clickRails[side]` is `true`.
   */
  readonly clickRailCoverage: number;
}

/**
 * Default lid config: disabled. Sensible first-enable values:
 * - `clickRailCoverage: 50` — half-length rails save filament without
 *   sacrificing the click-lock function (rails are centered on each wall).
 * - `stackableTop: false` — keeps the lid's print-ready orientation
 *   (`exportLid` rotates 180° around X so the floor sits on the bed) free
 *   of features that fight that rotation; users opt in if they need
 *   stackability.
 */
export const DEFAULT_LID_CONFIG: LidConfig = {
  enabled: false,
  stackableTop: false,
  magnetHoles: false,
  separateStackPlate: false,
  clickRails: { front: true, back: true, left: true, right: true },
  clickRailCoverage: 50,
} as const;
