import {
  LID_MAGNET_DEPTH_DEFAULT_MM,
  LID_MAGNET_DIAMETER_DEFAULT_MM,
  LID_MAGNET_EDGE_COUNT_DEFAULT,
} from './lid';
import type { LidAttachment, LidClickRails, LidMagnetConfig } from './lid';
import { GRIDFINITY } from '../constants/gridfinity';

/**
 * Thickness of the slab that IS a base-only bin's body, in mm — the ONLY
 * source for it, so `deriveDimensions` and every readout built on top of it
 * (drawer clearance, print estimate) cannot describe a different plate than the
 * one the worker builds.
 *
 * A zero or non-finite thickness would extrude a degenerate slab, and unlike an
 * ordinary bin, a base-only one has no wall to stand in for it, so both fall back
 * to the spec thickness rather than to nothing.
 */
export function resolveTileFloorThickness(wallThickness: number): number {
  return Number.isFinite(wallThickness) && wallThickness > 0
    ? wallThickness
    : GRIDFINITY.WALL_THICKNESS;
}

/** Base attachment style for bin-to-baseplate connection */
export type BaseStyle =
  'standard' | 'magnet' | 'screw' | 'magnet_and_screw' | 'weighted' | 'flat' | 'lid';

/** True when `style` includes magnet pockets — single source of truth so
 *  callers don't drift if a new magnet-inclusive style is added. */
export function isMagnetStyle(style: BaseStyle): boolean {
  return style === 'magnet' || style === 'magnet_and_screw';
}

/** True when `style` includes screw mounts — paired with `isMagnetStyle`. */
export function isScrewStyle(style: BaseStyle): boolean {
  return style === 'screw' || style === 'magnet_and_screw';
}

/**
 * True when the base has no Gridfinity socket under it — a flat base or a tray
 * bottom. The distinction matters wherever code asks "is there a socket to
 * shell, drill, halve, or stand this bin on".
 */
export function isSocketlessBase(style: BaseStyle): boolean {
  return style === 'flat' || style === 'lid';
}

/**
 * True when the base-only flag actually takes effect. It is feet + floor + lip
 * with the wall collapsed to zero, so a socketless base has nothing to build it
 * on and the flag is inert there — exactly as `spacer` is.
 *
 * Shared by the height floor, the constraint engine and `deriveDimensions` so a
 * crafted payload like `{ style: 'flat', tile: true, height: 1 }` cannot buy the
 * relaxed 1u floor through one path that another path would reject.
 */
export function isEffectiveTile(base: {
  readonly tile?: boolean;
  readonly style: BaseStyle;
}): boolean {
  return base.tile === true && !isSocketlessBase(base.style);
}

/**
 * True when the underside relief is the mode this base would shell in — whether
 * or not {@link BaseConfig.lightweight} is currently on.
 *
 * A spacer is excluded: its floor is punched through every cell by definition,
 * so honouring the mode there would close the hole that makes it a spacer. A
 * socketless base is excluded for the same reason `lightweight` itself is inert
 * there — no socket to shell. Both guards live here rather than at each call
 * site so a crafted payload like `{ spacer: true, lightweightMode: 'underside' }`
 * cannot buy a floor through one path that another path would refuse.
 *
 * Deliberately independent of `lightweight`, because the constraint rules ask
 * this question while the feature is still OFF: a bin with a finger scoop can
 * only reach the relief if selecting the mode is what makes the toggle
 * available, and {@link isUndersideRelief} would be false at that moment.
 */
export function undersideReliefSelected(base: {
  readonly lightweightMode?: LightweightMode;
  readonly spacer: boolean;
  readonly style: BaseStyle;
}): boolean {
  return base.lightweightMode === 'underside' && !base.spacer && !isSocketlessBase(base.style);
}

/**
 * True when the base is actually shelled from UNDERNEATH, leaving the interior
 * floor intact — {@link undersideReliefSelected} plus the feature being on.
 *
 * This is the one the geometry and the material estimate read; the rules read
 * the other.
 */
export function isUndersideRelief(base: {
  readonly lightweight: boolean;
  readonly lightweightMode?: LightweightMode;
  readonly spacer: boolean;
  readonly style: BaseStyle;
}): boolean {
  return base.lightweight && undersideReliefSelected(base);
}

