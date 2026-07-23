/**
 * Click-lock lid type definitions.
 *
 * The lid is a parametric companion piece of a bin design that mates with
 * the bin's stacking lip via angled rails on its underside. Its outer
 * footprint is auto-derived from the bin's dimensions (or cellMask polygon)
 * and its mating profile uses the bin's existing LIP_* constants so fit
 * tracks the lip spec automatically.
 *
 * Wall thickness and fit clearance are intentionally NOT user-configurable:
 * the click-lock geometry is a single validated set of numbers, and exposing
 * those knobs invited mis-prints. See `lidConstants.ts` for the live values.
 * The floor plate is the one exception ({@link LidConfig.topThicknessMm}) —
 * it mates with nothing, so thickening it can only add stiffness.
 */

import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

/**
 * The slice of a design the lid resolvers below read. Declared structurally
 * rather than importing `BinParams` from the folder barrel: the barrel
 * re-exports this module, so that import would form a `lid -> index -> lid`
 * cycle. `BinParams` satisfies this shape, so callers pass params straight in.
 */
export interface LidGeometrySource {
  readonly lid: LidConfig;
  readonly base: { readonly stackingLip: boolean; readonly magnetDepth: number };
  readonly cellMask?: CellMask;
}

/**
 * Per-side clearance in mm between the lid's mating profile and the bin's
 * stacking lip surface. Single FDM-validated value — no UI knob.
 */
export const LID_FIT_CLEARANCE = 0.25;

/**
 * Additional per-side footprint clearance (mm) given to a magnetic lid
 * (issue #2761). Magnets supply all the retention, so the mating shell only
 * needs to locate the lid — any residual friction fights the magnets and makes
 * the lid feel like it has to be pressed and prised rather than snapped.
 *
 * Applies to the XY footprint ONLY. It deliberately does NOT feed
 * {@link lidAnchorZ}: that would raise the seated plane by
 * `2·√2·0.15 ≈ 0.42mm` and eat the `LID_MAGNET_SEAT_GAP` (0.2mm) the corner
 * posts rely on. Use {@link resolveLidFootprintClearance} for footprint work
 * and the bare {@link LID_FIT_CLEARANCE} for anchor/Z work.
 */
export const LID_MAGNETIC_EXTRA_CLEARANCE = 0.15;

/**
 * Per-side clearance applied to the lid's OUTER FOOTPRINT — the base value
 * plus the magnetic relief when the design actually gets retention magnets.
 *
 * The predicate mirrors the GEOMETRIC half of `usesMagneticLid` — a magnetic
 * lid on a lip-less or polygon bin falls back to a plain friction fit (no
 * corner bosses are generated), so it must keep the base clearance or it would
 * rattle. It deliberately omits that helper's `lid.enabled` term: a disabled
 * lid is never generated, so its clearance is never consumed.
 */
export function resolveLidFootprintClearance(params: LidGeometrySource): number {
  const magnetic =
    params.lid.attachment === 'magnetic' &&
    params.base.stackingLip &&
    !isPartialMask(params.cellMask);
  return magnetic ? LID_FIT_CLEARANCE + LID_MAGNETIC_EXTRA_CLEARANCE : LID_FIT_CLEARANCE;
}

/** Lid outer corner radius (mm) BEFORE clearance subtraction. Lid-specific —
 *  do NOT use the bin's `BOX_CORNER_RADIUS` (3.75mm), which would shrink
 *  the wall and shift rails. */
export const LID_CORNER_RADIUS = 4;

/** Floor plate thickness (mm) when no magnet pockets are needed. Also the
 *  minimum and default for {@link LidConfig.topThicknessMm}. */
export const LID_TOP_THICKNESS_BASE = 0.8;

/**
 * Bounds for {@link LidConfig.topThicknessMm}. The floor at 0.8mm is four
 * layers at 0.2mm — enough to bridge, but thin enough to read as flimsy and
 * translucent on a large lid (issue #2761). The ceiling keeps a 6×4 lid from
 * turning into an hour of solid infill; the step lands on common layer
 * heights so the plate comes out at a whole number of layers.
 */
export const LID_TOP_THICKNESS_MIN_MM = LID_TOP_THICKNESS_BASE;
export const LID_TOP_THICKNESS_MAX_MM = 5;
export const LID_TOP_THICKNESS_STEP_MM = 0.2;

/** Minimum solid material above a magnet pocket (mm) so it can't punch
 *  through to the cavity face. */
export const LID_MAGNET_CEILING = 0.6;

/** Minimum solid floor kept below a tray recess (mm) so the recess can't
 *  break through into the mating cavity. */
export const LID_TRAY_FLOOR = 0.8;

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

/**
 * Effective floor-plate thickness (mm) — the largest of the four competing
 * demands. A FLOOR, never a cap, so no combination of settings can punch a
 * magnet pocket into the cavity or break through a tray recess.
 *
 * The single source of truth: the worker, the preview, the thumbnail, and the
 * export assembly all size and position the lid from this.
 */
