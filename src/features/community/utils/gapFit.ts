/**
 * Does a design fit the gap the viewer picked in their layout?
 *
 * Extracted from the browse filter so the gallery and the detail view answer
 * with one implementation. Filtering a card out of the grid and telling
 * someone "this will not fit" are the same question, and they must never
 * disagree.
 */

import type { CommunityDesignMetrics } from '@/shared/types/community';
import type { FitsGapContext } from '../store/browseStore';
import { cardDimensionUnits } from '../components/CommunityCard/cardDims';

export type GapFitVerdict =
  | 'fits'
  /** Fits only turned 90 degrees, which placement does probe. */
  | 'fits-rotated'
  | 'too-large'
  | 'too-tall'
  /**
   * Built against a different mm-per-unit scale than the layout. Placement
   * hard-rejects these, so a size comparison would be meaningless.
   *
   * Only the X grid scale is screened: `CommunityDesignMetrics` is what the
   * card index carries, and it has no `gridUnitMmY` or `heightUnitMm`. A
   * design matching on X but differing on either still reaches placement and
   * surfaces through its failure toast. Screening it here would mean either
   * widening the list index or giving the detail view a second, better
   * implementation, and two implementations is exactly what this module
   * exists to prevent.
   */
  | 'scale-mismatch';

export function gapFitVerdict(
  metrics: CommunityDesignMetrics,
  context: FitsGapContext
): GapFitVerdict {
  // Scale first: comparing footprints across different grid units compares
  // numbers that do not mean the same thing. Partial by necessity, see the
  // note on the verdict type.
  if (metrics.gridUnitMm !== context.gridUnitMm) return 'scale-mismatch';

  const dims = cardDimensionUnits(metrics);

  if (context.maxHeight !== null && dims.height > context.maxHeight) return 'too-tall';

  const upright = dims.width <= context.widthMax && dims.depth <= context.depthMax;
  if (upright) return 'fits';

  // Placement probes both orientations (placeCommunityDesignInLayout), so a
  // 1x3 design does fit a 3x1 gap and saying otherwise would be wrong.
  const rotated = dims.depth <= context.widthMax && dims.width <= context.depthMax;
  return rotated ? 'fits-rotated' : 'too-large';
}
