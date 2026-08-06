import type { CommunityCard, CommunityCategory } from '@/shared/types/community';
import { COMMUNITY_CATEGORIES } from '@/shared/types/community';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import type { BrowseFilters, FitsGapContext } from '../../store/browseStore';
import { createCardMatcher } from '../../store/browseStore';
import { cardDepthRank, cardHeightRank, cardWidthRank } from './galleryFilterOptions';

/** Inclusive span of values still reachable on one axis; `null` when nothing matches. */
export interface DimensionWindow {
  readonly min: number;
  readonly max: number;
}

export interface FacetCounts {
  /** Result count under every active filter — what the grid is about to show. */
  readonly total: number;
  /**
   * Count with the category selection dropped: what the "All categories"
   * option would actually yield. Not `total`, which is already narrowed by
   * whichever category is selected.
   */
  readonly categoryAll: number;
  readonly categories: ReadonlyMap<CommunityCategory, number>;
  /** Count with the technique selection dropped: what the "All" pill would yield. */
  readonly techniqueAll: number;
  readonly techniques: ReadonlyMap<ExampleTechnique, number>;
  readonly liked: number;
  readonly recent: number;
  readonly featured: number;
  readonly width: DimensionWindow | null;
  readonly depth: DimensionWindow | null;
  readonly height: DimensionWindow | null;
}

export interface FacetCountInput {
  readonly items: readonly CommunityCard[];
  readonly filters: BrowseFilters;
  readonly searchLabels?: (card: CommunityCard) => string;
  readonly recentIds: readonly string[];
  readonly fitsGapContext: FitsGapContext | null;
}

function windowOf(
  items: readonly CommunityCard[],
  matches: (card: CommunityCard) => boolean,
  rankOf: (card: CommunityCard) => number
): DimensionWindow | null {
  let min = Infinity;
  let max = -Infinity;
  for (const card of items) {
    if (!matches(card)) continue;
    const rank = rankOf(card);
    if (rank < min) min = rank;
    if (rank > max) max = rank;
  }
  return min === Infinity ? null : { min, max };
}

/**
 * Counts, per facet option, how many designs would remain if that option were
 * the selection for its facet — every other active filter still applied.
 *
 * Each facet is counted with its own selection neutralised, so choosing
 * "Tools" does not zero out every other category the moment it is picked.
 *
 * The dimension windows answer the matching question for a continuous axis:
 * which stops are still reachable, so the size sliders can refuse to travel
 * into a range that returns nothing.
 */
export function computeFacetCounts({
  items,
  filters,
  searchLabels,
  recentIds,
  fitsGapContext,
}: FacetCountInput): FacetCounts {
  const matcherFor = (overrides: Partial<BrowseFilters>): ((card: CommunityCard) => boolean) =>
    createCardMatcher({ ...filters, ...overrides }, searchLabels, recentIds, fitsGapContext);

  const total = items.filter(matcherFor({})).length;

  const categories = new Map<CommunityCategory, number>(
    COMMUNITY_CATEGORIES.map((category) => [category, 0])
  );
  const withoutCategory = matcherFor({ category: null });
  const techniques = new Map<ExampleTechnique, number>();
  const withoutTechnique = matcherFor({ technique: null });
  let categoryAll = 0;
  let techniqueAll = 0;
  for (const card of items) {
    if (withoutCategory(card)) {
      categoryAll += 1;
      categories.set(card.category, (categories.get(card.category) ?? 0) + 1);
    }
    if (withoutTechnique(card)) {
      techniqueAll += 1;
      for (const technique of card.techniques) {
        techniques.set(technique, (techniques.get(technique) ?? 0) + 1);
      }
    }
  }

  const recentSet = new Set(recentIds);
  const withoutLiked = matcherFor({ likedOnly: false });
  const withoutRecent = matcherFor({ recentOnly: false });
  const withoutFeatured = matcherFor({ featuredOnly: false });
  let liked = 0;
  let recent = 0;
  let featured = 0;
  for (const card of items) {
    if (card.likedByMe === true && withoutLiked(card)) liked += 1;
    if (recentSet.has(card.id) && withoutRecent(card)) recent += 1;
    if (card.featured && withoutFeatured(card)) featured += 1;
  }

  // One neutralised axis at a time: the reachable widths depend on the depth
  // and height bounds still being in force.
  const width = windowOf(items, matcherFor({ widthMin: null, widthMax: null }), cardWidthRank);
  const depth = windowOf(items, matcherFor({ depthMin: null, depthMax: null }), cardDepthRank);
  const height = windowOf(items, matcherFor({ maxHeight: null }), cardHeightRank);

  return {
    total,
    categoryAll,
    categories,
    techniqueAll,
    techniques,
    liked,
    recent,
    featured,
    width,
    depth,
    height,
  };
}

/** Stop list for one axis: every distinct value present in the loaded index. */
export function dimensionStops(
  items: readonly CommunityCard[],
  rankOf: (card: CommunityCard) => number
): number[] {
  return Array.from(new Set(items.map(rankOf))).sort((a, b) => a - b);
}