/**
 * Mating geometry for a {@link BaseStyle} of `'lid'`: a fully editable
 * bin whose underside is a lid instead of a Gridfinity base, so it caps the bin
 * below it.
 *
 * A narrow subset of `LidConfig`, with matching field names and units. The
 * omitted fields all describe a lid's TOP (`topThicknessMm`, `stackableTop`,
 * `separateStackPlate`, `tray`); a tray bin's top is its own compartment
 * interior, so carrying them here would leave inert knobs for the UI and
 * validation to drift apart over.
 */
export interface TrayBottomConfig {
  readonly attachment: LidAttachment;
  /** Extra skirt depth (mm) to clear contents protruding from the bin below. */
  readonly extraHeightMm: number;
  readonly clickRails: LidClickRails;
  readonly clickRailCoverage: number;
  /** Only meaningful when {@link attachment} is `'magnetic'`. */
  readonly retentionMagnet: LidMagnetConfig;
}

/**
 * Mirrors `DEFAULT_LID_CONFIG` field for field, so a tray bottom and a lid of
 * the same attachment print the same joint.
 */
export const DEFAULT_TRAY_BOTTOM: TrayBottomConfig = {
  attachment: 'clickRails',
  extraHeightMm: 0,
  clickRails: { front: true, back: true, left: true, right: true },
  clickRailCoverage: 50,
  retentionMagnet: {
    diameter: LID_MAGNET_DIAMETER_DEFAULT_MM,
    depth: LID_MAGNET_DEPTH_DEFAULT_MM,
    edgeMagnets: LID_MAGNET_EDGE_COUNT_DEFAULT,
  },
} as const;

/**
 * Where one axis's feet fall relative to the baseplate's cell boundaries.
 *
 * A foot has to land inside a single pocket: adjacent pockets are separated by
 * a ridge, so a full 1u foot centred on a cell boundary bottoms out 0.25mm into
 * a 5mm pocket and leaves the bin resting 4.75mm proud. Which layout seats
 * therefore depends on WHERE THE BIN SITS, per axis:
 *
 *  - `grid` — full cells (plus the fractional edge cell). Seats when the bin's
 * edge lands on a cell boundary. The default, and every older design.
 *  - `half` — a 0.5u foot at each rim with full cells between (`0.5 + (N-1) + 0.5`
 *    is exactly `N`). Seats when the bin sits half a unit off-grid on this axis,
 *    which is what half-bin mode places. Costs far fewer feet than halving every
 *    cell: 16 against 36 on a 3x3, 36 against 100 on a 5x5.
 *
 * `halfSockets` is the placement-agnostic alternative — uniform 0.5u feet seat
 * at either offset, at the price of every foot being subdivided — so it
 * overrides both axes.
 */
export const FOOT_LATTICES = ['grid', 'half'] as const;

/** Where one axis's feet fall. See {@link FOOT_LATTICES}. */
export type FootLattice = (typeof FOOT_LATTICES)[number];

/** Applied when a BaseConfig's `footLatticeX`/`footLatticeY` is missing. */
export const DEFAULT_FOOT_LATTICE: FootLattice = 'grid';

/**
 * Which side of the base a {@link BaseConfig.lightweight} floor is opened from.
 *
 *  - `interior` — the cavity floor follows the inside of the socket taper, so
 *    the grid shape is exposed on the interior ("Gridfinity Lite"). Saves the
 *    most filament and is what the flag has always meant.
 *  - `underside` — the same shells, opened DOWNWARD instead: each foot becomes a
 *    ring and the bin's own floor caps it, so the interior stays flat. Small or
 *    flat contents can't fall into the recesses, and the features that need a
 *    floor to stand on (finger scoop, drainage holes) keep working.
 *
 * The two are otherwise the same construction — see `lightweightBaseBuilder`.
 */
export const LIGHTWEIGHT_MODES = ['interior', 'underside'] as const;

/** Where a lightweight floor opens from. See {@link LIGHTWEIGHT_MODES}. */
export type LightweightMode = (typeof LIGHTWEIGHT_MODES)[number];

/** Applied when a BaseConfig's `lightweightMode` is missing. */
export const DEFAULT_LIGHTWEIGHT_MODE: LightweightMode = 'interior';

