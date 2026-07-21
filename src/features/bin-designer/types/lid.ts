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
 * Bounds for {@link LidConfig.extraHeightMm} — the user-set extra internal
 * cavity depth added ABOVE the default one-grid-unit lid, so tall contents
 * poking out of a short bin are enclosed when the lid is on (issue #2482).
 * `0` = the standard lid (identical geometry to before this field existed).
 * Capped so the separately-printed lid stays within a typical printer's Z.
 *
 * NB: unrelated to the worker-side `LID_EXTRA_HEIGHT` (0.2mm squish fudge in
 * `lidConstants.ts`); this is a millimetre knob, hence the `_MM` suffix.
 */
export const LID_EXTRA_HEIGHT_MIN_MM = 0;
export const LID_EXTRA_HEIGHT_MAX_MM = 100;
export const LID_EXTRA_HEIGHT_STEP_MM = 1;

/**
 * Available click-rail coverage options as a percentage of edge length.
 * Lower values save filament; higher values give more grip surface.
 * 100% = full edge-to-edge rails.
 */
export const LID_CLICK_RAIL_COVERAGE_OPTIONS: readonly number[] = [50, 75, 100] as const;

/**
 * How the lid retains onto the bin. Mutually exclusive — a lid holds by
 * exactly one mechanism:
 * - `friction`: the mating shell wraps the lip; no positive retention.
 * - `clickRails`: tapered snap rails on each enabled wall (the historical
 *   behavior; sub-controlled by {@link LidConfig.clickRails}/`clickRailCoverage`).
 * - `magnetic`: press-fit magnets in corner bosses on both the lid and the
 *   bin's stacking lip bond the lid down (issue #2694). Independent of the
 *   lip's grip, so it survives wall cutouts a rail lid couldn't.
 */
export type LidAttachment = 'friction' | 'clickRails' | 'magnetic';
export const LID_ATTACHMENTS: readonly LidAttachment[] = [
  'friction',
  'clickRails',
  'magnetic',
] as const;

/**
 * Bounds for the dedicated lid-retention magnet (issue #2694). Separate from
 * the bin's `base` magnet so a design can hold its lid with a different magnet
 * than it uses in its feet. Defaults to the common 6mm × 2mm disc.
 */
export const LID_MAGNET_DIAMETER_MIN_MM = 3;
export const LID_MAGNET_DIAMETER_MAX_MM = 15;
export const LID_MAGNET_DIAMETER_DEFAULT_MM = 6;
export const LID_MAGNET_DEPTH_MIN_MM = 1;
export const LID_MAGNET_DEPTH_MAX_MM = 6;
export const LID_MAGNET_DEPTH_DEFAULT_MM = 2;
export const LID_MAGNET_DIMENSION_STEP_MM = 0.5;

/**
 * Bounds for the {@link LidTrayConfig} recess — a shallow tray shelled into the
 * lid's top face (offered only when the lid has no stackable baseplate). Depth
 * is how far the recess sinks below the top surface; wall is the rim thickness
 * kept between the recess and the lid's outer perimeter.
 */
export const LID_TRAY_DEPTH_MIN_MM = 1;
export const LID_TRAY_DEPTH_MAX_MM = 30;
export const LID_TRAY_DEPTH_DEFAULT_MM = 4;
export const LID_TRAY_WALL_MIN_MM = 1;
export const LID_TRAY_WALL_MAX_MM = 10;
export const LID_TRAY_WALL_DEFAULT_MM = 2;
export const LID_TRAY_DIMENSION_STEP_MM = 0.5;

/** Dedicated lid-retention magnet dimensions (mm). See {@link LidAttachment}. */
export interface LidMagnetConfig {
  readonly diameter: number;
  readonly depth: number;
}

/**
 * Shelled "tray" recess on the lid's top face (issue #2694). Only meaningful
 * when the lid is NOT stackable — a stack grid and a recess can't share the
 * top surface, so `resolveLidInputs` forces `enabled` off when `stackableTop`
 * is on.
 */
export interface LidTrayConfig {
  readonly enabled: boolean;
  readonly depthMm: number;
  readonly wallMm: number;
}

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
  /**
   * Retention mechanism (issue #2694). Exactly one of friction/clickRails/
   * magnetic. `clickRails` reads the per-side {@link clickRails} object and
   * `clickRailCoverage`; `magnetic` reads {@link retentionMagnet}; `friction`
   * uses neither. The worker forces the click rails off unless this is
   * `'clickRails'`, so switching modes preserves the per-side selection
   * without generating it.
   *
   * Migration: legacy designs (pre-attachment) derive this from their rails —
   * any side `true` → `'clickRails'`, otherwise `'friction'`.
   */
  readonly attachment: LidAttachment;
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
  /**
   * Extra internal cavity depth (mm) added ABOVE the default one-grid-unit
   * lid, so contents that stick up out of a short bin are enclosed when the
   * lid is on (issue #2482 — e.g. a toothpick holder). `0` reproduces the
   * standard lid exactly. Clamped to
   * [{@link LID_EXTRA_HEIGHT_MIN_MM}, {@link LID_EXTRA_HEIGHT_MAX_MM}].
   * The lip-mating shell and click rails stay at the bottom of the cavity;
   * this only lengthens the plain wall above the lip.
   */
  readonly extraHeightMm: number;
  /**
   * Dedicated retention-magnet dimensions used only when
   * {@link attachment} === `'magnetic'`. Independent of the bin's `base`
   * magnet so the lid and feet can take different discs.
   */
  readonly retentionMagnet: LidMagnetConfig;
  /**
   * Optional shelled tray recess on the top face. Only takes effect when the
   * lid is not stackable (a stack grid owns the top surface otherwise).
   */
  readonly tray: LidTrayConfig;
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
  // `clickRails` preserves the historical default behavior (all four rails on)
  // so enabling a lid without touching the mode still clicks shut.
  attachment: 'clickRails',
  stackableTop: false,
  magnetHoles: false,
  separateStackPlate: false,
  clickRails: { front: true, back: true, left: true, right: true },
  clickRailCoverage: 50,
  extraHeightMm: 0,
  retentionMagnet: {
    diameter: LID_MAGNET_DIAMETER_DEFAULT_MM,
    depth: LID_MAGNET_DEPTH_DEFAULT_MM,
  },
  tray: {
    enabled: false,
    depthMm: LID_TRAY_DEPTH_DEFAULT_MM,
    wallMm: LID_TRAY_WALL_DEFAULT_MM,
  },
} as const;
