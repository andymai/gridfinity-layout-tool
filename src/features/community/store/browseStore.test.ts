import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ok, err } from '@/core/result';
import type { CommunityCard } from '@/shared/types/community';
import { fetchCommunityIndex } from '../api/client';
import {
  BROWSE_INDEX_STALE_MS,
  GALLERY_PAGE_SIZE,
  INITIAL_BROWSE_FILTERS,
  INITIAL_BROWSE_STATE,
  filterAndSortCards,
  isIndexStale,
  useBrowseStore,
} from './browseStore';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, fetchCommunityIndex: vi.fn() };
});

const indexMock = vi.mocked(fetchCommunityIndex);

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: `https://blob/${id}.webp`,
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

beforeEach(() => {
  indexMock.mockReset();
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ensureIndex', () => {
  it('loads the index and stores items, cap state, and fetch time', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('a'), card('b')], capped: true }));
    await useBrowseStore.getState().ensureIndex();
    const state = useBrowseStore.getState();
    expect(state.status).toBe('ready');
    expect(state.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(state.capped).toBe(true);
    expect(state.fetchedAt).not.toBeNull();
    expect(state.error).toBeNull();
  });

  it('does not refetch while the index is fresh', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    await useBrowseStore.getState().ensureIndex();
    await useBrowseStore.getState().ensureIndex();
    expect(indexMock).toHaveBeenCalledTimes(1);
  });

  it('refetches once the index is older than the staleness window', async () => {
    const start = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(start);
    indexMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    await useBrowseStore.getState().ensureIndex();
    nowSpy.mockReturnValue(start + BROWSE_INDEX_STALE_MS - 1);
    await useBrowseStore.getState().ensureIndex();
    expect(indexMock).toHaveBeenCalledTimes(1);
    nowSpy.mockReturnValue(start + BROWSE_INDEX_STALE_MS);
    await useBrowseStore.getState().ensureIndex();
    expect(indexMock).toHaveBeenCalledTimes(2);
  });

  it('does not start a second fetch while one is in flight', async () => {
    let resolveFetch: () => void = () => {};
    indexMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve(ok({ items: [card('a')], capped: false }));
        })
    );
    const first = useBrowseStore.getState().ensureIndex();
    const second = useBrowseStore.getState().ensureIndex();
    expect(useBrowseStore.getState().status).toBe('loading');
    resolveFetch();
    await Promise.all([first, second]);
    expect(indexMock).toHaveBeenCalledTimes(1);
    expect(useBrowseStore.getState().status).toBe('ready');
  });

  it('retries after a failed load without waiting out the staleness window', async () => {
    indexMock.mockResolvedValueOnce(err({ kind: 'network' }));
    await useBrowseStore.getState().ensureIndex();
    expect(useBrowseStore.getState().status).toBe('error');
    indexMock.mockResolvedValueOnce(ok({ items: [card('a')], capped: false }));
    await useBrowseStore.getState().ensureIndex();
    expect(useBrowseStore.getState().status).toBe('ready');
    expect(indexMock).toHaveBeenCalledTimes(2);
  });

  it('keeps previously loaded items when a refresh fails', async () => {
    indexMock.mockResolvedValueOnce(ok({ items: [card('a')], capped: false }));
    await useBrowseStore.getState().ensureIndex();
    indexMock.mockResolvedValueOnce(err({ kind: 'server' }));
    await useBrowseStore.getState().refreshIndex();
    const state = useBrowseStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toEqual({ kind: 'server' });
    expect(state.items.map((item) => item.id)).toEqual(['a']);
  });
});

describe('refreshIndex', () => {
  it('refetches even when the index is fresh', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    await useBrowseStore.getState().ensureIndex();
    await useBrowseStore.getState().refreshIndex();
    expect(indexMock).toHaveBeenCalledTimes(2);
  });
});

