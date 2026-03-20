import type { Bin, BinId, GridUnits, Layout } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';

/** Edge to align selected bins against. */
export type AlignEdge = 'left' | 'right' | 'top' | 'bottom';

/** Per-bin result of an alignment operation. */
export interface AlignResult {
  binId: BinId;
  newX: GridUnits;
  newY: GridUnits;
  /** True if the bin could not move without colliding with a non-selected bin. */
  skipped: boolean;
}

/**
 * Compute target positions for aligning selected bins to a common edge.
 *
 * - **left**: align all left edges to the leftmost bin's x
 * - **right**: align all right edges to the rightmost bin's (x + width)
 * - **top**: align all top edges to the topmost bin's (y + depth)  (Y increases upward)
 * - **bottom**: align all bottom edges to the bottommost bin's y
 *
 * Bins that would collide with non-selected bins after moving are skipped.
 * Bins already at the target position are included as successful (no-op).
 * Staging bins are excluded entirely.
 */
export function computeAlignedPositions(
  bins: readonly Bin[],
  selectedIds: readonly BinId[],
  edge: AlignEdge,
  layout: Layout
): AlignResult[] {
  const selectedSet = new Set(selectedIds);
  const selected = bins.filter((b) => selectedSet.has(b.id) && b.layerId !== STAGING_ID);

  if (selected.length < 2) return [];

  const ref = computeReferenceValue(selected, edge);

  return selected.map((bin) => {
    const { newX, newY } = computeTarget(bin, edge, ref);

    // Already at target — count as success, skip the mutation
    if (newX === bin.x && newY === bin.y) {
      return { binId: bin.id, newX, newY, skipped: false };
    }

    const validation = canPlaceBin(
      { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
      bin.layerId,
      layout,
      bin.id,
      selectedSet
    );

    return { binId: bin.id, newX, newY, skipped: !validation.valid };
  });
}

function computeReferenceValue(bins: readonly Bin[], edge: AlignEdge): number {
  switch (edge) {
    case 'left':
      return Math.min(...bins.map((b) => b.x));
    case 'right':
      return Math.max(...bins.map((b) => b.x + b.width));
    case 'top':
      return Math.max(...bins.map((b) => b.y + b.depth));
    case 'bottom':
      return Math.min(...bins.map((b) => b.y));
  }
}

function computeTarget(
  bin: Bin,
  edge: AlignEdge,
  ref: number
): { newX: GridUnits; newY: GridUnits } {
  switch (edge) {
    case 'left':
      return { newX: ref as GridUnits, newY: bin.y };
    case 'right':
      return { newX: (ref - bin.width) as GridUnits, newY: bin.y };
    case 'top':
      return { newX: bin.x, newY: (ref - bin.depth) as GridUnits };
    case 'bottom':
      return { newX: bin.x, newY: ref as GridUnits };
  }
}
