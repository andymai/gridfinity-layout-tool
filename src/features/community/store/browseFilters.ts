import type {
  CommunityCard,
  CommunityCategory,
  CommunityIndexSort,
} from '@/shared/types/community';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import { cardDimensionUnits } from '../components/CommunityCard/cardDims';
import { gapFitVerdict } from '../utils/gapFit';

/**
 * `name` rides along with the filtering `id` so the clearable chip can label
 * itself without a card lookup; it is '' on a cold `?author=` deep link until
 * the loaded index resolves the display name.
 */
export interface BrowseAuthorFilter {
  readonly id: string;
  readonly name: string;
}

/**
 * Client-only sort union: 'best-fit' never crosses the wire (the fetch layer
 * always requests 'newest'), so it must not widen the server-mirrored
 * CommunityIndexSort type.
 */
export type BrowseSort = CommunityIndexSort | 'best-fit';

/**
 * Ambient dimension bounds set by an external entry point (the layout
 * editor's "find bins that fit" flow), in grid/height units. Not part of
 * `filters`: it is not toolbar-editable and survives clearFilters().
 */
export interface FitsGapContext {
  readonly widthMax: number;
  readonly depthMax: number;
  readonly maxHeight: number | null;
  /**
   * The layout's mm-per-unit scales, mirrored from the gapFit handoff:
   * placement hard-rejects scale mismatches, so the gap filter must exclude
   * cards the placement path could never place.
   */
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  readonly heightUnitMm: number;
}

export interface BrowseFilters {
  readonly searchText: string;
  readonly category: CommunityCategory | null;
  readonly technique: ExampleTechnique | null;
  readonly sort: BrowseSort;
  readonly author: BrowseAuthorFilter | null;
  readonly likedOnly: boolean;
  readonly recentOnly: boolean;
  readonly featuredOnly: boolean;
  /** Grid units at half-grid steps; bounds are inclusive. `null` = unset. */
  readonly widthMin: number | null;
  readonly widthMax: number | null;
  readonly depthMin: number | null;
  readonly depthMax: number | null;
  /** Height units at half steps; inclusive upper bound only. `null` = unset. */
  readonly maxHeight: number | null;
  /**
   * Not a predicate over the public `items` like the other filters: the
   * public index hard-excludes hidden designs, so while active the gallery
   * sources its cards from mineStore (the `mine=1` list) instead.
   */
  readonly mineOnly: boolean;
}

export const INITIAL_BROWSE_FILTERS: BrowseFilters = {
  searchText: '',
  category: null,
  technique: null,
  sort: 'newest',
  author: null,
  likedOnly: false,
  recentOnly: false,
  featuredOnly: false,
  widthMin: null,
  widthMax: null,
  depthMin: null,
  depthMax: null,
  maxHeight: null,
  mineOnly: false,
};

export function hasDimensionConstraints(filters: BrowseFilters): boolean {
  return (
    filters.widthMin !== null ||
    filters.widthMax !== null ||
    filters.depthMin !== null ||
    filters.depthMax !== null ||
    filters.maxHeight !== null
  );
}

export function hasActiveBrowseFilters(filters: BrowseFilters): boolean {
  return (
    filters.searchText !== INITIAL_BROWSE_FILTERS.searchText ||
    filters.category !== INITIAL_BROWSE_FILTERS.category ||
    filters.technique !== INITIAL_BROWSE_FILTERS.technique ||
    filters.sort !== INITIAL_BROWSE_FILTERS.sort ||
    filters.author !== null ||
    filters.likedOnly ||
    filters.recentOnly ||
    filters.featuredOnly ||
    filters.mineOnly ||
    hasDimensionConstraints(filters)
  );
}