describe('reset', () => {
  it('discards an in-flight fetch that resolves after reset', async () => {
    let resolveFetch: () => void = () => {};
    indexMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve(ok({ items: [card('a')], capped: false }));
        })
    );
    const pending = useBrowseStore.getState().ensureIndex();
    useBrowseStore.getState().reset();
    resolveFetch();
    await pending;
    const state = useBrowseStore.getState();
    expect(state.status).toBe('idle');
    expect(state.items).toEqual([]);
  });
});

describe('filters', () => {
  it('filter setters update filters and reset the remembered scroll position', () => {
    const store = useBrowseStore.getState();
    store.setScrollTop(420);
    expect(useBrowseStore.getState().scrollTop).toBe(420);
    store.setSearchText('screw');
    let state = useBrowseStore.getState();
    expect(state.filters.searchText).toBe('screw');
    expect(state.scrollTop).toBe(0);

    store.setScrollTop(300);
    store.setCategory('kitchen');
    state = useBrowseStore.getState();
    expect(state.filters.category).toBe('kitchen');
    expect(state.scrollTop).toBe(0);

    store.setScrollTop(300);
    store.setTechnique('scoop');
    state = useBrowseStore.getState();
    expect(state.filters.technique).toBe('scoop');
    expect(state.scrollTop).toBe(0);

    store.setScrollTop(300);
    store.setSort('likes');
    state = useBrowseStore.getState();
    expect(state.filters.sort).toBe('likes');
    expect(state.scrollTop).toBe(0);
  });

  it('author/liked/recent setters update filters and reset the remembered scroll position', () => {
    const store = useBrowseStore.getState();
    store.setScrollTop(300);
    store.setAuthor({ id: 'f'.repeat(32), name: 'Alice' });
    let state = useBrowseStore.getState();
    expect(state.filters.author).toEqual({ id: 'f'.repeat(32), name: 'Alice' });
    expect(state.scrollTop).toBe(0);

    store.setScrollTop(300);
    store.setLikedOnly(true);
    state = useBrowseStore.getState();
    expect(state.filters.likedOnly).toBe(true);
    expect(state.scrollTop).toBe(0);

    store.setScrollTop(300);
    store.setRecentOnly(true);
    state = useBrowseStore.getState();
    expect(state.filters.recentOnly).toBe(true);
    expect(state.scrollTop).toBe(0);
  });

  it('setAuthor(null) clears the author view', () => {
    const store = useBrowseStore.getState();
    store.setAuthor({ id: 'f'.repeat(32), name: 'Alice' });
    store.setAuthor(null);
    expect(useBrowseStore.getState().filters.author).toBeNull();
  });

  it('clearFilters restores the defaults', () => {
    const store = useBrowseStore.getState();
    store.setSearchText('screw');
    store.setCategory('kitchen');
    store.setTechnique('scoop');
    store.setSort('remixes');
    store.setAuthor({ id: 'f'.repeat(32), name: 'Alice' });
    store.setLikedOnly(true);
    store.setRecentOnly(true);
    store.clearFilters();
    expect(useBrowseStore.getState().filters).toEqual(INITIAL_BROWSE_FILTERS);
  });

  it('setScrollTop remembers the gallery scroll offset', () => {
    useBrowseStore.getState().setScrollTop(1234);
    expect(useBrowseStore.getState().scrollTop).toBe(1234);
  });

  it('showMore deepens paging and survives remounts; filter changes collapse it', () => {
    const store = useBrowseStore.getState();
    store.showMore();
    store.showMore();
    expect(useBrowseStore.getState().visibleCount).toBe(GALLERY_PAGE_SIZE * 3);

    store.setSearchText('screw');
    expect(useBrowseStore.getState().visibleCount).toBe(GALLERY_PAGE_SIZE);

    store.showMore();
    store.clearFilters();
    expect(useBrowseStore.getState().visibleCount).toBe(GALLERY_PAGE_SIZE);
  });
});

