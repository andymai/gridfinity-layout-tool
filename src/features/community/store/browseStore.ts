import { INITIAL_BROWSE_FILTERS, withBestFitFallback, sameBrowseFilters } from './browseFilters';
import type {
  BrowseAuthorFilter,
  BrowseSort,
  FitsGapContext,
  BrowseFilters,
} from './browseFilters';
export {
  INITIAL_BROWSE_FILTERS,
  hasDimensionConstraints,
  hasActiveBrowseFilters,
  createCardMatcher,
  filterAndSortCards,
  sameBrowseFilters,
} from './browseFilters';
export type {
  BrowseAuthorFilter,
  BrowseSort,
  FitsGapContext,
  BrowseFilters,
} from './browseFilters';
import { create } from 'zustand';
import { isOk } from '@/core/result';
import type { CommunityCard, CommunityCategory } from '@/shared/types/community';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import type { CommunityClientError } from '../api/client';
import { fetchCommunityIndex } from '../api/client';

export const BROWSE_INDEX_STALE_MS = 5 * 60 * 1000;

export const GALLERY_PAGE_SIZE = 24;

export type BrowseLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

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
  /** Both bounds in one write: a range slider drag moves them together. */
  setWidthRange: (widthMin: number | null, widthMax: number | null) => void;
  setDepthRange: (depthMin: number | null, depthMax: number | null) => void;
  clearDimensionFilters: () => void;
  setFitsGapContext: (fitsGapContext: FitsGapContext | null) => void;
  setMineOnly: (mineOnly: boolean) => void;
  /**
   * Applies the filters carried by the URL in one write. A patch rather than a
   * whole `BrowseFilters` because the URL deliberately does not carry
   * `mineOnly` or the gap context, and a shared link must not clear the
   * viewer's own account state or a gap handed over by the layout editor.
   */
  applyUrlFilters: (patch: Partial<BrowseFilters>) => void;
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

export function isIndexStale(fetchedAt: number | null, now: number): boolean {
  return fetchedAt === null || now - fetchedAt >= BROWSE_INDEX_STALE_MS;
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
    setWidthRange: (widthMin, widthMax) => {
      set((state) => withDimensionPatch(state, { widthMin, widthMax }));
    },
    setDepthRange: (depthMin, depthMax) => {
      set((state) => withDimensionPatch(state, { depthMin, depthMax }));
    },
    clearDimensionFilters: () => {
      set((state) =>
        withDimensionPatch(state, {
          widthMin: null,
          widthMax: null,
          depthMin: null,
          depthMax: null,
          maxHeight: null,
        })
      );
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
    applyUrlFilters: (patch) => {
      set((state) => {
        const next = withDimensionPatch(state, patch);
        // A no-op re-apply must stay a no-op. Returning from a detail replays
        // the same query, and withDimensionPatch zeroes scrollTop and
        // visibleCount, so without this Back lands at the top of a gallery
        // that has forgotten every Load more.
        return sameBrowseFilters(state.filters, next.filters) ? {} : next;
      });
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