/**
 * How far the underside relief holds back from each foot's outer face, in mm.
 *
 * The cut is a scaled copy of the socket profile rather than a straight prism,
 * so this offset is a uniform wall at every depth and CANNOT breach the
 * baseplate-mating taper however large it grows. A prism would have to clear
 * `SOCKET_TAPER_WIDTH` (3.2mm) before it left any wall at all — the foot's
 * bottom face is that much narrower than its cell — which is why the relief is
 * built the way it is.
 *
 * Deliberately not `wallThickness`: this ring stands on the bed as an open foot
 * and carries the bridged floor above it, so it wants more material than a wall
 * that is supported on both sides, and it must not thin out when someone prints
 * 0.4mm walls.
 */
export const UNDERSIDE_RELIEF_BORDER_MM = 3;

/**
 * How a bin's Gridfinity feet are joined to it.
 *
 *  - `integral` — the feet are part of the bin solid and print with it. Every
 *    design that predates the setting.
 *  - `detachable` — the bin prints flat-bottomed with pin holes in the
 *    underside of its floor, and the feet print as separate parts pressed on
 *    afterwards.
 *
 * The saving is the whole point: a foot is ~7285mm³ of the ~9488mm³ each cell
 * contributes, and detaching them removes all of it rather than the 88% an
 * interior lite floor reaches. What makes that possible is print ORIENTATION,
 * not the geometry — the bin's floor becomes its first layer, so nothing has to
 * bridge the 5mm of air an omitted foot would otherwise leave under it. Feet
 * omitted IN PLACE are unprintable at any size the saving is worth having.
 */
export const FEET_MODES = ['integral', 'detachable'] as const;

/** How the feet are joined. See {@link FEET_MODES}. */
export type FeetMode = (typeof FEET_MODES)[number];

/** Applied when a BaseConfig's `feet` is missing. */
export const DEFAULT_FEET_MODE: FeetMode = 'integral';

/**
 * True when the bin is actually built with detachable feet.
 *
 * A spacer is excluded, and not only because the constraint engine forbids the
 * pairing: a spacer's floor is punched through every cell, and the inter-cell
 * webbing between its shelled feet is the ONLY thing tying it together. Remove
 * the feet as well and a multi-cell spacer is several disconnected islands
 * rather than a solid. A socketless base is excluded for the reason it always
 * is — there are no feet there to detach. Both guards live here rather than at
 * each call site so a crafted payload like `{ spacer: true, feet: 'detachable' }`
 * cannot buy through one path what another path would refuse.
 */
export function hasDetachableFeet(base: {
  readonly feet?: FeetMode;
  /** Optional only so narrow callers (a Z-frame source) need not carry it; a
   *  real `BaseConfig` always has it, which is where the guard matters. */
  readonly spacer?: boolean;
  readonly style: BaseStyle;
}): boolean {
  return base.feet === 'detachable' && base.spacer !== true && !isSocketlessBase(base.style);
}

/**
 * True when the wall is thick enough for the feet to seat. Not about pin depth —
 * {@link detachableFeetFloorMm} fixes that. Below 1mm the body's floor grows
 * DOWNWARD past Z=0, the plane the feet's top face assumes, so they stand proud.
 *
 * ADVISORY ONLY: it greys the toggle, and no geometry path consults it. The
 * builder clamps the pin instead, so "does this bin have feet" has exactly one
 * answer ({@link hasDetachableFeet}) for the panel, the estimate, both export
 * planners and the preview. Gating the geometry too meant five predicates that
 * had to agree, and three of them did not.
 */
export function detachableFeetFitFloor(wallThicknessMm: number): boolean {
  return detachablePinEngagementMm(wallThicknessMm) >= DETACHABLE_PIN_MIN_ENGAGEMENT_MM;
}

/**
 * Pin diameters offered for the press fit, in mm. Each is the pin's WIDEST
 * diameter, which is what decides whether it enters
 * {@link DETACHABLE_PIN_HOLE_DIAMETER_MM}.
 *
 * The range straddles the hole on purpose. FDM tends to print a small hole
 * undersize and a small pin oversize, which tightens the joint past these
 * figures, but a machine that errs the other way leaves every option below the
 * hole loose with nothing tighter to select. The values at and above the hole
 * diameter are an interference fit on paper and exist for that case.
 */
export const DETACHABLE_PIN_DIAMETERS_MM = [2.6, 2.7, 2.8, 2.9, 3, 3.1, 3.2] as const;

/** Applied when a BaseConfig's `feetPinDiameter` is missing. */
export const DEFAULT_DETACHABLE_PIN_DIAMETER_MM = 2.8;

