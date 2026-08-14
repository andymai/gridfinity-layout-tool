/**
 * Click-lock lid feature compatibility checks.
 *
 * The lid's mating shell drops INTO the bin's mouth and grips the
 * stacking lip's inner face. That makes the lid sensitive to anything
 * that:
 *   1. Removes lip material on a wall (wall cutouts, certain patterns) —
 *      the click rail on that wall has nothing to grip.
 *   2. Adds upward-projecting material inside the bin (tall divider
 *      pieces, very tall inserts) — the lid's mating shell physically
 *      collides with it.
 *   3. Makes the bin too short for the rail extension (1U bins).
 *   4. Fills the pocket under the lip (a finger scoop against an outer
 *      wall), leaving the click rail's bump nothing to hook beneath.
 *
 * `checkLidCompatibility(params)` returns a typed list of issues so
 * `LidSection` can render warnings inline. Each issue has an `id`
 * matching the i18n key suffix `binDesigner.lid.compat.{id}`, a
 * severity, and (when applicable) a list of affected sides.
 *
 * The helper is geometry-only — it's pure (no React) and runs cheaply
 * enough to evaluate on every params change.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { isPartialMask, maskToPolygon } from '@/shared/utils/cellMask';
import { computeHandleHoleGeometry } from '@/shared/utils/handleCutoutClip';
import { hasAnyPatternedWall } from '@/shared/utils/wallPatternSides';
import { railFoulingLabelFootprints } from '@/shared/utils/labelTabPlan';
import { dividerRailBlocks, dividerRailSides } from '@/shared/utils/dividerRailPlan';
import {
  computeLipOffset,
  resolveScoopPlacement,
  resolveScoopProfile,
  resolveScoopSide,
} from '@/shared/utils/scoopCalculations';
import type { BinParams, HandleConfig, HandleSide, ScoopSide } from '../types';
import {
  LID_CLICK_RAIL_BAND_BELOW_WALL_TOP,
  LID_MAGNET_LIP_CLEARANCE,
  resolveLidCavityExtraMm,
} from '../types/lid';
import { compartmentHasTiltedEdge, getCompartmentBounds } from './compartments';
import { binDimensions } from './binDimensions';

/** Wall side affected by a per-side issue (e.g. wall cutouts). */
export type LidCompatibilitySide = 'front' | 'back' | 'left' | 'right';

/** Severity of a compatibility issue. */
export type LidCompatibilitySeverity = 'blocker' | 'warning';

/**
 * Stable IDs for compatibility issues. Each maps to an i18n key under
 * `binDesigner.lid.compat.{id}` for the user-facing message.
 */
export type LidCompatibilityId =
  | 'wallCutouts'
  | 'wallCutoutsAllSides'
  | 'wallPattern'
  | 'shortBin'
  | 'tallLidShortBin'
  | 'tallDividerPieces'
  | 'cellMaskHoles'
  | 'compartmentDividers'
  | 'labelTabs'
  | 'handles'
  | 'handlesAllSides'
  | 'topDownCutoutsAtLip'
  | 'scoopFillsLip'
  // Magnetic-retention (#2694) specific:
  | 'magnetsPolygonUnsupported'
  | 'magnetTooDeepForBin'
  | 'magnetBinTooSmall';

export interface LidCompatibilityIssue {
  readonly id: LidCompatibilityId;
  readonly severity: LidCompatibilitySeverity;
  /** When set, the issue applies only to specific walls (e.g. wall cutouts). */
  readonly sides?: readonly LidCompatibilitySide[];
}

const WALL_SIDES = ['front', 'back', 'left', 'right'] as const;

/**
 * Total added cavity depth (mm) at or above which a tall lid on a 1U bin earns
 * the `tallLidShortBin` leverage warning. ~10mm is roughly the standard lid's own
 * height, so at this point the added cavity doubles the lever arm on an already
 * marginal click grip. Below it, the extra height is negligible next to the grip.
 */
const TALL_LID_LEVERAGE_WARN_MM = 10;

