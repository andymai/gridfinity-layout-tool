import { describe, it, expect } from 'vitest';
import type { TFunction } from '@/i18n';
import type { CommunityCard } from '@/shared/types/community';
import {
  browseSortOptions,
  cardDepthRank,
  cardHeightRank,
  cardWidthRank,
  dimensionOptions,
  isBrowseSort,
  parseDimensionRank,
} from './galleryFilterOptions';

const t: TFunction = (key: string) => key;

function card(id: string, metrics: CommunityCard['metrics']): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics,
    thumbnailUrl: '',
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
  };
}

describe('dimensionOptions', () => {
  const items = [
    card('a', { width: 83.5, depth: 41.5, height: 21, gridUnitMm: 42 }),
    card('b', { width: 62.5, depth: 41.5, height: 24.5, gridUnitMm: 42 }),
    card('c', { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 }),
  ];

  it('dedupes and sorts ranks ascending behind the Any sentinel', () => {
    expect(dimensionOptions(t, items, cardWidthRank)).toEqual([
      { id: '', name: 'community.gallery.dimensionAny' },
      { id: '1.5', name: '1.5' },
      { id: '2', name: '2' },
    ]);
  });

  it('derives depth and height ranks with half-step formatting', () => {
    expect(dimensionOptions(t, items, cardDepthRank).map((option) => option.id)).toEqual([
      '',
      '1',
      '3',
    ]);
    expect(dimensionOptions(t, items, cardHeightRank).map((option) => option.name)).toEqual([
      'community.gallery.dimensionAny',
      '3',
      '3.5',
      '6',
    ]);
  });

  it('collapses to the sentinel alone for an empty index', () => {
    expect(dimensionOptions(t, [], cardWidthRank)).toEqual([
      { id: '', name: 'community.gallery.dimensionAny' },
    ]);
  });
});

describe('parseDimensionRank', () => {
  it('maps the sentinel to null and numeric ids to numbers', () => {
    expect(parseDimensionRank('')).toBeNull();
    expect(parseDimensionRank('2')).toBe(2);
    expect(parseDimensionRank('1.5')).toBe(1.5);
  });

  it('rejects a non-numeric value as null', () => {
    expect(parseDimensionRank('bogus')).toBeNull();
  });
});

describe('browseSortOptions', () => {
  it('appends best-fit only while available', () => {
    expect(browseSortOptions(t, false).map((option) => option.id)).toEqual([
      'newest',
      'remixes',
      'likes',
    ]);
    expect(browseSortOptions(t, true).map((option) => option.id)).toEqual([
      'newest',
      'remixes',
      'likes',
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
