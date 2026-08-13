/**
 * Group-aware units for the arrange operations.
 *
 * Every arrange action — align, distribute, centre-in-bin, auto-arrange —
 * treats a cutout group as one rigid body: members keep their relative offsets
 * and the whole unit translates together (#3468). Pointer drag, resize, rotate
 * and keyboard nudge already worked this way; only the arrange math iterated
 * raw cutouts, so it scattered the members of a group across the bin.
 *
 * Two rules the callers share:
 *
 *  - **Any selected member pulls in its whole group.** A selection that reaches
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
 */

import type { Cutout } from '@/features/bin-designer/types';
import { type Bounds, getRotatedBounds } from './geometryCore';

/** One rigid arrange target: a whole group, or a single ungrouped cutout. */
export interface ArrangeUnit {
  readonly members: readonly Cutout[];
  /** Rotated AABB spanning every member. */
  readonly bounds: Bounds;
  /** True when any member is locked — the unit is then immovable. */
  readonly locked: boolean;
}

function makeUnit(members: readonly Cutout[]): ArrangeUnit {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let locked = false;

  for (const member of members) {
    const b = getRotatedBounds(member);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
    if (member.locked) locked = true;
  }

  return { members, bounds: { minX, minY, maxX, maxY }, locked };
}

/**
 * Add every member of any group the selection touches.
 *
 * Returns the input untouched when nothing selected is grouped, so the common
 * ungrouped case allocates nothing.
 */
export function expandSelectionToGroups(
  all: readonly Cutout[],
  selected: readonly Cutout[]
): readonly Cutout[] {
  const groupIds = new Set<string>();
  for (const cutout of selected) {
    if (cutout.groupId !== null) groupIds.add(cutout.groupId);
  }
  if (groupIds.size === 0) return selected;

  const selectedIds = new Set(selected.map((c) => c.id));
  const expanded = [...selected];
  for (const cutout of all) {
    if (cutout.groupId !== null && groupIds.has(cutout.groupId) && !selectedIds.has(cutout.id)) {
      expanded.push(cutout);
    }
  }
  return expanded;
}

/**
 * Collapse cutouts into arrange units — one per group, one per ungrouped
 * cutout. Units come out in first-appearance order so results stay stable.
 */
export function toArrangeUnits(cutouts: readonly Cutout[]): ArrangeUnit[] {
  const byGroup = new Map<string, Cutout[]>();
  for (const cutout of cutouts) {
    if (cutout.groupId === null) continue;
    const members = byGroup.get(cutout.groupId);
    if (members) members.push(cutout);
    else byGroup.set(cutout.groupId, [cutout]);
  }

  const units: ArrangeUnit[] = [];
  const emitted = new Set<string>();
  for (const cutout of cutouts) {
    if (cutout.groupId === null) {
      units.push(makeUnit([cutout]));
      continue;
    }
    if (emitted.has(cutout.groupId)) continue;
    emitted.add(cutout.groupId);
    units.push(makeUnit(byGroup.get(cutout.groupId) ?? [cutout]));
  }
  return units;
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