/**
 * Retaining-floor threshold (mm): below this, the warning fires because the
 * worker's `lidRetentionStage` clamps the pocket to keep this much material,
 * so the magnet would seat shallower than requested. Kept as a local literal
 * (value 0.6) rather than imported, to avoid pulling a worker-side geometry
 * constant across the feature boundary — the two must stay in sync by hand.
 */
const MAGNET_POST_MIN_FLOOR = 0.6;

/**
 * Local mirror of the worker's `LID_MAGNET_BOSS_WALL` (1.0), used with
 * {@link LID_MAGNET_LIP_CLEARANCE} to reject bins too small to place the four
 * corner magnets. Duplicated as a literal to avoid importing a worker-side
 * geometry constant across the feature boundary — keep in sync by hand with
 * `retentionMagnetGeometry.ts` / `lidConstants.ts`.
 */
const MAGNET_BOSS_WALL = 1.0;

/**
 * Interior wall height available for handle holes (mm). Mirrors the
 * `interiorHeight` derivation used by `handleBuilder` and the existing
 * `tallDividerPieces` check — handle hole geometry positions itself
 * relative to this height, not the total bin height.
 */
function computeInteriorHeight(params: BinParams): number {
  return params.height * params.heightUnitMm - GRIDFINITY.SOCKET_HEIGHT;
}

/**
 * Z extent of the lip's bottom face within the interior coordinate frame
 * (Z = 0 at floor, Z = interiorHeight at wall top). The click rail
 * grips lip material between this Z and `interiorHeight`. Anything cut
 * through the lip Z range (e.g. a tall handle hole) removes the
 * material the rail needs to engage with.
 */
function lipBottomZ(interiorHeight: number): number {
  return interiorHeight - GRIDFINITY.LIP_HEIGHT;
}

/**
 * Does the per-side handle hole extend up into the lip Z range?
 *
 * Mirrors the geometry in `handleBuilder.ts` so the lip check agrees
 * with what actually gets cut: the hole is centered at `centerZ`, so
 * its top sits at `centerZ + effectiveHeight/2`, compared against the
 * lip's bottom Z.
 */
function handleSideIntrudesLip(
  handles: HandleConfig,
  side: LidCompatibilitySide,
  interiorHeight: number
): boolean {
  if (!handles.enabled) return false;
  const sideCfg: HandleSide = handles[side];
  if (!sideCfg.enabled) return false;

  const requestedHeight = sideCfg.height ?? handles.height;
  const { centerZ, effectiveHeight } = computeHandleHoleGeometry(
    interiorHeight,
    requestedHeight,
    handles.verticalPosition
  );
  const topZ = centerZ + effectiveHeight / 2;
  return topZ > lipBottomZ(interiorHeight);
}

/** Horizontal distance the lip's inner face reaches in from the outer wall. */
const LIP_TAPER_WIDTH = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;

/**
 * Does a ramp on `side` reach up into the band a click rail drops into?
 *
 * Not "is there a ramp": the ramp's inward offset and the thin chute above it
 * cost the rail 0.07mm against a 0.64mm snap baseline, which is nothing. What
 * buries a rail is the ramp's own ARC reaching the band — its surface runs
 * inboard fast, 12.8mm at the rail's lowest point on a 2x2x4 scooped to the
 * wall top (#3434). Auto scoops are held clear by `autoScoopCeiling`; a radius
 * the user typed is honoured, and this is what warns about it.
 *
 * Only compartments touching the outer wall take the lip offset (`isOuter` in
 * `resolveScoopPlacement`), and `buildScoopRamps` skips any compartment with a
 * tilted edge, because a `dividerOverride` makes the floor a wedge the ramp
 * math can't describe. A wall whose compartments are all tilted keeps a usable
 * lip, so it keeps its rail.
 */
