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

export interface BrowseFilters {
  readonly searchText: string;
  readonly category: CommunityCategory | null;
  readonly technique: ExampleTechnique | null;
  readonly sort: CommunityIndexSort;
  readonly author: BrowseAuthorFilter | null;
  readonly likedOnly: boolean;
  readonly recentOnly: boolean;
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
  mineOnly: false,
};

interface BrowseState {
  status: BrowseLoadStatus;
  items: readonly CommunityCard[];
  /** True when the fetched index was truncated to the newest `COMMUNITY_INDEX_CAP` designs. */
  capped: boolean;
  error: CommunityClientError | null;
  fetchedAt: number | null;
  filters: BrowseFilters;
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
  setSort: (sort: CommunityIndexSort) => void;
  setAuthor: (author: BrowseAuthorFilter | null) => void;
  setLikedOnly: (likedOnly: boolean) => void;
  setRecentOnly: (recentOnly: boolean) => void;
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

// Mirrors the server's compareCards tie-breaking (api/community.ts): count
// sorts fall back to recency on ties, so local re-sorts match server order.
function compareCards(a: CommunityCard, b: CommunityCard, sort: CommunityIndexSort): number {
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
  recentIds: readonly string[] = []
): CommunityCard[] {
  const recentRank = filters.recentOnly ? new Map(recentIds.map((id, index) => [id, index])) : null;
  const matched = items.filter(
    (card) =>
      (filters.category === null || card.category === filters.category) &&
      (filters.technique === null || card.techniques.includes(filters.technique)) &&
      (filters.author === null || card.authorPublicId === filters.author.id) &&
      (!filters.likedOnly || card.likedByMe === true) &&
      (recentRank === null || recentRank.has(card.id)) &&
      matchesSearch(card, filters.searchText, searchLabels?.(card) ?? '')
  );
  if (recentRank !== null) {
    // Most-recent-first is the point of the recently-viewed chip, so it
    // overrides the sort control while active.
    return matched.sort((a, b) => (recentRank.get(a.id) ?? 0) - (recentRank.get(b.id) ?? 0));
  }
  return matched.sort((a, b) => compareCards(a, b, filters.sort));
}

export function isIndexStale(fetchedAt: number | null, now: number): boolean {
  return fetchedAt === null || now - fetchedAt >= BROWSE_INDEX_STALE_MS;
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
