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
import type { BinParams, HandleConfig, HandleSide } from '../types';

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
  | 'topDownCutoutsAtLip';

export interface LidCompatibilityIssue {
  readonly id: LidCompatibilityId;
  readonly severity: LidCompatibilitySeverity;
  /** When set, the issue applies only to specific walls (e.g. wall cutouts). */
  readonly sides?: readonly LidCompatibilitySide[];
}

const WALL_SIDES = ['front', 'back', 'left', 'right'] as const;

/**
 * Extra lid height (mm) at or above which a tall lid on a 1U bin earns the
 * `tallLidShortBin` leverage warning. ~10mm is roughly the standard lid's own
 * height, so at this point the added cavity doubles the lever arm on an already
 * marginal click grip. Below it, the extra height is negligible next to the grip.
 */
const TALL_LID_LEVERAGE_WARN_MM = 10;

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

  // 1. Wall cutouts. Each enabled side removes lip material on that wall.
  //    All four sides cut → no lip anywhere → blocker (lid has nothing to
  //    grip). Some-sides cut → warning (lid still mates on remaining walls).
  if (params.walls.enabled && !isPolygon) {
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
  //    the lip's inner face that the lid's rails grip.
  if (params.wallPattern.enabled && !isPolygon) {
    issues.push({ id: 'wallPattern', severity: 'warning' });
  }

  // 3. Very short bins (1U). The rail extends ~5.7mm below the lip top,
  //    leaving only ~1.3mm of overlap with the bin's main wall on a 1U
  //    bin (totalH=7mm). The lid still seats but the click is marginal.
  if (params.height <= 1) {
    issues.push({ id: 'shortBin', severity: 'warning' });
    // A tall lid (issue #2482) on that already-marginal 1U grip adds a long
    // lever arm — the taller the cavity, the more a knock can pop the lid off
    // its shallow click. Flag once the added height is a meaningful multiple of
    // the grip. Independent of the geometry, which stays valid either way.
    if (params.lid.extraHeightMm >= TALL_LID_LEVERAGE_WARN_MM) {
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

  // 6. Label tabs. Tabs always sit on the BACK wall — the lid's click
  //    rail on that wall can't run under the tab without colliding with
  //    it, so the back rail is auto-skipped during placement. The front
  //    rail is fine. Warn so the user understands why the back rail
  //    summary changes when label tabs are on.
  if (params.label.enabled && !isPolygon) {
    issues.push({ id: 'labelTabs', severity: 'warning', sides: ['back'] });
  }

  // 7. Handles. Handles cut through the wall body; when the hole's top
  //    Z exceeds the lip's bottom Z, the cutout removes lip material on
  //    that wall — same impact as a wall cutout. Sides where the handle
  //    sits clear of the lip don't conflict and don't warn. All four
  //    sides intruding → blocker (lid has no wall to grip). Interior
  //    handles (compartment dividers) don't touch the outer lip, so
  //    they're excluded.
  if (params.handles.enabled && !isPolygon) {
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
  if (params.style === 'solid' && !isPolygon && params.cutouts.length > 0) {
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

  // 9. Compartment dividers. `compartmentBuilder` builds divider walls
  //    from `Z=0` (floor) up to `Z=wallHeight` — the full wall height,
  //    INCLUDING the lip Z range. Where the divider meets the bin's
  //    inner wall, the divider material at lip-area Z occupies the
  //    same radial space as the lid's mating shell. The lid still
  //    seats around the perimeter, but the divider's top corners can
  //    interfere with the cavity wall at the contact points.
  //
  //    Skipped when divider walls aren't actually generated:
  //    - polygon (cellMask) bins: compartments are gated off entirely
  //    - 'solid' style: no interior cavity, no compartments
  //    - 'slotted' style: uses slot rails instead of compartment walls
  //    Otherwise a stale `compartments.cells` array (left over from a
  //    previous style) would fire a false-positive warning.
  if (
    !isPolygon &&
    params.style !== 'solid' &&
    params.style !== 'slotted' &&
    new Set(params.compartments.cells).size > 1
  ) {
    issues.push({ id: 'compartmentDividers', severity: 'warning' });
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
    if (!issue.sides) continue;
    // Only side-bearing issues affect per-side rail placement.
    // wallCutoutsAllSides/handlesAllSides are blockers — they short-circuit
    // generation entirely via `shouldGenerateLid`, so we don't need to
    // populate `disabled` in that case. But callers that inspect the set
    // independently still benefit from a complete picture, so include them.
    for (const side of issue.sides) disabled.add(side);
  }
  return disabled;
}
