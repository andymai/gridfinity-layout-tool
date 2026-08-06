import { describe, expect, it } from 'vitest';
import type { CommunityCard } from '@/shared/types/community';
import { INITIAL_BROWSE_FILTERS, filterAndSortCards } from '../../store/browseStore';
import type { BrowseFilters } from '../../store/browseStore';
import { computeFacetCounts, dimensionStops } from './facetCounts';
import { cardWidthRank } from './galleryFilterOptions';

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    // 2 x 3 grid units, 6 height units.
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

function sized(id: string, widthUnits: number, overrides: Partial<CommunityCard> = {}) {
  return card(id, {
    metrics: { width: widthUnits * 42, depth: 42, height: 42, gridUnitMm: 42 },
    ...overrides,
  });
}

function counts(items: readonly CommunityCard[], filters: Partial<BrowseFilters> = {}) {
  return computeFacetCounts({
    items,
    filters: { ...INITIAL_BROWSE_FILTERS, ...filters },
    recentIds: [],
    fitsGapContext: null,
  });
}

describe('computeFacetCounts', () => {
  it('counts every category under the other active filters', () => {
    const result = counts([
      card('a', { category: 'hardware' }),
      card('b', { category: 'hardware' }),
      card('c', { category: 'kitchen' }),
    ]);
    expect(result.categories.get('hardware')).toBe(2);
    expect(result.categories.get('kitchen')).toBe(1);
    expect(result.total).toBe(3);
  });

  it('reports zero for a category with nothing left under the other filters', () => {
    const result = counts([card('a', { category: 'hardware', techniques: ['scoop'] })], {
      technique: 'labelTab',
    });
    expect(result.categories.get('hardware')).toBe(0);
  });

  it('counts the All option on the facet-neutral total, not the narrowed one', () => {
    const items = [card('a', { category: 'hardware' }), card('b', { category: 'kitchen' })];
    const result = counts(items, { category: 'hardware' });
    // Picking All would restore both cards; total is what the grid shows now.
    expect(result.categoryAll).toBe(2);
    expect(result.total).toBe(1);
  });

  it('counts the All technique pill on the technique-neutral total', () => {
    const items = [card('a', { techniques: ['labelTab'] }), card('b', { techniques: ['scoop'] })];
    const result = counts(items, { technique: 'labelTab' });
    expect(result.techniqueAll).toBe(2);
    expect(result.total).toBe(1);
  });

  it('keeps the All counts narrowed by every other facet', () => {
    const items = [
      card('a', { category: 'hardware', techniques: ['labelTab'] }),
      card('b', { category: 'kitchen', techniques: ['scoop'] }),
    ];
    const result = counts(items, { category: 'hardware', technique: 'labelTab' });
    // Clearing the category still leaves the technique filter in force.
    expect(result.categoryAll).toBe(1);
  });

  it('keeps the other categories countable while one is selected', () => {
    const items = [card('a', { category: 'hardware' }), card('b', { category: 'kitchen' })];
    const result = counts(items, { category: 'hardware' });
    expect(result.categories.get('hardware')).toBe(1);
    expect(result.categories.get('kitchen')).toBe(1);
    // The grid itself is narrowed even though the facet is not.
    expect(result.total).toBe(1);
  });

  it('counts a card once per technique it carries', () => {
    const result = counts([
      card('a', { techniques: ['labelTab', 'scoop'] }),
      card('b', { techniques: ['labelTab'] }),
    ]);
    expect(result.techniques.get('labelTab')).toBe(2);
    expect(result.techniques.get('scoop')).toBe(1);
  });

  it('counts the show toggles as if each were switched on', () => {
    const items = [
      card('a', { likedByMe: true }),
      card('b', { featured: true }),
      card('c', { likedByMe: true, featured: true }),
    ];
    const result = computeFacetCounts({
      items,
      filters: INITIAL_BROWSE_FILTERS,
      recentIds: ['b'],
      fitsGapContext: null,
    });
    expect(result.liked).toBe(2);
    expect(result.featured).toBe(2);
    expect(result.recent).toBe(1);
  });

  it('reports the reachable window on each axis', () => {
    const result = counts([sized('a', 1), sized('b', 3), sized('c', 5)]);
    expect(result.width).toEqual({ min: 1, max: 5 });
  });

  it('narrows one axis window by the bounds still active on the others', () => {
    const items = [
      card('wide-tall', {
        metrics: { width: 5 * 42, depth: 42, height: 8 * 7, gridUnitMm: 42 },
      }),
      card('narrow-short', {
        metrics: { width: 2 * 42, depth: 42, height: 2 * 7, gridUnitMm: 42 },
      }),
    ];
    const result = counts(items, { maxHeight: 3 });
    // Only the short card survives the height bound, so widths above 2 are
    // unreachable while that bound holds.
    expect(result.width).toEqual({ min: 2, max: 2 });
  });

  it('ignores the axis being measured when computing its own window', () => {
    const result = counts([sized('a', 1), sized('b', 3), sized('c', 5)], {
      widthMin: 3,
      widthMax: 3,
    });
    expect(result.width).toEqual({ min: 1, max: 5 });
    expect(result.total).toBe(1);
  });

  it('returns a null window when nothing matches', () => {
    const result = counts([sized('a', 1)], { searchText: 'nothing-matches-this' });
    expect(result.width).toBeNull();
    expect(result.total).toBe(0);
  });

  it('agrees with the grid on the result count', () => {
    const items = [
      card('a', { category: 'hardware', techniques: ['labelTab'] }),
      card('b', { category: 'kitchen', techniques: ['labelTab'] }),
      card('c', { category: 'hardware', techniques: ['scoop'] }),
    ];
    const filters: BrowseFilters = {
      ...INITIAL_BROWSE_FILTERS,
      category: 'hardware',
      technique: 'labelTab',
    };
    expect(counts(items, filters).total).toBe(filterAndSortCards(items, filters).length);
  });
});

describe('dimensionStops', () => {
  it('lists each distinct value once, ascending', () => {
    const stops = dimensionStops(
      [sized('a', 3), sized('b', 1), sized('c', 3), sized('d', 2)],
      cardWidthRank
    );
    expect(stops).toEqual([1, 2, 3]);
  });

  it('is empty for an empty index', () => {
    expect(dimensionStops([], cardWidthRank)).toEqual([]);
  });
});
