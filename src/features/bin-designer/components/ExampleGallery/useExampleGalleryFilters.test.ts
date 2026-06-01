import { describe, it, expect } from 'vitest';
import { filterAndSortExamples } from './useExampleGalleryFilters';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';

describe('filterAndSortExamples', () => {
  it('returns all when no filters', () => {
    const out = filterAndSortExamples(EXAMPLE_DESIGNS, {
      search: '',
      technique: null,
      sort: 'recommended',
      favoritesOnly: false,
      favoriteIds: [],
    });
    expect(out.length).toBe(EXAMPLE_DESIGNS.length);
  });

  it('filters by technique', () => {
    const out = filterAndSortExamples(EXAMPLE_DESIGNS, {
      search: '',
      technique: 'compartments',
      sort: 'recommended',
      favoritesOnly: false,
      favoriteIds: [],
    });
    expect(out.every((e) => e.techniques.includes('compartments'))).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it('filters favoritesOnly', () => {
    const fav = EXAMPLE_DESIGNS[0].id;
    const out = filterAndSortExamples(EXAMPLE_DESIGNS, {
      search: '',
      technique: null,
      sort: 'recommended',
      favoritesOnly: true,
      favoriteIds: [fav],
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(fav);
  });

  it('search matches tags/id case-insensitively', () => {
    const tag = EXAMPLE_DESIGNS[0].tags[0];
    const out = filterAndSortExamples(EXAMPLE_DESIGNS, {
      search: tag.toUpperCase(),
      technique: null,
      sort: 'recommended',
      favoritesOnly: false,
      favoriteIds: [],
    });
    expect(out.length).toBeGreaterThan(0);
  });

  it('sorts by size ascending (footprint area)', () => {
    const out = filterAndSortExamples(EXAMPLE_DESIGNS, {
      search: '',
      technique: null,
      sort: 'size',
      favoritesOnly: false,
      favoriteIds: [],
    });
    for (let i = 1; i < out.length; i++) {
      expect(out[i].params.width * out[i].params.depth).toBeGreaterThanOrEqual(
        out[i - 1].params.width * out[i - 1].params.depth
      );
    }
  });

  it('does not mutate the input array', () => {
    const before = [...EXAMPLE_DESIGNS];
    filterAndSortExamples(EXAMPLE_DESIGNS, {
      search: '',
      technique: null,
      sort: 'size',
      favoritesOnly: false,
      favoriteIds: [],
    });
    expect(EXAMPLE_DESIGNS).toEqual(before);
  });
});