describe('filterAndSortCards', () => {
  const ALICE = 'a'.repeat(32);
  const BOB = 'b'.repeat(32);

  const items: readonly CommunityCard[] = [
    card('screws', {
      name: 'Screw Sorter',
      authorName: 'Alice',
      authorPublicId: ALICE,
      category: 'hardware',
      techniques: ['compartments', 'labelTab'],
      counts: { likes: 5, remixes: 1, exports: 0 },
      createdAt: 3000,
    }),
    card('spice', {
      name: 'Spice Rack',
      authorName: 'Bob',
      authorPublicId: BOB,
      category: 'kitchen',
      techniques: ['slotted'],
      counts: { likes: 9, remixes: 4, exports: 2 },
      createdAt: 2000,
      likedByMe: true,
    }),
    card('pens', {
      name: 'Pen Tray',
      authorName: 'Alice',
      authorPublicId: ALICE,
      category: 'office',
      techniques: ['scoop'],
      counts: { likes: 9, remixes: 4, exports: 1 },
      createdAt: 1000,
      likedByMe: true,
    }),
  ];

  function ids(
    filters: Partial<typeof INITIAL_BROWSE_FILTERS>,
    recentIds: readonly string[] = []
  ): string[] {
    return filterAndSortCards(
      items,
      { ...INITIAL_BROWSE_FILTERS, ...filters },
      undefined,
      recentIds
    ).map((item) => item.id);
  }

  it('sorts by newest by default', () => {
    expect(ids({})).toEqual(['screws', 'spice', 'pens']);
  });

  it('searches names case-insensitively', () => {
    expect(ids({ searchText: 'SCREW' })).toEqual(['screws']);
  });

  it('searches author names', () => {
    expect(ids({ searchText: 'alice' })).toEqual(['screws', 'pens']);
  });

  it('requires every search term to match across name and author', () => {
    expect(ids({ searchText: 'alice pen' })).toEqual(['pens']);
    expect(ids({ searchText: 'alice rack' })).toEqual([]);
  });

  it('ignores surrounding whitespace in the search text', () => {
    expect(ids({ searchText: '  spice  ' })).toEqual(['spice']);
  });

  it('matches caller-supplied label haystacks (translated category/technique words)', () => {
    const labels = (item: CommunityCard): string =>
      item.category === 'kitchen' ? 'Kitchen Slotted walls' : item.category;
    const found = filterAndSortCards(
      items,
      { ...INITIAL_BROWSE_FILTERS, searchText: 'slotted' },
      labels
    ).map((item) => item.id);
    expect(found).toEqual(['spice']);
    expect(ids({ searchText: 'slotted' })).toEqual([]);
  });

  it('filters by category', () => {
    expect(ids({ category: 'kitchen' })).toEqual(['spice']);
  });

  it('filters by technique membership', () => {
    expect(ids({ technique: 'labelTab' })).toEqual(['screws']);
  });

  it('combines search and filters', () => {
    expect(ids({ searchText: 'alice', category: 'office' })).toEqual(['pens']);
  });

  it('sorts by likes with newest breaking ties', () => {
    expect(ids({ sort: 'likes' })).toEqual(['spice', 'pens', 'screws']);
  });

  it('sorts by remixes with newest breaking ties', () => {
    expect(ids({ sort: 'remixes' })).toEqual(['spice', 'pens', 'screws']);
  });

  it('filters to a single author by public id', () => {
    expect(ids({ author: { id: ALICE, name: 'Alice' } })).toEqual(['screws', 'pens']);
    expect(ids({ author: { id: BOB, name: 'Bob' } })).toEqual(['spice']);
  });

  it('yields nothing for an author with no cards in the index', () => {
    expect(ids({ author: { id: 'c'.repeat(32), name: '' } })).toEqual([]);
  });

  it('author combines with category, search, and likedOnly', () => {
    expect(ids({ author: { id: ALICE, name: 'Alice' }, category: 'office' })).toEqual(['pens']);
    expect(ids({ author: { id: ALICE, name: 'Alice' }, searchText: 'screw' })).toEqual(['screws']);
    expect(ids({ author: { id: ALICE, name: 'Alice' }, likedOnly: true })).toEqual(['pens']);
  });

  it('likedOnly keeps only cards liked by the session user', () => {
    expect(ids({ likedOnly: true })).toEqual(['spice', 'pens']);
  });

  it('likedOnly treats an absent likedByMe as not liked', () => {
    const anonymous = items.map(({ likedByMe: _likedByMe, ...rest }) => rest as CommunityCard);
    const found = filterAndSortCards(anonymous, {
      ...INITIAL_BROWSE_FILTERS,
      likedOnly: true,
    });
    expect(found).toEqual([]);
  });

  it('recentOnly filters to the recorded list and orders most-recent-first', () => {
    expect(ids({ recentOnly: true }, ['pens', 'screws'])).toEqual(['pens', 'screws']);
  });

  it('recentOnly ignores recorded ids missing from the index', () => {
    expect(ids({ recentOnly: true }, ['gone-design', 'spice'])).toEqual(['spice']);
  });

  it('recentOnly with nothing recorded yields nothing', () => {
    expect(ids({ recentOnly: true })).toEqual([]);
  });

  it('recency order overrides the sort control while recentOnly is active', () => {
    expect(ids({ recentOnly: true, sort: 'likes' }, ['screws', 'pens', 'spice'])).toEqual([
      'screws',
      'pens',
      'spice',
    ]);
  });

  it('recentOnly combines with the other filters', () => {
    expect(
      ids({ recentOnly: true, author: { id: ALICE, name: 'Alice' } }, ['spice', 'pens', 'screws'])
    ).toEqual(['pens', 'screws']);
    expect(ids({ recentOnly: true, likedOnly: true }, ['screws', 'pens'])).toEqual(['pens']);
  });
});

