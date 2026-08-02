// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RECENTLY_VIEWED_CAP,
  loadRecentlyViewed,
  loadRecentlyViewedIds,
  recordRecentlyViewed,
} from './recentlyViewed';

const KEY = 'gridfinity-community-recently-viewed-v1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recordRecentlyViewed', () => {
  it('records views most-recent-first', () => {
    recordRecentlyViewed('first');
    recordRecentlyViewed('second');
    recordRecentlyViewed('third');
    expect(loadRecentlyViewedIds()).toEqual(['third', 'second', 'first']);
  });

  it('stores the view timestamp', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123_456);
    recordRecentlyViewed('a');
    expect(loadRecentlyViewed()).toEqual([{ id: 'a', viewedAt: 123_456 }]);
  });

  it('re-viewing moves the id to the front without duplicating it', () => {
    recordRecentlyViewed('a');
    recordRecentlyViewed('b');
    recordRecentlyViewed('a');
    expect(loadRecentlyViewedIds()).toEqual(['a', 'b']);
  });

  it('caps the list at the newest RECENTLY_VIEWED_CAP entries', () => {
    for (let i = 0; i < RECENTLY_VIEWED_CAP + 5; i++) {
      recordRecentlyViewed(`design-${i}`);
    }
    const ids = loadRecentlyViewedIds();
    expect(ids).toHaveLength(RECENTLY_VIEWED_CAP);
    expect(ids[0]).toBe(`design-${RECENTLY_VIEWED_CAP + 4}`);
    expect(ids).not.toContain('design-0');
    expect(ids).not.toContain('design-4');
    expect(ids).toContain('design-5');
  });

  it('swallows storage failures instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordRecentlyViewed('a')).not.toThrow();
  });
});

describe('loadRecentlyViewed', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadRecentlyViewed()).toEqual([]);
  });

  it('returns an empty list for corrupt JSON', () => {
    localStorage.setItem(KEY, 'not json');
    expect(loadRecentlyViewed()).toEqual([]);
  });

  it('returns an empty list for a non-array payload', () => {
    localStorage.setItem(KEY, JSON.stringify({ id: 'a', viewedAt: 1 }));
    expect(loadRecentlyViewed()).toEqual([]);
  });

  it('drops malformed entries and keeps valid ones', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: 'good', viewedAt: 2 },
        { id: 42, viewedAt: 1 },
        { viewedAt: 1 },
        null,
        'junk',
      ])
    );
    expect(loadRecentlyViewedIds()).toEqual(['good']);
  });
});
