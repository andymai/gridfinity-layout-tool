/**
 * Auto-arrange algorithm for cutouts using shelf-based bin packing.
 *
 * Sorts cutouts by depth descending, then places them left-to-right
 * in rows, starting a new row when the current one overflows.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { getEffectiveWidth, getEffectiveDepth } from './geometry';

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
 */
export function autoArrangeCutouts(
  cutouts: readonly Cutout[],
  options: AutoArrangeOptions
): Record<string, { x: number; y: number }> {
  const { binWidth, gap, staggered = false } = options;
  const sorted = [...cutouts].sort((a, b) => getEffectiveDepth(b) - getEffectiveDepth(a));
  const positions: Record<string, { x: number; y: number }> = {};

  // Compute average width for stagger offset
  const avgWidth =
    staggered && sorted.length > 0
      ? sorted.reduce((sum, c) => sum + getEffectiveWidth(c), 0) / sorted.length
      : 0;

  let rowIndex = 0;
  const staggerOffset = staggered && rowIndex % 2 === 1 ? avgWidth / 2 : 0;
  let currentX = gap + staggerOffset;
  let currentY = gap;
  let rowHeight = 0;

  for (const cutout of sorted) {
    const w = getEffectiveWidth(cutout);
    const d = getEffectiveDepth(cutout);

    // Start new row if cutout doesn't fit
    if (currentX + w + gap > binWidth) {
      rowIndex++;
      const offset = staggered && rowIndex % 2 === 1 ? avgWidth / 2 : 0;
      currentX = gap + offset;
      currentY += rowHeight + gap;
      rowHeight = 0;
    }

    positions[cutout.id] = { x: currentX, y: currentY };
    currentX += w + gap;
    rowHeight = Math.max(rowHeight, d);
  }

  return positions;
}
