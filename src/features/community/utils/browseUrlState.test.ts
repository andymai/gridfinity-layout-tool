import { describe, it, expect } from 'vitest';
import { INITIAL_BROWSE_FILTERS } from '../store/browseStore';
import type { BrowseFilters } from '../store/browseStore';
import { decodeBrowseParams, encodeBrowseParams } from './browseUrlState';

const AUTHOR_ID = 'a'.repeat(32);

function filters(overrides: Partial<BrowseFilters> = {}): BrowseFilters {
  return { ...INITIAL_BROWSE_FILTERS, ...overrides };
}

function encode(overrides: Partial<BrowseFilters> = {}): string {
  return encodeBrowseParams(filters(overrides)).toString();
}

function decode(query: string) {
  return decodeBrowseParams(new URLSearchParams(query));
}

describe('encodeBrowseParams', () => {
  it('emits nothing for an unfiltered gallery', () => {
    // The common URL is /community with no query at all.
    expect(encode()).toBe('');
  });

  it('omits each filter that is at its default', () => {
    expect(encode({ category: 'tools' })).toBe('cat=tools');
    expect(encode({ sort: 'newest' })).toBe('');
    expect(encode({ likedOnly: false })).toBe('');
  });

  it('writes flags as presence rather than a value pair', () => {
    expect(encode({ likedOnly: true, featuredOnly: true })).toBe('liked=1&featured=1');
  });

  it('writes one-sided and two-sided ranges', () => {
    expect(encode({ widthMin: 2, widthMax: 4 })).toBe('w=2-4');
    expect(encode({ widthMin: 2 })).toBe('w=2-');
    expect(encode({ widthMax: 4 })).toBe('w=-4');
    expect(encode({ depthMin: 1.5, depthMax: 3 })).toBe('d=1.5-3');
    expect(encode({ maxHeight: 6 })).toBe('h=6');
  });

  it('carries the author id', () => {
    expect(encode({ author: { id: AUTHOR_ID, name: 'ada' } })).toBe(`author=${AUTHOR_ID}`);
  });

  it('trims search text and never carries the whitespace-only case', () => {
    expect(encode({ searchText: '  hex  ' })).toBe('q=hex');
    expect(encode({ searchText: '   ' })).toBe('');
  });

  it('caps search text rather than emitting an unusable URL', () => {
    const long = 'x'.repeat(400);
    const value = new URLSearchParams(encode({ searchText: long })).get('q');
    expect(value).toHaveLength(100);
  });

  it('never carries best-fit', () => {
    // It falls back to newest the moment no dimension constraint remains, and
    // the constraint it depends on is the sender's gap, which does not travel.
    expect(encode({ sort: 'best-fit' })).toBe('');
  });

  it('never carries mineOnly', () => {
    // Resolved per account: a shared link would show the recipient their own
    // designs instead of the sender's view.
    expect(encode({ mineOnly: true })).toBe('');
  });
});

describe('decodeBrowseParams', () => {
  it('round-trips a fully narrowed view', () => {
    const original = filters({
      searchText: 'hex',
      category: 'tools',
      technique: 'labelTab',
      sort: 'prints',
      widthMin: 2,
      widthMax: 4,
      depthMin: 1.5,
      maxHeight: 6,
      likedOnly: true,
      recentOnly: true,
      featuredOnly: true,
      author: { id: AUTHOR_ID, name: 'ada' },
    });
    const decoded = decodeBrowseParams(encodeBrowseParams(original));
    expect({ ...original, ...decoded }).toEqual({
      ...original,
      // The name is not in the URL to carry; it resolves from the index.
      author: { id: AUTHOR_ID, name: '' },
    });
  });

  it('resets an absent parameter to its default rather than leaving it', () => {
    // Otherwise navigating back to an unfiltered view would keep the filters
    // the store happened to be holding.
    const decoded = decode('');
    expect(decoded.category).toBeNull();
    expect(decoded.searchText).toBe('');
    expect(decoded.sort).toBe('newest');
    expect(decoded.likedOnly).toBe(false);
    expect(decoded.widthMin).toBeNull();
    expect(decoded.author).toBeNull();
  });

  it('leaves mineOnly and the gap context untouched', () => {
    // Absent from the patch entirely, so applying it cannot clear the
    // viewer's own account state.
    const decoded = decode('cat=tools&liked=1');
    expect(decoded).not.toHaveProperty('mineOnly');
    expect(decoded).not.toHaveProperty('fitsGapContext');
  });

  it.each([
    ['cat=nonsense', 'category'],
    ['tech=nonsense', 'technique'],
    ['sort=nonsense', 'sort'],
    [`author=${'z'.repeat(32)}`, 'author'],
    ['author=tooshort', 'author'],
  ])('drops the unrecognised value in %s', (query, key) => {
    // These strings are user-editable and outlive deploys: a retired category
    // must cost that one parameter, not the view.
    const decoded = decode(query) as Record<string, unknown>;
    expect(decoded[key]).toEqual(INITIAL_BROWSE_FILTERS[key as keyof BrowseFilters] ?? null);
  });

  it('never accepts best-fit from a URL', () => {
    expect(decode('sort=best-fit').sort).toBe('newest');
  });

  it.each(['w=banana', 'w=4-2', 'w=abc-2', 'w=2-abc', 'w=1-2-3', 'w=-', 'w=0-4', 'w=1.3-4'])(
    'drops the malformed range %s whole',
    (query) => {
      // Half of a crossed or unparseable range is worse than none: it renders
      // a slider whose thumbs have swapped.
      const decoded = decode(query);
      expect(decoded.widthMin).toBeNull();
      expect(decoded.widthMax).toBeNull();
    }
  );

  it('accepts half-grid steps but not finer', () => {
    expect(decode('w=1.5-2.5').widthMin).toBe(1.5);
    expect(decode('h=2.5').maxHeight).toBe(2.5);
    expect(decode('h=2.25').maxHeight).toBeNull();
  });

  it('treats any flag value as present', () => {
    expect(decode('liked=1').likedOnly).toBe(true);
    expect(decode('liked=0').likedOnly).toBe(true);
    expect(decode('liked=').likedOnly).toBe(true);
    expect(decode('').likedOnly).toBe(false);
  });

  it('keeps the rest of the view when one parameter is junk', () => {
    const decoded = decode('cat=nonsense&tech=scoop&q=hex&liked=1');
    expect(decoded.category).toBeNull();
    expect(decoded.technique).toBe('scoop');
    expect(decoded.searchText).toBe('hex');
    expect(decoded.likedOnly).toBe(true);
  });
});
