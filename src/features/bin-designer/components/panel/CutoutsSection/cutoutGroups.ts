/**
 * Group-aware units for the arrange operations.
 *
 * Every arrange action — align, distribute, centre-in-bin, auto-arrange —
 * treats a cutout group as one rigid body: members keep their relative offsets
 * and the whole unit translates together. Pointer drag, resize, rotate
 * and keyboard nudge already worked this way; only the arrange math iterated
 * raw cutouts, so it scattered the members of a group across the bin.
 *
 * Two rules the callers share:
 *
 *  - **Any selected member pulls in its whole unit.** A selection that reaches
 *    a group only partially (via the shape list, say) still moves the group as
 *    one — the same expansion the canvas performs on click.
 *  - **A unit with any locked member never moves.** The lock is documented as
 *    "cannot be moved", and moving the rest of the group around a pinned member
 *    would tear the group apart. Align and distribute still let such a unit
 *    anchor the bounds; auto-arrange re-packs around it without reserving its
 *    footprint, so a locked unit can end up overlapped.
 *
 * Bounds are the *rotated* silhouette. A group's box is meaningless otherwise,
 * and every consumer expresses a move as a translation, so the unrotated
 * `x`/`y` stays in step with the box it was measured from.
 *
 * A repeat master's bounds span every expanded instance for the same reason:
 * the instances are offsets from the master, so they translate with it, and
 * centring or distributing by the master's own box alone parks the pattern
 * off-centre.
 *
 * ## What counts as one unit
 *
 * Both entry points take the editor's drill-in `context`. At the top level a
 * whole nested assembly is one rigid body, which is what lets three assemblies
 * be distributed without disturbing the spacing inside any of them. Drilled
 * into one, its direct children become the units, so the subgroups within it
 * can be arranged against each other. Same `unitTag` the shape list and the
 * store use, so all three agree about what "one thing" is.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { unitTag, unitTagGroupId } from '@/features/bin-designer/utils/cutoutHierarchy';
import { type Bounds, getRotatedBounds } from './geometryCore';

/** One rigid arrange target: a whole group, or a single ungrouped cutout. */
export interface ArrangeUnit {
  readonly members: readonly Cutout[];
  /** Rotated AABB spanning every member, repeat instances included. */
  readonly bounds: Bounds;
  /** True when any member is locked — the unit is then immovable. */
  readonly locked: boolean;
}

/**
 * A cutout's visual footprint: the rotated AABB spanning every repeat
 * instance (just the cutout's own rotated box when there is no array).
 */
export function cutoutPatternBounds(cutout: Cutout): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const instance of expandCutoutArray(cutout)) {
    const b = getRotatedBounds(instance);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Visual bounds of a whole selection — what the on-screen silhouettes span,
 * repeat instances and rotation included. The box every multi-select
 * transform (group box, flip mirror, rotate/scale pivot) must measure, or the
 * operation centers on a box the user cannot see.
 */
export function selectionVisualBounds(cutouts: readonly Cutout[]): Bounds {
  if (cutouts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cutout of cutouts) {
    const b = cutoutPatternBounds(cutout);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

function makeUnit(members: readonly Cutout[]): ArrangeUnit {
  const bounds = selectionVisualBounds(members);
  const locked = members.some((member) => member.locked);
  return { members, bounds, locked };
}

/**
 * Add every cutout sharing a unit with anything selected, resolved at
 * `context`.
 *
 * Returns the input untouched when the selection already spans whole units, so
 * the common loose-shape case allocates nothing.
 */
export function expandSelectionToGroups(
  all: readonly Cutout[],
  selected: readonly Cutout[],
  context: readonly string[] = []
): readonly Cutout[] {
  const tags = new Set<string>();
  for (const cutout of selected) {
    const tag = unitTag(cutout, context);
    // A loose shape is its own unit, so it can never pull anything else in.
    if (tag !== null && unitTagGroupId(tag) !== null) tags.add(tag);
  }
  if (tags.size === 0) return selected;

  const selectedIds = new Set(selected.map((c) => c.id));
  const expanded = [...selected];
  for (const cutout of all) {
    if (selectedIds.has(cutout.id)) continue;
    const tag = unitTag(cutout, context);
    if (tag !== null && tags.has(tag)) expanded.push(cutout);
  }
  return expanded;
}

/**
 * Collapse cutouts into arrange units — one per group at `context`, one per
 * loose shape. Units come out in first-appearance order so results stay stable.
 */
export function toArrangeUnits(
  cutouts: readonly Cutout[],
  context: readonly string[] = []
): ArrangeUnit[] {
  const byTag = new Map<string, Cutout[]>();
  const order: string[] = [];
  for (const cutout of cutouts) {
    const tag = unitTag(cutout, context);
    // Outside this branch entirely — not something the operation can move.
    if (tag === null) continue;
    const members = byTag.get(tag);
    if (members) members.push(cutout);
    else {
      byTag.set(tag, [cutout]);
      order.push(tag);
    }
  }
  return order.map((tag) => makeUnit(byTag.get(tag) ?? []));
}

/** Bounds spanning every unit, locked ones included — they anchor. */
export function unitsBounds(units: readonly ArrangeUnit[]): Bounds {
  if (units.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const unit of units) {
    minX = Math.min(minX, unit.bounds.minX);
    minY = Math.min(minY, unit.bounds.minY);
    maxX = Math.max(maxX, unit.bounds.maxX);
    maxY = Math.max(maxY, unit.bounds.maxY);
  }
  return { minX, minY, maxX, maxY };
}

export const unitWidth = (unit: ArrangeUnit): number => unit.bounds.maxX - unit.bounds.minX;
export const unitDepth = (unit: ArrangeUnit): number => unit.bounds.maxY - unit.bounds.minY;