export function resolveLidPlateThickness(params: LidGeometrySource): number {
  const { lid, base } = params;
  const magnetNeed =
    lid.magnetHoles && lid.stackableTop ? base.magnetDepth + LID_MAGNET_CEILING : 0;
  const trayNeed = lid.tray.enabled && !lid.stackableTop ? lid.tray.depthMm + LID_TRAY_FLOOR : 0;
  return Math.max(LID_TOP_THICKNESS_BASE, lid.topThicknessMm, magnetNeed, trayNeed);
}

/**
 * Total cavity depth (mm) added below the standard one-grid-unit lid — the
 * `extraHeightMm` knob PLUS however much the floor plate grew past its 0.8mm
 * baseline. Feeds `lidAnchorZ`/`lidWallBottomZ` everywhere.
 *
 * Why the plate growth belongs here: the floor is built downward from the top
 * face (`Z ∈ [-plateThickness, 0]`), so every millimetre of extra plate eats a
 * millimetre of the cavity the bin's stacking lip has to enter. Past
 * `|anchorZ|` (~2.09mm) the plate fills the lip's space outright and the lid
 * can no longer seat — a 5mm plate leaves a solid block with a 0.79mm skirt.
 * Deepening the anchor in lockstep keeps the plate-to-anchor gap constant, so
 * the lid just gets taller (exactly what `extraHeightMm` already does).
 */
export function resolveLidCavityExtraMm(params: LidGeometrySource): number {
  return params.lid.extraHeightMm + (resolveLidPlateThickness(params) - LID_TOP_THICKNESS_BASE);
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
   * Floor plate thickness (mm) — the solid slab between the lid's top face
   * and its mating cavity (issue #2761). A FLOOR, not a cap: magnet pockets
   * and a tray recess still raise the plate above this when they need more
   * material (see {@link resolveLidPlateThickness}). Nothing mates with this
   * surface, so
   * raising it only trades filament for stiffness and opacity.
   */
  readonly topThicknessMm: number;
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
  // Baseline, so every pre-#2761 design regenerates byte-identically.
  topThicknessMm: LID_TOP_THICKNESS_BASE,
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

/**
 * Extra clearance baked into the anchor calculation to compensate for
 * first-layer squish (mm).
 */
export const LID_EXTRA_HEIGHT = 0.2;

/**
 * Anchor Z in lid-local coords — where the lid's mating cavity opens up to
 * receive the bin's stacking lip when the lid is snapped on.
 *
 * Lives here rather than in the worker's `lidConstants` so the main thread can
 * use it too: the worker module pulls in brepjs/WASM and isn't importable from
 * the UI. Both the worker and the preview mirror re-export this, so there is
 * one formula rather than the two hand-synced copies this replaces.
 *
 * @param heightUnitMm Gridfinity height unit (default 7mm — base lid height)
 * @param fitClearance Per-side clearance for the chosen fit
 * @param extraCavityMm Added cavity depth — `resolveLidCavityExtraMm`, which
 *   folds in both the `extraHeightMm` knob and floor-plate growth (#2761)
 */
export function lidAnchorZ(
  heightUnitMm: number,
  fitClearance: number,
  extraCavityMm: number = 0
): number {
  return (
    -(heightUnitMm + extraCavityMm) -
    LID_EXTRA_HEIGHT +
    GRIDFINITY_SPEC.LIP_HEIGHT +
    Math.SQRT2 * fitClearance * 2
  );
}

/** Bottom of the mating wall in lid-local Z — below this the click rails take over. */
export function lidWallBottomZ(
  heightUnitMm: number,
  fitClearance: number,
  extraCavityMm: number = 0
): number {
  return (
    lidAnchorZ(heightUnitMm, fitClearance, extraCavityMm) -
    GRIDFINITY_SPEC.LIP_BIG_TAPER -
    GRIDFINITY_SPEC.LIP_VERTICAL_PART
  );
}

/**
 * How far the lid's magnet boss hangs below the cavity ceiling, versus how deep
 * the cavity is. Magnetic retention only works when the boss reaches down far
 * enough to meet a pad the BIN can actually host — i.e. inside the bin, not
 * above its rim.
 *
 * A deep cavity (the `extraHeightMm` knob, or a very thick floor plate) lifts
 * the lid and its bosses with it; past this point the mating plane rises above
 * the bin entirely and the bin would grow gusset pads floating over its own lip.
 * `checkLidCompatibility` turns that into a blocker rather than building it.
 */
export function magneticLidReachesBin(params: LidGeometrySource, heightUnitMm: number): boolean {
  const cavityDepth = -lidAnchorZ(heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(params));
  const bossReach =
    resolveLidPlateThickness(params) + params.lid.retentionMagnet.depth + LID_MAGNET_SEAT_GAP;
  return cavityDepth <= bossReach;
}

/**
 * Vertical gap (mm) between the lid boss's magnet face and the bin pad's, when
 * seated. Keeps the corner posts from bottoming out and lifting the lid off its
 * lip; the magnets pull across it. Mirrored by the worker's `lidConstants`.
 */
export const LID_MAGNET_SEAT_GAP = 0.2;
