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
import type { BinParams } from '../types';

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
  | 'tallDividerPieces'
  | 'cellMaskHoles'
  | 'compartmentDividers';

export interface LidCompatibilityIssue {
  readonly id: LidCompatibilityId;
  readonly severity: LidCompatibilitySeverity;
  /** When set, the issue applies only to specific walls (e.g. wall cutouts). */
  readonly sides?: readonly LidCompatibilitySide[];
}

const WALL_SIDES = ['front', 'back', 'left', 'right'] as const;

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
  }

  // 4. Tall divider pieces. Slotted bins use separately-printed dividers
  //    that slide into floor slots. When the user sets a manual mm height
  //    larger than the bin's interior, the divider protrudes above the
  //    lip and physically blocks the lid from seating. 'auto' fits.
  const interiorHeight = params.height * params.heightUnitMm - GRIDFINITY.SOCKET_HEIGHT;
  if (
    params.style === 'slotted' &&
    typeof params.dividerPieces.height === 'number' &&
    params.dividerPieces.height > interiorHeight
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

  // 6. Compartment dividers. `compartmentBuilder` builds divider walls
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
export type LidConflictSection = 'walls' | 'dividerPieces';

const ID_TO_SECTION: Partial<Record<LidCompatibilityId, LidConflictSection>> = {
  wallCutoutsAllSides: 'walls',
  tallDividerPieces: 'dividerPieces',
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