/** Diameter of the pin holes cut into the underside of the bin floor, in mm. */
export const DETACHABLE_PIN_HOLE_DIAMETER_MM = 3;

/**
 * Floor left intact above a pin hole, in mm.
 *
 * The holes are BLIND, opened from the underside only. A hole that broke
 * through would open the interior floor at every pin, landing exactly where the
 * interior features live: a scoop's ramp reaches the front corners, dividers
 * stand on the floor, and a floor pattern is cut from the same surface. None of
 * that has to be reasoned about if the interior surface is never broken.
 *
 * Two 0.2mm layers, which is what bridges cleanly over the hole
 * below it. It costs engagement depth — a pin reaches
 * `wallThickness - this` — and that is the right way round: a shallow joint is
 * recoverable with glue, a hole through the scoop is not.
 */
export const DETACHABLE_PIN_MEMBRANE_MM = 0.4;

/**
 * Shortest pin worth building, in mm. Below this the joint is decorative, so
 * the builder refuses rather than shipping feet that fall off.
 */
export const DETACHABLE_PIN_MIN_ENGAGEMENT_MM = 0.6;

/** How deep a pin reaches into a floor of `floorThicknessMm`, in mm. */
export function detachablePinEngagementMm(floorThicknessMm: number): number {
  return floorThicknessMm - DETACHABLE_PIN_MEMBRANE_MM;
}

/**
 * Interior floor thickness, in mm.
 *
 * The spec's dead space from a bin's bottom to its cavity floor is
 * {@link GRIDFINITY.BASE_HEIGHT}, of which the socket is
 * {@link GRIDFINITY.SOCKET_HEIGHT}; the rest is floor. Shelling to
 * `wallThickness` left the cavity floor below that plane, which is what makes
 * `(height - 1) x HEIGHT_UNIT` the cavity height the spec says it is.
 *
 * A wall thicker than the remainder keeps its own floor: thinning it back to
 * spec would put less material under the cavity than beside it.
 */
export function binFloorMm(wallThicknessMm: number): number {
  return Math.max(wallThicknessMm, GRIDFINITY.BASE_HEIGHT - GRIDFINITY.SOCKET_HEIGHT);
}

/** Least engagement a detachable bin gives a pin; a thicker wall gives more. */
export const DETACHABLE_PIN_TARGET_ENGAGEMENT_MM =
  GRIDFINITY.BASE_HEIGHT - GRIDFINITY.SOCKET_HEIGHT - DETACHABLE_PIN_MEMBRANE_MM;

/**
 * Length of the tapered lead-in at a pin's tip, in mm. An L foot's three pins
 * must enter at once; with flat tips the first to touch down fixes the foot and
 * the other two land on floor.
 */
export const DETACHABLE_PIN_LEAD_IN_MM = 0.4;

/**
 * Largest gap allowed between adjacent feet, in mm.
 *
 * Not a sag limit: the bin's perimeter walls are 50mm-tall beams and carry the
 * floor between them, so four feet hold up a large bin perfectly well. It
 * bounds how far the loaded floor can bow DOWN before it touches whatever the
 * bin stands on and the bin starts rocking on its own floor instead of its
 * feet. A judgement call, not a derived figure — 140mm puts a 6x3 at corners
 * plus one mid pair and leaves a 3x2 on corners alone.
 */
export const MAX_FOOT_SPAN_MM = 140;

/** Bin wall/style variants — single source of truth for the `BinStyle` union. */
export const BIN_STYLES = ['standard', 'slotted', 'solid'] as const;

/** Bin wall/style variant */
export type BinStyle = (typeof BIN_STYLES)[number];