function scoopReachesRailBand(params: BinParams, side: ScoopSide): boolean {
  const { cols, rows, cells } = params.compartments;
  const { innerW, innerD, wallHeight } = binDimensions(params);
  const interiorHeight = computeInteriorHeight(params);
  const idAt = (col: number, row: number): number => cells[row * cols + col];
  const against =
    side === 'front' || side === 'back'
      ? Array.from({ length: cols }, (_, col) => idAt(col, side === 'front' ? 0 : rows - 1))
      : Array.from({ length: rows }, (_, row) => idAt(side === 'left' ? 0 : cols - 1, row));

  return against.some((id) => {
    if (compartmentHasTiltedEdge(params.compartments, id)) return false;
    const bounds = getCompartmentBounds(params.compartments, id);
    if (!bounds) return false;
    const placement = resolveScoopPlacement(side, bounds, { cols, rows, innerW, innerD });
    if (!placement.isOuter) return false;
    // Both flags come from the data rather than the caller's gate: hard-coding
    // them true would go quietly wrong the day that gate changes shape.
    const hasLip = params.base.stackingLip;
    const profile = resolveScoopProfile(
      params.scoop,
      placement.span,
      placement.depth,
      placement.isOuter,
      hasLip,
      wallHeight,
      interiorHeight,
      computeLipOffset(hasLip, placement.isOuter, LIP_TAPER_WIDTH, params.wallThickness)
    );
    if (!profile) return false;
    // Slack, because `autoScoopCeiling` resolves to exactly `wallHeight - band`
    // and that subtraction does not round-trip: a clamped auto scoop would
    // otherwise land a few ULPs inside its own limit and warn about itself.
    return wallHeight - profile.height < LID_CLICK_RAIL_BAND_BELOW_WALL_TOP - 1e-6;
  });
}

/**
 * Inspect a `BinParams` and return all click-lock-lid compatibility issues
 * that apply. Returns an empty array when the lid would mate without caveats.
 *
 * Callers should ignore the result when `params.lid.enabled === false` —
 * the function makes no assumption about whether the lid is actually
 * being generated, it just reports geometric incompatibilities.
 */
/** Severity rank for stable sorting (lower number = higher priority). */
const SEVERITY_RANK: Record<LidCompatibilitySeverity, number> = {
  blocker: 0,
  warning: 1,
};

