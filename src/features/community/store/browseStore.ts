import { create } from 'zustand';
import { isOk } from '@/core/result';
import type {
  CommunityCard,
  CommunityCategory,
  CommunityIndexSort,
} from '@/shared/types/community';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import type { CommunityClientError } from '../api/client';
import { fetchCommunityIndex } from '../api/client';
import { cardDimensionUnits } from '../components/CommunityCard/cardDims';
import { gapFitVerdict } from '../utils/gapFit';

export const BROWSE_INDEX_STALE_MS = 5 * 60 * 1000;

export const GALLERY_PAGE_SIZE = 24;

export type BrowseLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

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

interface BrowseState {
  status: BrowseLoadStatus;
  items: readonly CommunityCard[];
  /** True when the fetched index was truncated to the newest `COMMUNITY_INDEX_CAP` designs. */
  capped: boolean;
  error: CommunityClientError | null;
  fetchedAt: number | null;
  filters: BrowseFilters;
  fitsGapContext: FitsGapContext | null;
  /** Gallery scroll offset, restored on return from the detail view. */
  scrollTop: number;
  /**
   * Load-more paging depth, persisted with scrollTop: restoring a scroll
   * offset past page 1 needs the same number of cards mounted again.
   */
  visibleCount: number;
  requestId: number;
}

/** Like-state patch for one card; `likes` merges into `counts` unchanged otherwise. */
export interface CardLikePatch {
  readonly likedByMe?: boolean;
  readonly likes?: number;
}

interface BrowseActions {
  ensureIndex: () => Promise<void>;
  refreshIndex: () => Promise<void>;
  /** Optimistic single-card like patch; rollback re-applies the pre-toggle values. */
  patchCardLike: (id: string, patch: CardLikePatch) => void;
  /**
   * Drops a card the owner just unpublished. The cached public index would
   * otherwise keep showing it until the next staleness refresh, and
   * selecting it lands on a 404 detail.
   */
  removeItem: (id: string) => void;
  setSearchText: (searchText: string) => void;
  setCategory: (category: CommunityCategory | null) => void;
  setTechnique: (technique: ExampleTechnique | null) => void;
  setSort: (sort: BrowseSort) => void;
  setAuthor: (author: BrowseAuthorFilter | null) => void;
  setLikedOnly: (likedOnly: boolean) => void;
  setRecentOnly: (recentOnly: boolean) => void;
  setFeaturedOnly: (featuredOnly: boolean) => void;
  setWidthMin: (widthMin: number | null) => void;
  setWidthMax: (widthMax: number | null) => void;
  setDepthMin: (depthMin: number | null) => void;
  setDepthMax: (depthMax: number | null) => void;
  setMaxHeight: (maxHeight: number | null) => void;
  setFitsGapContext: (fitsGapContext: FitsGapContext | null) => void;
  setMineOnly: (mineOnly: boolean) => void;
  clearFilters: () => void;
  setScrollTop: (scrollTop: number) => void;
  showMore: () => void;
  reset: () => void;
}

export type BrowseStore = BrowseState & BrowseActions;

export const INITIAL_BROWSE_STATE: BrowseState = {
  status: 'idle',
  items: [],
  capped: false,
  error: null,
  fetchedAt: null,
  filters: INITIAL_BROWSE_FILTERS,
  fitsGapContext: null,
  scrollTop: 0,
  visibleCount: GALLERY_PAGE_SIZE,
  requestId: 0,
};

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

export function filterAndSortCards(
  items: readonly CommunityCard[],
  filters: BrowseFilters,
  searchLabels?: (card: CommunityCard) => string,
  recentIds: readonly string[] = [],
  fitsGapContext: FitsGapContext | null = null
): CommunityCard[] {
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
  const matched = items.filter((card) => {
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
  });
  if (recentRank !== null) {
    // Most-recent-first is the point of the recently-viewed chip, so it
    // overrides the sort control while active.
    return matched.sort((a, b) => (recentRank.get(a.id) ?? 0) - (recentRank.get(b.id) ?? 0));
  }
  const bounds: BestFitBounds = { widthMax: effectiveWidthMax, depthMax: effectiveDepthMax };
  return matched.sort((a, b) => compareCards(a, b, filters.sort, bounds));
}

export function isIndexStale(fetchedAt: number | null, now: number): boolean {
  return fetchedAt === null || now - fetchedAt >= BROWSE_INDEX_STALE_MS;
}

// Best-fit only has something to score against while a dimension constraint
// (toolbar or gap context) is active; when the last one clears, silently
// keeping the best-fit order would be an unexplained, unlabeled sort.
function withBestFitFallback(
  filters: BrowseFilters,
  fitsGapContext: FitsGapContext | null
): BrowseFilters {
  if (filters.sort !== 'best-fit') return filters;
  if (hasDimensionConstraints(filters) || fitsGapContext !== null) return filters;
  return { ...filters, sort: 'newest' };
}