/** Base configuration for bin attachment */
export interface BaseConfig {
  readonly style: BaseStyle;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly screwDiameter: number;
  readonly stackingLip: boolean;
  /** When true, the bin body is a solid block (no cavity). Used by cutouts feature. */
  readonly solid: boolean;
  /** When true, subdivides the base into 0.5u half sockets per {@link halfSocketMode}. */
  readonly halfSockets: boolean;
  /**
   * Foot lattice per axis. Missing/undefined = `'grid'`, so designs
   * saved before the setting existed build byte-identical feet. Inert while
   * {@link halfSockets} is on — uniform 0.5u feet seat at either offset.
   */
  readonly footLatticeX?: FootLattice;
  readonly footLatticeY?: FootLattice;
  /**
   * When true, the base is shelled to a uniform `wallThickness` instead of a
   * solid floor + feet: the cavity floor follows the inside of the socket
   * taper, exposing the grid shape on the interior and saving filament
   * ("Gridfinity Lite"). Magnet/screw pads are retained as solid islands.
   */
  readonly lightweight: boolean;
  /**
   * Which side {@link lightweight} opens from. Missing/undefined = `'interior'`,
   * so every design saved before the setting existed builds byte-identical
   * geometry — and, because `communityParamsFingerprint` hashes `params`
   * wholesale, an always-present field would shift the fingerprint of every
   * already-published design (the same reason {@link tile} is optional).
   *
   * Inert while {@link lightweight} is off, and on a spacer, whose floor is
   * punched through by definition.
   */
  readonly lightweightMode?: LightweightMode;
  /**
   * Whether the feet print with the bin or as separate parts pressed on after.
   * Missing/undefined = `'integral'`, so every design saved before the setting
   * existed builds byte-identical geometry — and, because
   * `communityParamsFingerprint` hashes `params` wholesale, an always-present
   * field would shift the fingerprint of every already-published design (the
   * same reason {@link lightweightMode} and {@link tile} are optional).
   *
   * Inert on a socketless base, and refused on a spacer — see
   * {@link hasDetachableFeet}.
   */
  readonly feet?: FeetMode;
  /**
   * Press-fit pin diameter in mm, one of {@link DETACHABLE_PIN_DIAMETERS_MM}.
   * Read only while {@link feet} is `'detachable'`; optional for the same
   * fingerprint reason as {@link feet} itself.
   */
  readonly feetPinDiameter?: number;
  /**
   * Spacer / riser mode: a floorless frame that lifts a bin so bins of
   * different heights line up flush. Feet and stacking lip are unchanged, so its
   * height counts in the stack exactly like a bin of the same height — a 2u
   * spacer under a 2u bin reaches the top of a 4u one.
   *
   * The floor is punched through every cell, leaving the shelled feet plus the
   * webbing between them as the structure. Interior features (compartments,
   * scoops, labels, inserts, cutouts, floor patterns) have no floor to sit on and
   * are ruled out by the constraint engine; wall features still apply.
   */
  readonly spacer: boolean;
  /**
   * Base-only mode: the exact complement of {@link spacer}. A spacer keeps
   * the walls and drops the floor; this keeps the floor and drops the walls,
   * leaving feet + floor slab + an optional stacking lip. With the lip it is a
   * flat colour-blockable plate that still stacks; without it, a bare tile.
   *
   * The wall collapses to zero rather than shrinking: `deriveDimensions` pins
   * `wallHeight` to 0 and the body becomes the floor slab alone, a
   * {@link BinParams.wallThickness} of solid footprint on top of the feet. The
   * slab is structural, not cosmetic — the Gridfinity feet are `CLEARANCE`
   * narrower than their cells with rounded tops, so nothing else bridges them.
   *
   * That puts the printed height at `SOCKET_HEIGHT + wallThickness` (plus
   * `LIP_HEIGHT − LIP_OVERLAP` with the lip), which is a fraction of a height
   * unit and therefore NOT expressible via {@link BinParams.height} — `height`
   * is pinned to 1 purely so the existing range validators and their server
   * mirror keep working, and the geometry ignores it. Anything reporting a
   * bin's real height must go through `assembledHeight`, never
   * `height * heightUnitMm`.
   *
   * Needs a socket to sit on, so like {@link spacer} the flag is inert on a
   * socketless base; the constraint engine also keeps the two off together
   * (feet + floor + no floor is nothing at all).
   *
   * Optional, and absent rather than `false` when off — for the same reason
   * {@link trayBottom} is. `communityParamsFingerprint` hashes `params`
   * wholesale, so an always-present new field would shift the fingerprint of
   * every already-published design and silently break the community duplicate
   * guard and the REMIX_UNCHANGED check.
   */
  readonly tile?: boolean;
  /**
   * Underside mating geometry, read only when {@link style} is `'lid'`.
   * Optional because it must stay out of an ordinary bin's params hash (see
   * `DEFAULT_BIN_PARAMS`); `migrateParams` backfills it for a lid base.
   */
  readonly trayBottom?: TrayBottomConfig;
}