function matchesSearch(card: CommunityCard, searchText: string, extraHaystack: string): boolean {
  const query = searchText.trim().toLowerCase();
  if (query === '') return true;
  const haystack = `${card.name} ${card.authorName} ${extraHaystack}`.toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

interface BestFitBounds {
  readonly widthMax: number | null;
  readonly depthMax: number | null;
}

const NO_BOUNDS: BestFitBounds = { widthMax: null, depthMax: null };

// With no target box to normalize against (height-only constraint), raw
// footprint area still yields a well-defined largest-first order.
function coverageScore(card: CommunityCard, bounds: BestFitBounds): number {
  const { width, depth } = cardDimensionUnits(card.metrics);
  const area = width * depth;
  if (bounds.widthMax === null || bounds.depthMax === null) return area;
  return area / (bounds.widthMax * bounds.depthMax);
}

// Mirrors the server's compareCards tie-breaking (api/community.ts): count
// sorts fall back to recency on ties, so local re-sorts match server order.
function compareCards(
  a: CommunityCard,
  b: CommunityCard,
  sort: BrowseSort,
  bounds: BestFitBounds = NO_BOUNDS
): number {
  if (sort === 'best-fit') {
    const diff = coverageScore(b, bounds) - coverageScore(a, bounds);
    if (diff !== 0) return diff;
  }
  if (sort === 'likes' && b.counts.likes !== a.counts.likes) {
    return b.counts.likes - a.counts.likes;
  }
  if (sort === 'remixes' && b.counts.remixes !== a.counts.remixes) {
    return b.counts.remixes - a.counts.remixes;
  }
  return b.createdAt - a.createdAt;
}

interface MatchContext {
  readonly matches: (card: CommunityCard) => boolean;
  /** Non-null only while the recently-viewed filter is active; also drives its ordering. */
  readonly recentRank: Map<string, number> | null;
  readonly bounds: BestFitBounds;
}

function buildMatchContext(
  filters: BrowseFilters,
  searchLabels: ((card: CommunityCard) => string) | undefined,
  recentIds: readonly string[],
  fitsGapContext: FitsGapContext | null
): MatchContext {
  const recentRank = filters.recentOnly ? new Map(recentIds.map((id, index) => [id, index])) : null;
  // An explicit toolbar bound always wins over the ambient gap context: it is
  // the more specific, more recent signal.
  const effectiveWidthMax = filters.widthMax ?? fitsGapContext?.widthMax ?? null;
  const effectiveDepthMax = filters.depthMax ?? fitsGapContext?.depthMax ?? null;
  const effectiveMaxHeight = filters.maxHeight ?? fitsGapContext?.maxHeight ?? null;
  // An explicit toolbar bound overrides the corresponding gap dimension but
  // keeps the rest of the context (notably the grid scale), so the verdict
  // stays a single comparison rather than two competing ones.
  const effectiveGap =
    fitsGapContext === null
      ? null
      : {
          ...fitsGapContext,
          widthMax: filters.widthMax ?? fitsGapContext.widthMax,
          depthMax: filters.depthMax ?? fitsGapContext.depthMax,
          maxHeight: filters.maxHeight ?? fitsGapContext.maxHeight,
        };
  const fitsFootprintMax = (width: number, depth: number): boolean =>
    (effectiveWidthMax === null || width <= effectiveWidthMax) &&
    (effectiveDepthMax === null || depth <= effectiveDepthMax);
  const matches = (card: CommunityCard): boolean => {
    const dims = cardDimensionUnits(card.metrics);
    // With a gap context the verdict comes from gapFitVerdict, the same
    // function the detail view renders, so filtering a card out of the grid
    // and telling someone "this will not fit" can never disagree. It covers
    // rotation (placement probes both orientations) and the scale match that
    // placement hard-rejects on.
    const gapVerdict = effectiveGap === null ? null : gapFitVerdict(card.metrics, effectiveGap);
    const footprintOk =
      gapVerdict !== null
        ? gapVerdict === 'fits' || gapVerdict === 'fits-rotated'
        : fitsFootprintMax(dims.width, dims.depth);
    const scaleOk = gapVerdict === null || gapVerdict !== 'scale-mismatch';
    return (
      scaleOk &&
      (filters.category === null || card.category === filters.category) &&
      (filters.technique === null || card.techniques.includes(filters.technique)) &&
      (filters.author === null || card.authorPublicId === filters.author.id) &&
      (!filters.likedOnly || card.likedByMe === true) &&
      (!filters.featuredOnly || card.featured) &&
      (filters.widthMin === null || dims.width >= filters.widthMin) &&
      (filters.depthMin === null || dims.depth >= filters.depthMin) &&
      footprintOk &&
      (effectiveMaxHeight === null || dims.height <= effectiveMaxHeight) &&
      (recentRank === null || recentRank.has(card.id)) &&
      matchesSearch(card, filters.searchText, searchLabels?.(card) ?? '')
    );
  };
  return {
    matches,
    recentRank,
    bounds: { widthMax: effectiveWidthMax, depthMax: effectiveDepthMax },
  };
}

/**
 * The grid's own membership test, exposed so facet counts are computed with
 * the exact predicate that decides what the grid shows. A second, parallel
 * implementation would eventually promise a count the grid does not deliver.
 *
 * `mineOnly` is deliberately absent: it swaps the card source rather than
 * filtering the public index (see BrowseFilters).
 */
export function createCardMatcher(
  filters: BrowseFilters,
  searchLabels?: (card: CommunityCard) => string,
  recentIds: readonly string[] = [],
  fitsGapContext: FitsGapContext | null = null
): (card: CommunityCard) => boolean {
  return buildMatchContext(filters, searchLabels, recentIds, fitsGapContext).matches;
}

export function filterAndSortCards(
  items: readonly CommunityCard[],
  filters: BrowseFilters,
  searchLabels?: (card: CommunityCard) => string,
  recentIds: readonly string[] = [],
  fitsGapContext: FitsGapContext | null = null
): CommunityCard[] {
  const { matches, recentRank, bounds } = buildMatchContext(
    filters,
    searchLabels,
    recentIds,
    fitsGapContext
  );
  const matched = items.filter(matches);
  if (recentRank !== null) {
    // Most-recent-first is the point of the recently-viewed chip, so it
    // overrides the sort control while active.
    return matched.sort((a, b) => (recentRank.get(a.id) ?? 0) - (recentRank.get(b.id) ?? 0));
  }
  return matched.sort((a, b) => compareCards(a, b, filters.sort, bounds));
}

// Best-fit only has something to score against while a dimension constraint
// (toolbar or gap context) is active; when the last one clears, silently
// keeping the best-fit order would be an unexplained, unlabeled sort.
export function withBestFitFallback(
  filters: BrowseFilters,
  fitsGapContext: FitsGapContext | null
): BrowseFilters {
  if (filters.sort !== 'best-fit') return filters;
  if (hasDimensionConstraints(filters) || fitsGapContext !== null) return filters;
  return { ...filters, sort: 'newest' };
}

/**
 * Value equality over the filters. `author` is the only non-primitive, and it
 * is compared by id and name rather than by reference: the URL rebuilds it on
 * every decode, so a reference check would report a change on every replay.
 */
export function sameBrowseFilters(a: BrowseFilters, b: BrowseFilters): boolean {
  return (
    a.searchText === b.searchText &&
    a.category === b.category &&
    a.technique === b.technique &&
    a.sort === b.sort &&
    a.likedOnly === b.likedOnly &&
    a.recentOnly === b.recentOnly &&
    a.featuredOnly === b.featuredOnly &&
    a.mineOnly === b.mineOnly &&
    a.widthMin === b.widthMin &&
    a.widthMax === b.widthMax &&
    a.depthMin === b.depthMin &&
    a.depthMax === b.depthMax &&
    a.maxHeight === b.maxHeight &&
    a.author?.id === b.author?.id &&
    a.author?.name === b.author?.name
  );
}
