import { COMMUNITY_INDEX_SORTS } from '@/shared/types/community';
import { describe, it, expect } from 'vitest';
import type { TFunction } from '@/i18n';
import { INITIAL_BROWSE_FILTERS } from '../../store/browseStore';
import { browseSortOptions, countPanelFilters, isBrowseSort } from './galleryFilterOptions';

const t: TFunction = (key: string) => key;

describe('browseSortOptions', () => {
  it('appends best-fit only while available', () => {
    expect(browseSortOptions(t, false).map((option) => option.id)).toEqual([
      ...COMMUNITY_INDEX_SORTS,
    ]);
    expect(browseSortOptions(t, true).map((option) => option.id)).toEqual([
      ...COMMUNITY_INDEX_SORTS,
      'best-fit',
    ]);
  });
});

describe('isBrowseSort', () => {
  it('accepts the server sorts and the client-only best-fit', () => {
    expect(isBrowseSort('newest')).toBe(true);
    expect(isBrowseSort('remixes')).toBe(true);
    expect(isBrowseSort('likes')).toBe(true);
    expect(isBrowseSort('best-fit')).toBe(true);
    expect(isBrowseSort('featured')).toBe(false);
  });
});

describe('countPanelFilters', () => {
  it('counts nothing for the initial filters', () => {
    expect(countPanelFilters(INITIAL_BROWSE_FILTERS)).toBe(0);
  });

  it('counts every size bound as the single size decision it reads as', () => {
    expect(
      countPanelFilters({
        ...INITIAL_BROWSE_FILTERS,
        widthMin: 1,
        widthMax: 3,
        depthMax: 2,
        maxHeight: 6,
      })
    ).toBe(1);
  });

  it('counts each facet and show toggle once', () => {
    expect(
      countPanelFilters({
        ...INITIAL_BROWSE_FILTERS,
        category: 'kitchen',
        technique: 'labelTab',
        widthMin: 2,
        likedOnly: true,
        recentOnly: true,
        featuredOnly: true,
        mineOnly: true,
      })
    ).toBe(7);
  });

  it('leaves search, sort and the author view out of the panel count', () => {
    expect(
      countPanelFilters({
        ...INITIAL_BROWSE_FILTERS,
        searchText: 'box',
        sort: 'likes',
        author: { id: 'a'.repeat(32), name: 'Andy' },
      })
    ).toBe(0);
  });
});
