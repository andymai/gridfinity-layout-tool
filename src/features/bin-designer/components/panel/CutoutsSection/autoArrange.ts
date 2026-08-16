/**
 * Auto-arrange algorithm for cutouts using shelf-based bin packing.
 *
 * Sorts units by depth descending, then places them left-to-right in rows,
 * starting a new row when the current one overflows.
 *
 * A unit is a whole cutout group or a single ungrouped cutout — packing raw
 * cutouts scattered the members of a group across the bin. Placement
 * is a translation of the unit's rotated silhouette, so a rotated shape claims
 * the space it actually occupies rather than its unrotated width and depth.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { toArrangeUnits, unitWidth, unitDepth } from './cutoutGroups';

export interface AutoArrangeOptions {
  readonly binWidth: number;
  readonly binDepth: number;
  readonly gap: number;
  readonly staggered?: boolean;
}

/**
 * Compute new positions for cutouts using shelf-based bin packing.
 * When `staggered` is true, alternate rows are offset by half the average item width.
 * Returns a map of cutout ID → new position.
 *
 * Locked units keep their position and are packed around rather than moved —
 * their footprint is not reserved, so a locked unit can end up overlapped.
 */
export function autoArrangeCutouts(
  cutouts: readonly Cutout[],
  options: AutoArrangeOptions
): Record<string, { x: number; y: number }> {
  const { binWidth, gap, staggered = false } = options;
  const movable = toArrangeUnits(cutouts).filter((unit) => !unit.locked);
  const sorted = [...movable].sort((a, b) => unitDepth(b) - unitDepth(a));
  const positions: Record<string, { x: number; y: number }> = {};

  // Compute average width for stagger offset
  const avgWidth =
    staggered && sorted.length > 0
      ? sorted.reduce((sum, unit) => sum + unitWidth(unit), 0) / sorted.length
      : 0;

  let rowIndex = 0;
  const staggerOffset = staggered && rowIndex % 2 === 1 ? avgWidth / 2 : 0;
  let currentX = gap + staggerOffset;
  let currentY = gap;
  let rowHeight = 0;

  for (const unit of sorted) {
    const w = unitWidth(unit);
    const d = unitDepth(unit);

    // Start new row if unit doesn't fit
    if (currentX + w + gap > binWidth) {
      rowIndex++;
      const offset = staggered && rowIndex % 2 === 1 ? avgWidth / 2 : 0;
      currentX = gap + offset;
      currentY += rowHeight + gap;
      rowHeight = 0;
    }

    const dx = currentX - unit.bounds.minX;
    const dy = currentY - unit.bounds.minY;
    for (const member of unit.members) {
      positions[member.id] = { x: member.x + dx, y: member.y + dy };
    }

    currentX += w + gap;
    rowHeight = Math.max(rowHeight, d);
  }

  return positions;
}