function withDimensionPatch(
  state: Pick<BrowseState, 'filters' | 'fitsGapContext'>,
  patch: Partial<BrowseFilters>
): Pick<BrowseState, 'filters' | 'scrollTop' | 'visibleCount'> {
  return {
    filters: withBestFitFallback({ ...state.filters, ...patch }, state.fitsGapContext),
    scrollTop: 0,
    visibleCount: GALLERY_PAGE_SIZE,
  };
}

export const useBrowseStore = create<BrowseStore>((set, get) => {
  async function load(force: boolean): Promise<void> {
    const { status, fetchedAt, requestId } = get();
    if (status === 'loading') return;
    if (!force && status === 'ready' && !isIndexStale(fetchedAt, Date.now())) return;
    const thisRequest = requestId + 1;
    set({ status: 'loading', error: null, requestId: thisRequest });
    const result = await fetchCommunityIndex();
    if (get().requestId !== thisRequest) return;
    if (isOk(result)) {
      set({
        status: 'ready',
        items: result.value.items,
        capped: result.value.capped,
        error: null,
        fetchedAt: Date.now(),
      });
    } else {
      set({ status: 'error', error: result.error });
    }
  }

  return {
    ...INITIAL_BROWSE_STATE,
    ensureIndex: () => load(false),
    refreshIndex: () => load(true),
    patchCardLike: (id, patch) => {
      set((state) => ({
        items: state.items.map((card) =>
          card.id === id
            ? {
                ...card,
                ...(patch.likedByMe !== undefined && { likedByMe: patch.likedByMe }),
                ...(patch.likes !== undefined && {
                  counts: { ...card.counts, likes: patch.likes },
                }),
              }
            : card
        ),
      }));
    },
    removeItem: (id) => {
      set((state) => ({ items: state.items.filter((card) => card.id !== id) }));
    },
    setSearchText: (searchText) => {
      set((state) => ({
        filters: { ...state.filters, searchText },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    setCategory: (category) => {
      set((state) => ({
        filters: { ...state.filters, category },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    setTechnique: (technique) => {
      set((state) => ({
        filters: { ...state.filters, technique },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    setSort: (sort) => {
      set((state) => ({
        filters: { ...state.filters, sort },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    setAuthor: (author) => {
      set((state) => ({
        filters: { ...state.filters, author },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    setLikedOnly: (likedOnly) => {
      set((state) => ({
        filters: { ...state.filters, likedOnly },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    setRecentOnly: (recentOnly) => {
      set((state) => ({
        filters: { ...state.filters, recentOnly },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    setFeaturedOnly: (featuredOnly) => {
      set((state) => ({
        filters: { ...state.filters, featuredOnly },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    // Crossed bounds (min > max) would silently empty the grid, so picking a
    // crossing value drags the opposing bound along with it.
    setWidthMin: (widthMin) => {
      set((state) =>
        withDimensionPatch(state, {
          widthMin,
          ...(widthMin !== null &&
          state.filters.widthMax !== null &&
          widthMin > state.filters.widthMax
            ? { widthMax: widthMin }
            : {}),
        })
      );
    },
    setWidthMax: (widthMax) => {
      set((state) =>
        withDimensionPatch(state, {
          widthMax,
          ...(widthMax !== null &&
          state.filters.widthMin !== null &&
          widthMax < state.filters.widthMin
            ? { widthMin: widthMax }
            : {}),
        })
      );
    },
    setDepthMin: (depthMin) => {
      set((state) =>
        withDimensionPatch(state, {
          depthMin,
          ...(depthMin !== null &&
          state.filters.depthMax !== null &&
          depthMin > state.filters.depthMax
            ? { depthMax: depthMin }
            : {}),
        })
      );
    },
    setDepthMax: (depthMax) => {
      set((state) =>
        withDimensionPatch(state, {
          depthMax,
          ...(depthMax !== null &&
          state.filters.depthMin !== null &&
          depthMax < state.filters.depthMin
            ? { depthMin: depthMax }
            : {}),
        })
      );
    },
    setMaxHeight: (maxHeight) => {
      set((state) => withDimensionPatch(state, { maxHeight }));
    },
    setFitsGapContext: (fitsGapContext) => {
      set((state) => ({
        fitsGapContext,
        filters: withBestFitFallback(state.filters, fitsGapContext),
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    setMineOnly: (mineOnly) => {
      set((state) => ({
        filters: { ...state.filters, mineOnly },
        scrollTop: 0,
        visibleCount: GALLERY_PAGE_SIZE,
      }));
    },
    clearFilters: () => {
      set({ filters: INITIAL_BROWSE_FILTERS, scrollTop: 0, visibleCount: GALLERY_PAGE_SIZE });
    },
    setScrollTop: (scrollTop) => {
      set({ scrollTop });
    },
    showMore: () => {
      set((state) => ({ visibleCount: state.visibleCount + GALLERY_PAGE_SIZE }));
    },
    reset: () => {
      // Bumping requestId invalidates any in-flight fetch so its late
      // resolution cannot repopulate a store that was just reset.
      set({ ...INITIAL_BROWSE_STATE, requestId: get().requestId + 1 });
    },
  };
});
