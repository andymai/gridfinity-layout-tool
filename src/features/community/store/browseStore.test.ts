import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ok, err } from '@/core/result';
import type { CommunityCard } from '@/shared/types/community';
import { fetchCommunityIndex } from '../api/client';
import type { FitsGapContext } from './browseStore';
import {
  BROWSE_INDEX_STALE_MS,
  GALLERY_PAGE_SIZE,
  INITIAL_BROWSE_FILTERS,
  INITIAL_BROWSE_STATE,
  filterAndSortCards,
  hasActiveBrowseFilters,
  hasDimensionConstraints,
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

  it('setMineOnly toggles the mine source switch and resets scroll and paging', () => {
    const store = useBrowseStore.getState();
    store.setScrollTop(300);
    store.showMore();
    store.setMineOnly(true);
    const state = useBrowseStore.getState();
    expect(state.filters.mineOnly).toBe(true);
    expect(state.scrollTop).toBe(0);
    expect(state.visibleCount).toBe(GALLERY_PAGE_SIZE);
    store.setMineOnly(false);
    expect(useBrowseStore.getState().filters.mineOnly).toBe(false);
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
    store.setMineOnly(true);
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

describe('removeItem', () => {
  it('drops only the unpublished card from the cached index', () => {
    useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: [card('a'), card('b')] });
    useBrowseStore.getState().removeItem('a');
    expect(useBrowseStore.getState().items.map((item) => item.id)).toEqual(['b']);
  });
});

describe('dimension filters and best-fit sort', () => {
  // Outer millimetres carry the 0.5mm fit tolerance, so ranks recover the
  // published grid footprint via roundToHalf: 62.5/42 -> 1.5, 24.5/7 -> 3.5.
  const dimItems: readonly CommunityCard[] = [
    card('small', {
      metrics: { width: 41.5, depth: 41.5, height: 21, gridUnitMm: 42 },
      createdAt: 3000,
    }),
    card('half', {
      metrics: { width: 62.5, depth: 83.5, height: 24.5, gridUnitMm: 42 },
      createdAt: 2000,
    }),
    card('large', {
      metrics: { width: 125.5, depth: 125.5, height: 42, gridUnitMm: 42 },
      createdAt: 1000,
      featured: true,
    }),
  ];

  function ids(
    filters: Partial<typeof INITIAL_BROWSE_FILTERS>,
    fitsGapContext: FitsGapContext | null = null
  ): string[] {
    return filterAndSortCards(
      dimItems,
      { ...INITIAL_BROWSE_FILTERS, ...filters },
      undefined,
      [],
      fitsGapContext
    ).map((item) => item.id);
  }

  it('widthMin is an inclusive half-grid lower bound', () => {
    expect(ids({ widthMin: 1.5 })).toEqual(['half', 'large']);
    expect(ids({ widthMin: 2 })).toEqual(['large']);
  });

  it('widthMax is an inclusive half-grid upper bound', () => {
    expect(ids({ widthMax: 1.5 })).toEqual(['small', 'half']);
    expect(ids({ widthMax: 1 })).toEqual(['small']);
  });

  it('an exact half-unit rank matches both of its own bounds', () => {
    expect(ids({ widthMin: 1.5, widthMax: 1.5 })).toEqual(['half']);
  });

  it('depth bounds are inclusive and half-grid aware', () => {
    expect(ids({ depthMin: 2 })).toEqual(['half', 'large']);
    expect(ids({ depthMax: 2 })).toEqual(['small', 'half']);
    expect(ids({ depthMin: 2, depthMax: 2 })).toEqual(['half']);
  });

  it('maxHeight is an inclusive upper bound in height units', () => {
    expect(ids({ maxHeight: 3.5 })).toEqual(['small', 'half']);
    expect(ids({ maxHeight: 3 })).toEqual(['small']);
    expect(ids({ maxHeight: 6 })).toEqual(['small', 'half', 'large']);
  });

  it('a min above the max yields zero matches', () => {
    expect(ids({ widthMin: 3, widthMax: 1 })).toEqual([]);
  });

  it('featuredOnly keeps only featured cards', () => {
    expect(ids({ featuredOnly: true })).toEqual(['large']);
  });

  it('fitsGapContext supplies implicit upper bounds when the toolbar is unset', () => {
    expect(
      ids(
        {},
        {
          widthMax: 1.5,
          depthMax: 2,
          maxHeight: null,
          gridUnitMm: 42,
          gridUnitMmY: 42,
          heightUnitMm: 7,
        }
      )
    ).toEqual(['small', 'half']);
    expect(
      ids(
        {},
        {
          widthMax: 3,
          depthMax: 3,
          maxHeight: 3.5,
          gridUnitMm: 42,
          gridUnitMmY: 42,
          heightUnitMm: 7,
        }
      )
    ).toEqual(['small', 'half']);
  });

  it('an explicit toolbar bound wins over the gap context', () => {
    expect(
      ids(
        { widthMax: 3, depthMax: 3 },
        {
          widthMax: 1,
          depthMax: 1,
          maxHeight: null,
          gridUnitMm: 42,
          gridUnitMmY: 42,
          heightUnitMm: 7,
        }
      )
    ).toEqual(['small', 'half', 'large']);
  });

  it('a gap context accepts either orientation, matching the placement probe', () => {
    const tall: readonly CommunityCard[] = [
      // 1x3 published footprint.
      card('one-by-three', {
        metrics: { width: 41.5, depth: 125.5, height: 21, gridUnitMm: 42 },
      }),
    ];
    const gapIds = filterAndSortCards(
      tall,
      INITIAL_BROWSE_FILTERS,
      undefined,
      [],
      // 3x1 gap: only the rotated orientation fits.
      {
        widthMax: 3,
        depthMax: 1,
        maxHeight: null,
        gridUnitMm: 42,
        gridUnitMmY: 42,
        heightUnitMm: 7,
      }
    ).map((item) => item.id);
    expect(gapIds).toEqual(['one-by-three']);
  });

  it('toolbar-only max bounds stay literal (no rotation)', () => {
    const tall: readonly CommunityCard[] = [
      card('one-by-three', {
        metrics: { width: 41.5, depth: 125.5, height: 21, gridUnitMm: 42 },
      }),
    ];
    const found = filterAndSortCards(tall, {
      ...INITIAL_BROWSE_FILTERS,
      widthMax: 3,
      depthMax: 1,
    }).map((item) => item.id);
    expect(found).toEqual([]);
  });

  it('a gap context rejects footprints that fit in neither orientation', () => {
    expect(
      ids(
        {},
        {
          widthMax: 1,
          depthMax: 1.5,
          maxHeight: null,
          gridUnitMm: 42,
          gridUnitMmY: 42,
          heightUnitMm: 7,
        }
      )
    ).toEqual(['small']);
  });

  it('best-fit orders by descending coverage of the constraint box', () => {
    expect(ids({ sort: 'best-fit', widthMax: 3, depthMax: 3 })).toEqual(['large', 'half', 'small']);
  });

  it('best-fit uses the gap context as the target box', () => {
    expect(
      ids(
        { sort: 'best-fit' },
        {
          widthMax: 2,
          depthMax: 3,
          maxHeight: null,
          gridUnitMm: 42,
          gridUnitMmY: 42,
          heightUnitMm: 7,
        }
      )
    ).toEqual(['half', 'small']);
  });

  it('best-fit without a target box falls back to raw footprint area', () => {
    expect(ids({ sort: 'best-fit', maxHeight: 6 })).toEqual(['large', 'half', 'small']);
  });

  it('best-fit breaks coverage ties by recency', () => {
    const tied: readonly CommunityCard[] = [
      card('older', {
        metrics: { width: 41.5, depth: 41.5, height: 21, gridUnitMm: 42 },
        createdAt: 1000,
      }),
      card('newer', {
        metrics: { width: 41.5, depth: 41.5, height: 21, gridUnitMm: 42 },
        createdAt: 2000,
      }),
    ];
    const found = filterAndSortCards(tied, {
      ...INITIAL_BROWSE_FILTERS,
      sort: 'best-fit',
      widthMax: 2,
      depthMax: 2,
    }).map((item) => item.id);
    expect(found).toEqual(['newer', 'older']);
  });
});

describe('dimension setters and fits-gap context', () => {
  it('dimension setters update filters and reset scroll and paging', () => {
    const store = useBrowseStore.getState();
    store.setScrollTop(300);
    store.showMore();
    store.setWidthMin(1.5);
    store.setWidthMax(3);
    store.setDepthMin(0.5);
    store.setDepthMax(2.5);
    store.setMaxHeight(6);
    const state = useBrowseStore.getState();
    expect(state.filters.widthMin).toBe(1.5);
    expect(state.filters.widthMax).toBe(3);
    expect(state.filters.depthMin).toBe(0.5);
    expect(state.filters.depthMax).toBe(2.5);
    expect(state.filters.maxHeight).toBe(6);
    expect(state.scrollTop).toBe(0);
    expect(state.visibleCount).toBe(GALLERY_PAGE_SIZE);
  });

  it('picking a min above the current max drags the max along', () => {
    const store = useBrowseStore.getState();
    store.setWidthMax(2);
    store.setWidthMin(4);
    expect(useBrowseStore.getState().filters.widthMin).toBe(4);
    expect(useBrowseStore.getState().filters.widthMax).toBe(4);
    store.setDepthMax(1);
    store.setDepthMin(3);
    expect(useBrowseStore.getState().filters.depthMin).toBe(3);
    expect(useBrowseStore.getState().filters.depthMax).toBe(3);
  });

  it('picking a max below the current min drags the min along', () => {
    const store = useBrowseStore.getState();
    store.setWidthMin(4);
    store.setWidthMax(2);
    expect(useBrowseStore.getState().filters.widthMin).toBe(2);
    expect(useBrowseStore.getState().filters.widthMax).toBe(2);
    store.setDepthMin(3);
    store.setDepthMax(1);
    expect(useBrowseStore.getState().filters.depthMin).toBe(1);
    expect(useBrowseStore.getState().filters.depthMax).toBe(1);
  });

  it('non-crossing dimension picks leave the opposing bound alone', () => {
    const store = useBrowseStore.getState();
    store.setWidthMax(4);
    store.setWidthMin(2);
    expect(useBrowseStore.getState().filters.widthMin).toBe(2);
    expect(useBrowseStore.getState().filters.widthMax).toBe(4);
    store.setWidthMin(null);
    expect(useBrowseStore.getState().filters.widthMin).toBeNull();
    expect(useBrowseStore.getState().filters.widthMax).toBe(4);
  });

  it('setFeaturedOnly updates the filter and resets scroll', () => {
    const store = useBrowseStore.getState();
    store.setScrollTop(300);
    store.setFeaturedOnly(true);
    const state = useBrowseStore.getState();
    expect(state.filters.featuredOnly).toBe(true);
    expect(state.scrollTop).toBe(0);
  });

  it('clearing the last dimension constraint drops best-fit back to newest', () => {
    const store = useBrowseStore.getState();
    store.setWidthMax(2);
    store.setSort('best-fit');
    store.setWidthMax(null);
    expect(useBrowseStore.getState().filters.sort).toBe('newest');
  });

  it('best-fit survives clearing one constraint while another remains', () => {
    const store = useBrowseStore.getState();
    store.setWidthMax(2);
    store.setMaxHeight(6);
    store.setSort('best-fit');
    store.setWidthMax(null);
    expect(useBrowseStore.getState().filters.sort).toBe('best-fit');
  });

  it('best-fit survives clearing dimensions while a gap context is set', () => {
    const store = useBrowseStore.getState();
    store.setFitsGapContext({
      widthMax: 2,
      depthMax: 3,
      maxHeight: null,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    store.setWidthMax(2);
    store.setSort('best-fit');
    store.setWidthMax(null);
    expect(useBrowseStore.getState().filters.sort).toBe('best-fit');
    useBrowseStore.getState().setFitsGapContext(null);
    expect(useBrowseStore.getState().filters.sort).toBe('newest');
  });

  it('clearFilters resets the new fields but keeps the gap context', () => {
    const store = useBrowseStore.getState();
    store.setFitsGapContext({
      widthMax: 2,
      depthMax: 3,
      maxHeight: 6,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    store.setFeaturedOnly(true);
    store.setWidthMin(1);
    store.setMaxHeight(3);
    store.clearFilters();
    const state = useBrowseStore.getState();
    expect(state.filters).toEqual(INITIAL_BROWSE_FILTERS);
    expect(state.fitsGapContext).toEqual({
      widthMax: 2,
      depthMax: 3,
      maxHeight: 6,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
  });
});

describe('filter state helpers', () => {
  it('hasDimensionConstraints is true when any of the five bounds is set', () => {
    expect(hasDimensionConstraints(INITIAL_BROWSE_FILTERS)).toBe(false);
    expect(hasDimensionConstraints({ ...INITIAL_BROWSE_FILTERS, widthMin: 1 })).toBe(true);
    expect(hasDimensionConstraints({ ...INITIAL_BROWSE_FILTERS, widthMax: 1 })).toBe(true);
    expect(hasDimensionConstraints({ ...INITIAL_BROWSE_FILTERS, depthMin: 1 })).toBe(true);
    expect(hasDimensionConstraints({ ...INITIAL_BROWSE_FILTERS, depthMax: 1 })).toBe(true);
    expect(hasDimensionConstraints({ ...INITIAL_BROWSE_FILTERS, maxHeight: 1 })).toBe(true);
  });

  it('hasActiveBrowseFilters covers every filter field', () => {
    expect(hasActiveBrowseFilters(INITIAL_BROWSE_FILTERS)).toBe(false);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, searchText: 'x' })).toBe(true);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, category: 'tools' })).toBe(true);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, technique: 'scoop' })).toBe(true);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, sort: 'likes' })).toBe(true);
    expect(
      hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, author: { id: 'a', name: 'A' } })
    ).toBe(true);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, likedOnly: true })).toBe(true);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, recentOnly: true })).toBe(true);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, featuredOnly: true })).toBe(true);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, mineOnly: true })).toBe(true);
    expect(hasActiveBrowseFilters({ ...INITIAL_BROWSE_FILTERS, depthMax: 2 })).toBe(true);
  });
});