describe('isIndexStale', () => {
  it('treats a never-fetched index as stale', () => {
    expect(isIndexStale(null, 1000)).toBe(true);
  });

  it('flips exactly at the staleness window', () => {
    expect(isIndexStale(1000, 1000 + BROWSE_INDEX_STALE_MS - 1)).toBe(false);
    expect(isIndexStale(1000, 1000 + BROWSE_INDEX_STALE_MS)).toBe(true);
  });
});

describe('patchCardLike', () => {
  beforeEach(() => {
    useBrowseStore.setState({
      ...INITIAL_BROWSE_STATE,
      items: [card('a', { counts: { likes: 5, remixes: 1, exports: 2 } }), card('b')],
    });
  });

  it('patches likedByMe and merges likes into counts on the target card only', () => {
    useBrowseStore.getState().patchCardLike('a', { likedByMe: true, likes: 6 });
    const [a, b] = useBrowseStore.getState().items;
    expect(a.likedByMe).toBe(true);
    expect(a.counts).toEqual({ likes: 6, remixes: 1, exports: 2 });
    expect(b.likedByMe).toBeUndefined();
    expect(b.counts.likes).toBe(0);
  });

  it('leaves fields absent from the patch untouched (rollback shape)', () => {
    useBrowseStore.getState().patchCardLike('a', { likedByMe: true, likes: 6 });
    useBrowseStore.getState().patchCardLike('a', { likedByMe: false, likes: 5 });
    const [a] = useBrowseStore.getState().items;
    expect(a.likedByMe).toBe(false);
    expect(a.counts).toEqual({ likes: 5, remixes: 1, exports: 2 });
  });

  it('no-ops for an id not present in the index', () => {
    const before = useBrowseStore.getState().items;
    useBrowseStore.getState().patchCardLike('missing', { likedByMe: true, likes: 1 });
    expect(useBrowseStore.getState().items).toEqual(before);
  });
});
