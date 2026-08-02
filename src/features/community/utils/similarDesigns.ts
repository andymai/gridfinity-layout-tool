import type {
  CommunityCard,
  CommunityDesign,
  CommunityDesignMetrics,
} from '@/shared/types/community';

export const SIMILAR_DESIGNS_MAX = 6;

const FOOTPRINT_TOLERANCE_UNITS = 1;

function isNearbyFootprint(a: CommunityDesignMetrics, b: CommunityDesignMetrics): boolean {
  // Metrics are mm; compare in grid units so "nearby" is scale-invariant
  // across designs published with different gridUnitMm values.
  const widthDelta = Math.abs(a.width / a.gridUnitMm - b.width / b.gridUnitMm);
  const depthDelta = Math.abs(a.depth / a.gridUnitMm - b.depth / b.gridUnitMm);
  return widthDelta <= FOOTPRINT_TOLERANCE_UNITS && depthDelta <= FOOTPRINT_TOLERANCE_UNITS;
}

/**
 * Similar designs for the detail rail, from the already-loaded browse index.
 * Three signals: same category, overlapping techniques, footprint within one
 * grid unit on each axis. Eligibility needs at least two of them, an
 * approximation of the plan's three-way intersection that a small library can
 * still satisfy; sharing only a category is not "similar". Matches are
 * ranked by signal count.
 */
export function findSimilarDesigns(
  target: Pick<CommunityDesign, 'id' | 'category' | 'techniques' | 'metrics'>,
  index: readonly CommunityCard[],
  max: number = SIMILAR_DESIGNS_MAX
): CommunityCard[] {
  return index
    .filter((card) => card.id !== target.id && card.status === 'live')
    .map((card) => {
      let score = 0;
      if (card.category === target.category) score += 1;
      if (card.techniques.some((technique) => target.techniques.includes(technique))) score += 1;
      if (isNearbyFootprint(card.metrics, target.metrics)) score += 1;
      return { card, score };
    })
    .filter((entry) => entry.score >= 2)
    .sort(
      (a, b) =>
        b.score - a.score ||
        // Recency tie-break mirrors compareCards (browseStore.ts); the id
        // tie-break keeps the rail deterministic for same-timestamp publishes.
        b.card.createdAt - a.card.createdAt ||
        a.card.id.localeCompare(b.card.id)
    )
    .slice(0, max)
    .map((entry) => entry.card);
}
