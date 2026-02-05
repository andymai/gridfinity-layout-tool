/**
 * Auto-arrange algorithm for cutouts using shelf-based bin packing.
 *
 * Sorts cutouts by depth descending, then places them left-to-right
 * in rows, starting a new row when the current one overflows.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { getEffectiveWidth, getEffectiveDepth } from './geometry';

interface AutoArrangeOptions {
  readonly binWidth: number;
  readonly binDepth: number;
  readonly gap: number;
}

/**
 * Compute new positions for cutouts using shelf-based bin packing.
 * Returns a map of cutout ID → new position.
 */
export function autoArrangeCutouts(
  cutouts: readonly Cutout[],
  options: AutoArrangeOptions
): Record<string, { x: number; y: number }> {
  const { binWidth, gap } = options;
  const sorted = [...cutouts].sort((a, b) => getEffectiveDepth(b) - getEffectiveDepth(a));
  const positions: Record<string, { x: number; y: number }> = {};

  let currentX = gap;
  let currentY = gap;
  let rowHeight = 0;

  for (const cutout of sorted) {
    const w = getEffectiveWidth(cutout);
    const d = getEffectiveDepth(cutout);

    // Start new row if cutout doesn't fit
    if (currentX + w + gap > binWidth) {
      currentX = gap;
      currentY += rowHeight + gap;
      rowHeight = 0;
    }

    positions[cutout.id] = { x: currentX, y: currentY };
    currentX += w + gap;
    rowHeight = Math.max(rowHeight, d);
  }

  return positions;
}