export function checkLidCompatibility(params: BinParams): readonly LidCompatibilityIssue[] {
  const issues: LidCompatibilityIssue[] = [];
  // Polygon (custom-shape) bins auto-disable wall cutouts + wall pattern
  // via `FeatureGate` even if the stored flags are still `true`. Don't
  // warn about features the bin generator silently skips — false
  // positives erode trust in the rest of the warnings.
  const isPolygon = isPartialMask(params.cellMask);
  // Magnetic retention (#2694) holds via corner magnets independent of the
  // lip, so the rail/lip-grip warnings below don't apply — a magnetic lid
  // seats fine even with cutouts on every wall. The magnetic branch adds its
  // own checks instead.
  const isMagnetic = params.lid.attachment === 'magnetic';

  // 1. Wall cutouts. Each enabled side removes lip material on that wall.
  //    All four sides cut → no lip anywhere → blocker (lid has nothing to
  //    grip). Some-sides cut → warning (lid still mates on remaining walls).
  if (params.walls.enabled && !isPolygon && !isMagnetic) {
    const cutSides: LidCompatibilitySide[] = [];
    for (const side of WALL_SIDES) {
      if (params.walls[side].enabled) cutSides.push(side);
    }
    if (cutSides.length === WALL_SIDES.length) {
      issues.push({
        id: 'wallCutoutsAllSides',
        severity: 'blocker',
        sides: cutSides,
      });
    } else if (cutSides.length > 0) {
      issues.push({ id: 'wallCutouts', severity: 'warning', sides: cutSides });
    }
  }

  // 2. Wall pattern. Patterns extend up to (LIP_HEIGHT + 2)mm into the
  //    lip Z range (see `wallPatternBuilder.clipOvershoot`), perforating
  //    the lip's inner face that the lid's rails grip. A divider-only
  //    pattern (#2966: every outer wall deselected) never touches the lip.
  if (
    params.wallPattern.enabled &&
    hasAnyPatternedWall(params.wallPattern) &&
    !isPolygon &&
    !isMagnetic
  ) {
    issues.push({ id: 'wallPattern', severity: 'warning' });
  }

  // 3. Very short bins (1U). The rail extends ~5.7mm below the lip top,
  //    leaving only ~1.3mm of overlap with the bin's main wall on a 1U
  //    bin (totalH=7mm). The lid still seats but the click is marginal.
  if (params.height <= 1 && !isMagnetic) {
    issues.push({ id: 'shortBin', severity: 'warning' });
    // A tall lid (issue #2482) on that already-marginal 1U grip adds a long
    // lever arm — the taller the cavity, the more a knock can pop the lid off
    // its shallow click. Flag once the added height is a meaningful multiple of
    // the grip. Independent of the geometry, which stays valid either way.
    // Measures TOTAL added depth, not just `extraHeightMm`: a thick floor plate
    // (#2761) deepens the cavity too and lengthens the same lever arm.
    if (resolveLidCavityExtraMm(params) >= TALL_LID_LEVERAGE_WARN_MM) {
      issues.push({ id: 'tallLidShortBin', severity: 'warning' });
    }
  }

  // 4. Tall divider pieces. Slotted bins use separately-printed dividers
  //    that slide into floor slots. When the user sets a manual mm height
  //    larger than the bin's interior, the divider protrudes above the
  //    lip and physically blocks the lid from seating. 'auto' fits.
  if (
    params.style === 'slotted' &&
    typeof params.dividerPieces.height === 'number' &&
    params.dividerPieces.height > computeInteriorHeight(params)
  ) {
    issues.push({ id: 'tallDividerPieces', severity: 'blocker' });
  }

  // 5. Custom shape with interior holes (O-shape / ring topology). The
  //    polygon rail-placement walks only the OUTER perimeter, so inner
  //    hole edges have lip material but no rails. Lid mates asymmetrically
  //    — fine functionally, worth flagging so users aren't confused why
  //    the click is uneven.
  if (isPolygon && maskToPolygon(params.cellMask).length > 1) {
    issues.push({ id: 'cellMaskHoles', severity: 'warning' });
  }

  // 6. Label tabs. A tab's shelf occupies the same Z band the click rail
  //    sweeps, so a rail on the tab's own anchor wall has nowhere to go and
  //    is skipped during placement. Which wall that is comes from the tab
  //    geometry, not a constant: `label.edges` may anchor tabs to the FRONT
  //    (or both), and a shelf dropped clear of the rail band (#1898's
  //    tuck-under pocket, or an inset that pulls the body off the wall)
  //    fouls nothing at all and must keep its rail.
  //
  //    No side is disabled outright: `railSegmentsClearOfLabelTabs` cuts each
  //    wall's run around the tabs and keeps whatever is left, which is what
  //    makes 75%/100% coverage usable with tabs at all (#3401).
  if (params.label.enabled && !isPolygon && !isMagnetic) {
    const anchored: ReadonlySet<string> = new Set(
      railFoulingLabelFootprints(params).map((fp) => fp.anchor)
    );
    const sides = WALL_SIDES.filter((side) => anchored.has(side));
    if (sides.length > 0) {
      issues.push({ id: 'labelTabs', severity: 'warning', sides });
    }
  }

  // 7. Handles. Handles cut through the wall body; when the hole's top
  //    Z exceeds the lip's bottom Z, the cutout removes lip material on
  //    that wall — same impact as a wall cutout. Sides where the handle
  //    sits clear of the lip don't conflict and don't warn. All four
  //    sides intruding → blocker (lid has no wall to grip). Interior
  //    handles (compartment dividers) don't touch the outer lip, so
  //    they're excluded.
  if (params.handles.enabled && !isPolygon && !isMagnetic) {
    const interiorHeight = computeInteriorHeight(params);
    const intrudingSides: LidCompatibilitySide[] = [];
    for (const side of WALL_SIDES) {
      if (handleSideIntrudesLip(params.handles, side, interiorHeight)) {
        intrudingSides.push(side);
      }
    }
    if (intrudingSides.length === WALL_SIDES.length) {
      issues.push({ id: 'handlesAllSides', severity: 'blocker', sides: intrudingSides });
    } else if (intrudingSides.length > 0) {
      issues.push({ id: 'handles', severity: 'warning', sides: intrudingSides });
    }
  }

  // 8. Top-down cutouts on solid bins. When a cutout's `cutDepth`
  //    reaches into the lip Z range (cutout top sits at `wallTop -
  //    cutoutConfig.topOffset`, descending by `cutDepth`), it locally
  //    removes lip material at the cutout footprint. Only solid bins
  //    apply top-down cutouts; normal-style bins use floor inserts and
  //    don't carve into the rim.
  if (params.style === 'solid' && !isPolygon && !isMagnetic && params.cutouts.length > 0) {
    const interiorHeight = computeInteriorHeight(params);
    const lipBottom = lipBottomZ(interiorHeight);
    const topZ = interiorHeight - params.cutoutConfig.topOffset;
    const anyReachesLip = params.cutouts.some(
      (c) => !c.hidden && topZ - c.cutDepth < interiorHeight && topZ > lipBottom
    );
    if (anyReachesLip) {
      issues.push({ id: 'topDownCutoutsAtLip', severity: 'warning' });
    }
  }

  // 9. Compartment dividers (#3477). A divider is built from the cavity floor
  //    to the interior ceiling, whose top is only `LIP_SMALL_TAPER` below the
  //    bin's wall top, and a seated click rail hangs 3.15mm under that same
  //    plane while reaching inboard of the inner wall face. A rail run straight
  //    through a divider's end is therefore 3.1mm of solid-on-solid overlap and
  //    the lid cannot close at all. `dividerRailBlocks` notches the run around
  //    them; this reports which walls paid for it.
  //
  //    Rail-specific, like `scoopFillsLip` and unlike every lip check above: a
  //    friction or magnetic lid's mating skirt stops ABOVE the divider tops, so
  //    those modes have nothing to warn about. Everything else the planner
  //    answers — a shortened `dividerHeight`, a tall `extraWallHeightMm` collar,
  //    a polygon or non-standard style, or a grid too fine to build walls at
  //    all each yield no blocks, and so no warning.
  if (params.lid.attachment === 'clickRails') {
    const sides = dividerRailSides(dividerRailBlocks(params));
    if (sides.length > 0) {
      issues.push({ id: 'compartmentDividers', severity: 'warning', sides });
    }
  }

  // 10. Finger scoop reaching the click rail's band (#3426, #3434). A ramp
  //     against an outer wall of a lipped bin rises toward the lip, and where
  //     it reaches the top ~3.15mm of the wall its arc fills the pocket the
  //     rail's bump drops into to hook the lip's underside — so that edge of
  //     the lid is propped off the rim.
  //
  //     The gate is how HIGH the ramp resolves, not whether it takes a lip
  //     offset. #3432 gated on the offset and dropped the rail for every
  //     scooped wall; the offset and its chute cost 0.07mm against a 0.64mm
  //     snap baseline, and the ramp reaching the top costs 0.39mm. Auto scoops
  //     are now held clear by `autoScoopCeiling`, so this fires only for a
  //     radius the user typed that lands in the band.
  //
  //     The lite floor is `dimensions.lightweight`, not `base.lightweight`:
  //     `deriveDimensions` folds the spacer in (it always shells) and drops
  //     both on a socketless base, where the flag has no socket to act on and
  //     the ramp is built after all.
  //
  //     Unlike the checks above this one is rail-specific, not lip-specific:
  //     the ramp takes nothing away from the lip, so a friction shell still
  //     seats on it. Only a rail needs the pocket, so only `clickRails` cares.
  //
  //     Silent once the interior is relieved (#3477): the envelope cut takes
  //     the ramp's top back to the keep-out plane, so the pocket the rail hooks
  //     is open by construction and there is nothing for the user to act on.
  const socketless = params.base.style === 'flat' || params.base.style === 'lid';
  const liteFloor = (params.base.lightweight || params.base.spacer) && !socketless;
  if (
    !interiorReliefActive(params) &&
    params.scoop.enabled &&
    params.style === 'standard' &&
    params.base.stackingLip &&
    !liteFloor &&
    params.lid.attachment === 'clickRails'
  ) {
    const side = resolveScoopSide(params.scoop);
    if (scoopReachesRailBand(params, side)) {
      issues.push({ id: 'scoopFillsLip', severity: 'warning', sides: [side] });
    }
  }

  // 11. Magnetic retention (#2694).
  if (isMagnetic) {
    // Corner magnet placement isn't defined on an arbitrary polygon outline,
    // so a magnetic custom-shape lid falls back to a plain friction lid with
    // no magnets. Warn so the user isn't surprised the magnets vanished.
    if (isPolygon) {
      issues.push({ id: 'magnetsPolygonUnsupported', severity: 'warning' });
    } else {
      const diameter = params.lid.retentionMagnet.diameter;
      // XY bounds: the four corner gusset pads are inset from each edge by
      // `LID_MAGNET_LIP_CLEARANCE + bossRadius` and each extends inward by a further
      // `bossRadius`, so opposite pads only stay apart when each half-extent >=
      // inset + bossRadius = LID_MAGNET_LIP_CLEARANCE + 2*bossRadius
      // = LID_MAGNET_LIP_CLEARANCE + diameter + 2*MAGNET_BOSS_WALL (bossRadius =
      // diameter/2 + MAGNET_BOSS_WALL). A smaller bin would merge the pads at
      // the centre, so block it — the design can't place four clean corners.
      const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
      const minHalfMm = LID_MAGNET_LIP_CLEARANCE + diameter + 2 * MAGNET_BOSS_WALL;
      const tooSmall =
        (params.width * params.gridUnitMm) / 2 < minHalfMm ||
        (params.depth * gridUnitMmY) / 2 < minHalfMm;
      if (tooSmall) {
        issues.push({ id: 'magnetBinTooSmall', severity: 'blocker' });
      } else {
        // Z bounds: the pad houses the magnet between the (recessed) lip top and
        // a retaining floor. If the magnet is deeper than the interior can hold
        // (minus a thin floor), the pocket would punch through the bin floor —
        // blocker when it can't fit at all, warning when the floor gets marginal.
        const interiorHeight = computeInteriorHeight(params);
        const depth = params.lid.retentionMagnet.depth;
        if (depth >= interiorHeight) {
          issues.push({ id: 'magnetTooDeepForBin', severity: 'blocker' });
        } else if (interiorHeight - depth < MAGNET_POST_MIN_FLOOR) {
          issues.push({ id: 'magnetTooDeepForBin', severity: 'warning' });
        }
      }
    }
  }

  // Sort by severity so blockers always appear first in the panel.
  // Issues within the same severity tier preserve their insertion order
  // (the checks above are listed in approximate user-impact order).
  return issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Convenience: any blocker = the lid effectively can't be used. */
export function hasLidBlocker(issues: readonly LidCompatibilityIssue[]): boolean {
  return issues.some((i) => i.severity === 'blocker');
}

/**
 * Is the bin's interior carved back to clear the lid's seating envelope (#3477)?
 *
 * The single gate, read by the pipeline stage that cuts the ring, by
 * `dividerRailBlocks` (which has nothing to notch once it is on), by the label
 * shelf's datum, and by the scoop warning. A second copy anywhere would let the
 * bin be relieved while the rails still notched, or the reverse.
 *
 * `shouldGenerateLid` minus its blocker term, and NOT a call to it. Two
 * reasons, and the first is fatal: `checkLidCompatibility` reaches this
 * predicate through the divider planner and the label shelf's datum, so
 * consulting the blocker set from here is unbounded recursion. The second is
 * that it is the better rule anyway — a blocker is a transient state the panel
 * asks the user to fix, and letting it move the cavity's geometry would make a
 * bin regenerate whenever an unrelated feature was toggled into conflict.
 *
 * The cost is a design parked in a blocking state (cutouts on all four walls,
 * say) keeping a ring cut for a lid that is not currently generated.
 */
export function interiorReliefActive(params: BinParams): boolean {
  if (!params.lid.relieveInterior) return false;
  if (!params.lid.enabled) return false;
  // A lid needs a lip to grip, and a base-only tile has no cavity to relieve.
  if (!params.base.stackingLip) return false;
  if (params.base.tile === true) return false;
  // Polygon footprints keep the notching path until the outline offset lands
  // (#3482); nothing reaches the band on one today.
  if (isPartialMask(params.cellMask)) return false;
  return true;
}

/**
 * Should the worker actually generate/export a lid for these params?
 *
 * Single source of truth shared by `useLidSection.effectiveEnabled` (UI),
 * `lidOrchestrator.generateLid` (preview), and `exportHandler` (export).
 * Without this, a user who flips on the lid then enables a blocking
 * feature (e.g. wall cutouts on all 4 sides) would see the panel toggle
 * auto-disable but the worker would still emit a malformed lid.
 */
export function shouldGenerateLid(params: BinParams): boolean {
  if (!params.lid.enabled) return false;
  if (!params.base.stackingLip) return false;
  // A base-only bin keeps its lip, so the usual lip precondition passes and a
  // lid would be emitted for a plate with no cavity to close. Gated here rather
  // than in the constraint engine because the lid is not a `FeatureKey`.
  if (params.base.tile === true) return false;
  return !hasLidBlocker(checkLidCompatibility(params));
}

/**
 * UI-side groupings: which feature section "owns" each compatibility ID.
 * Used by individual feature sections to ask "am I blocking the lid right
 * now?" so they can render a small conflict badge on their own header.
 *
 * Only blocker IDs need entries here — `isLidBlockedBySection` filters
 * by `severity === 'blocker'`. Warning-only IDs are intentionally absent.
 */
export type LidConflictSection = 'walls' | 'dividerPieces' | 'handles';

const ID_TO_SECTION: Partial<Record<LidCompatibilityId, LidConflictSection>> = {
  wallCutoutsAllSides: 'walls',
  tallDividerPieces: 'dividerPieces',
  handlesAllSides: 'handles',
};

/**
 * Is the user's currently-enabled lid blocked because of this feature
 * section? Returns false when the lid isn't intended to be active
 * (`lid.enabled` off, or no stacking lip) — sections shouldn't display
 * lid-conflict badges if the user isn't trying to use the lid.
 */
export function isLidBlockedBySection(params: BinParams, section: LidConflictSection): boolean {
  if (!params.lid.enabled || !params.base.stackingLip) return false;
  return checkLidCompatibility(params).some(
    (i) => i.severity === 'blocker' && ID_TO_SECTION[i.id] === section
  );
}

/**
 * Issues whose `sides` describe where a conflict IS, not a wall to switch off.
 *
 * A label tab does not necessarily take its whole wall. The rail builder
 * segments the run around the tabs and keeps whatever stretches are left
 * (#3401), so a wall the tabs fully cover still ends up friction-fit while a
 * wall with gaps keeps rails in them. Deciding that here, up front, would
 * throw the gaps away before anything measured them.
 *
 * A compartment divider is the same shape of thing, one wall crossing at a time
 * (#3477): it costs the rail its own width plus a margin, never the wall.
 *
 * Cutouts and intruding handles are different: they remove the lip material a
 * rail grips along the whole wall, so there is nothing to segment around.
 */
const SIDES_ARE_ADVISORY: ReadonlySet<LidCompatibilityId> = new Set([
  'labelTabs',
  'compartmentDividers',
]);

/**
 * Per-side rail engagement: which sides should NOT receive a click rail
 * due to a conflicting feature on that wall.
 *
 * Takes the already-computed compatibility issue list so callers that
 * have memoized it (the `useLidSection` panel) don't trigger a second
 * `checkLidCompatibility` scan. Aggregating from issues — rather than
 * re-deriving conflicts from `params` — guarantees the panel's
 * warning rows and the worker's actual rail placements draw from one
 * source of truth.
 */
export function computeDisabledRails(
  issues: readonly LidCompatibilityIssue[]
): ReadonlySet<LidCompatibilitySide> {
  const disabled = new Set<LidCompatibilitySide>();
  for (const issue of issues) {
    if (!issue.sides || SIDES_ARE_ADVISORY.has(issue.id)) continue;
    // Only side-bearing issues affect per-side rail placement.
    // wallCutoutsAllSides/handlesAllSides are blockers — they short-circuit
    // generation entirely via `shouldGenerateLid`, so we don't need to
    // populate `disabled` in that case. But callers that inspect the set
    // independently still benefit from a complete picture, so include them.
    for (const side of issue.sides) disabled.add(side);
  }
  return disabled;
}
