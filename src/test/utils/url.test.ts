import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseLayoutIdFromHash,
  setLayoutHash,
  clearLayoutHash,
  hasShareHash,
  getLayoutIdFromHistoryState,
  parseCollectionFromURL,
  setCollectionURL,
  clearCollectionURL,
  isCollectionURL,
  generateCollectionURL,
  getCollectionFromHistoryState,
} from '../../utils/url';

describe('url utilities', () => {
  // Store original location
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location.hash
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        hash: '',
        pathname: '/',
        search: '',
      },
      writable: true,
    });

    // Mock history methods
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('parseLayoutIdFromHash', () => {
    it('returns null when no hash', () => {
      window.location.hash = '';
      expect(parseLayoutIdFromHash()).toBeNull();
    });

    it('returns null for non-local hash', () => {
      window.location.hash = '#something-else';
      expect(parseLayoutIdFromHash()).toBeNull();
    });

    it('returns null for share hash (share takes precedence)', () => {
      window.location.hash = '#share=abc123';
      expect(parseLayoutIdFromHash()).toBeNull();
    });

    it('returns layout ID from valid hash', () => {
      window.location.hash = '#local/abc-123-uuid';
      expect(parseLayoutIdFromHash()).toBe('abc-123-uuid');
    });

    it('returns null for empty layout ID', () => {
      window.location.hash = '#local/';
      expect(parseLayoutIdFromHash()).toBeNull();
    });

    it('handles complex layout IDs', () => {
      window.location.hash = '#local/550e8400-e29b-41d4-a716-446655440000';
      expect(parseLayoutIdFromHash()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('setLayoutHash', () => {
    it('sets hash using replaceState by default', () => {
      setLayoutHash('test-id');

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { layoutId: 'test-id' },
        '',
        '#local/test-id'
      );
      expect(window.history.pushState).not.toHaveBeenCalled();
    });

    it('uses pushState when addToHistory is true', () => {
      setLayoutHash('test-id', true);

      expect(window.history.pushState).toHaveBeenCalledWith(
        { layoutId: 'test-id' },
        '',
        '#local/test-id'
      );
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('clearLayoutHash', () => {
    it('removes hash from URL', () => {
      window.location.pathname = '/app';
      window.location.search = '?foo=bar';

      clearLayoutHash();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/app?foo=bar'
      );
    });

    it('uses root path when pathname is empty', () => {
      window.location.pathname = '';
      window.location.search = '';

      clearLayoutHash();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/'
      );
    });
  });

  describe('hasShareHash', () => {
    it('returns false when no hash', () => {
      window.location.hash = '';
      expect(hasShareHash()).toBe(false);
    });

    it('returns false for local hash', () => {
      window.location.hash = '#local/abc';
      expect(hasShareHash()).toBe(false);
    });

    it('returns true for share hash', () => {
      window.location.hash = '#share=eyJuYW1lIjoiVGVzdCJ9';
      expect(hasShareHash()).toBe(true);
    });

    it('returns false for similar but not share hash', () => {
      window.location.hash = '#shared=abc';
      expect(hasShareHash()).toBe(false);
    });
  });

  describe('getLayoutIdFromHistoryState', () => {
    it('returns null for null state', () => {
      expect(getLayoutIdFromHistoryState(null)).toBeNull();
    });

    it('returns null for undefined state', () => {
      expect(getLayoutIdFromHistoryState(undefined)).toBeNull();
    });

    it('returns null for state without layoutId', () => {
      expect(getLayoutIdFromHistoryState({ foo: 'bar' })).toBeNull();
    });

    it('returns null for non-string layoutId', () => {
      expect(getLayoutIdFromHistoryState({ layoutId: 123 })).toBeNull();
    });

    it('returns null for empty string layoutId', () => {
      expect(getLayoutIdFromHistoryState({ layoutId: '' })).toBeNull();
    });

    it('returns layoutId from valid state', () => {
      expect(getLayoutIdFromHistoryState({ layoutId: 'test-id' })).toBe('test-id');
    });
  });
});

describe('url edge cases', () => {
  beforeEach(() => {
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('share hash takes precedence over layout hash', () => {
    // If somehow both are present (shouldn't happen, but test the priority)
    Object.defineProperty(window, 'location', {
      value: { hash: '#share=abc123' },
      writable: true,
    });

    // Should return null because share takes precedence
    expect(parseLayoutIdFromHash()).toBeNull();
    expect(hasShareHash()).toBe(true);
  });
});

describe('collection URL utilities', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        pathname: '/',
        search: '',
        hash: '',
        origin: 'https://example.com',
      },
      writable: true,
    });

    vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('parseCollectionFromURL', () => {
    it('returns null for non-collection URL', () => {
      window.location.pathname = '/';
      expect(parseCollectionFromURL()).toBeNull();
    });

    it('parses collection ID from /c/{id} path', () => {
      window.location.pathname = '/c/abc123def456';
      const result = parseCollectionFromURL();
      expect(result).toEqual({ collectionId: 'abc123def456', viewOnly: false });
    });

    it('parses collection ID with /view suffix', () => {
      window.location.pathname = '/c/abc123def456/view';
      const result = parseCollectionFromURL();
      expect(result).toEqual({ collectionId: 'abc123def456', viewOnly: true });
    });

    it('returns null for invalid collection ID length', () => {
      window.location.pathname = '/c/short';
      expect(parseCollectionFromURL()).toBeNull();
    });

    it('returns null for ID with invalid characters', () => {
      window.location.pathname = '/c/abc123def45!';
      expect(parseCollectionFromURL()).toBeNull();
    });

    it('returns null for collection URL with trailing slash', () => {
      // The regex requires exact format without trailing slash
      window.location.pathname = '/c/abc123def456/';
      expect(parseCollectionFromURL()).toBeNull();
    });
  });

  describe('isCollectionURL', () => {
    it('returns false for non-collection URL', () => {
      window.location.pathname = '/';
      expect(isCollectionURL()).toBe(false);
    });

    it('returns true for collection URL', () => {
      window.location.pathname = '/c/abc123def456';
      expect(isCollectionURL()).toBe(true);
    });

    it('returns true for view-only collection URL', () => {
      window.location.pathname = '/c/abc123def456/view';
      expect(isCollectionURL()).toBe(true);
    });

    it('returns false for similar but not collection path', () => {
      window.location.pathname = '/collection/abc123def456';
      expect(isCollectionURL()).toBe(false);
    });
  });

  describe('setCollectionURL', () => {
    it('sets URL using replaceState by default', () => {
      setCollectionURL('abc123def456');

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { collectionId: 'abc123def456', viewOnly: false },
        '',
        '/c/abc123def456'
      );
      expect(window.history.pushState).not.toHaveBeenCalled();
    });

    it('uses pushState when addToHistory is true', () => {
      setCollectionURL('abc123def456', false, true);

      expect(window.history.pushState).toHaveBeenCalledWith(
        { collectionId: 'abc123def456', viewOnly: false },
        '',
        '/c/abc123def456'
      );
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('adds /view suffix for view-only mode', () => {
      setCollectionURL('abc123def456', true, false);

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { collectionId: 'abc123def456', viewOnly: true },
        '',
        '/c/abc123def456/view'
      );
    });
  });

  describe('clearCollectionURL', () => {
    it('clears collection path from URL', () => {
      window.location.pathname = '/c/abc123def456';

      clearCollectionURL();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/'
      );
    });

    it('clears to root even with query parameters', () => {
      // clearCollectionURL always navigates to '/', discarding query params
      window.location.pathname = '/c/abc123def456';
      window.location.search = '?foo=bar';

      clearCollectionURL();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/'
      );
    });
  });

  describe('generateCollectionURL', () => {
    it('generates full URL for collection', () => {
      const url = generateCollectionURL('abc123def456');
      expect(url).toBe('https://example.com/c/abc123def456');
    });

    it('generates view-only URL when specified', () => {
      const url = generateCollectionURL('abc123def456', true);
      expect(url).toBe('https://example.com/c/abc123def456/view');
    });
  });

  describe('getCollectionFromHistoryState', () => {
    it('returns null for null state', () => {
      expect(getCollectionFromHistoryState(null)).toBeNull();
    });

    it('returns null for undefined state', () => {
      expect(getCollectionFromHistoryState(undefined)).toBeNull();
    });

    it('returns null for state without collectionId', () => {
      expect(getCollectionFromHistoryState({ foo: 'bar' })).toBeNull();
    });

    it('returns null for non-string collectionId', () => {
      expect(getCollectionFromHistoryState({ collectionId: 123 })).toBeNull();
    });

    it('returns null for empty string collectionId', () => {
      expect(getCollectionFromHistoryState({ collectionId: '' })).toBeNull();
    });

    it('returns collection info from valid state', () => {
      const result = getCollectionFromHistoryState({
        collectionId: 'abc123def456',
        viewOnly: false,
      });
      expect(result).toEqual({ collectionId: 'abc123def456', viewOnly: false });
    });

    it('defaults viewOnly to false', () => {
      const result = getCollectionFromHistoryState({
        collectionId: 'abc123def456',
      });
      expect(result).toEqual({ collectionId: 'abc123def456', viewOnly: false });
    });

    it('respects viewOnly flag when true', () => {
      const result = getCollectionFromHistoryState({
        collectionId: 'abc123def456',
        viewOnly: true,
      });
      expect(result).toEqual({ collectionId: 'abc123def456', viewOnly: true });
    });
  });
});
