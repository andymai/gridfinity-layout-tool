import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseLayoutFromURL,
  setLayoutURL,
  clearLayoutURL,
  getLayoutIdFromHistoryState,
  getCanonicalRedirect,
} from '@/utils/url';

describe('url utilities', () => {
  // Store original location
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
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

  describe('parseLayoutFromURL', () => {
    it('returns null when no layout in URL', () => {
      window.location.pathname = '/';
      expect(parseLayoutFromURL()).toBeNull();
    });

    it('returns null for legacy share hash (handled separately)', () => {
      window.location.hash = '#share=abc123';
      expect(parseLayoutFromURL()).toBeNull();
    });

    it('parses new pattern with 12-char ID', () => {
      window.location.pathname = '/l/abc123xyz789';
      const result = parseLayoutFromURL();
      expect(result).toEqual({ layoutId: 'abc123xyz789', slug: null });
    });

    it('parses new pattern with ID and slug', () => {
      window.location.pathname = '/l/abc123xyz789/my-layout-name';
      const result = parseLayoutFromURL();
      expect(result).toEqual({ layoutId: 'abc123xyz789', slug: 'my-layout-name' });
    });

    it('parses legacy UUID pattern', () => {
      window.location.pathname = '/l/550e8400-e29b-41d4-a716-446655440000';
      const result = parseLayoutFromURL();
      expect(result).toEqual({
        layoutId: '550e8400-e29b-41d4-a716-446655440000',
        slug: null,
      });
    });

    it('parses legacy UUID pattern with slug', () => {
      window.location.pathname = '/l/550e8400-e29b-41d4-a716-446655440000/my-layout';
      const result = parseLayoutFromURL();
      expect(result).toEqual({
        layoutId: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'my-layout',
      });
    });

    it('parses legacy local hash format', () => {
      window.location.hash = '#local/550e8400-e29b-41d4-a716-446655440000';
      const result = parseLayoutFromURL();
      expect(result).toEqual({
        layoutId: '550e8400-e29b-41d4-a716-446655440000',
        slug: null,
      });
    });

    it('returns null for invalid ID length', () => {
      window.location.pathname = '/l/abc123'; // Too short
      expect(parseLayoutFromURL()).toBeNull();
    });
  });

  describe('setLayoutURL', () => {
    it('sets URL with ID and slugified name', () => {
      setLayoutURL('abc123xyz789', 'My Layout Name');

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { layoutId: 'abc123xyz789', slug: 'my-layout-name' },
        '',
        '/l/abc123xyz789/my-layout-name'
      );
    });

    it('uses pushState when addToHistory is true', () => {
      setLayoutURL('abc123xyz789', 'Test Layout', true);

      expect(window.history.pushState).toHaveBeenCalledWith(
        { layoutId: 'abc123xyz789', slug: 'test-layout' },
        '',
        '/l/abc123xyz789/test-layout'
      );
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('skips update if URL is already correct', () => {
      window.location.pathname = '/l/abc123xyz789/my-layout';

      setLayoutURL('abc123xyz789', 'My Layout');

      expect(window.history.replaceState).not.toHaveBeenCalled();
      expect(window.history.pushState).not.toHaveBeenCalled();
    });
  });

  describe('clearLayoutURL', () => {
    it('navigates to root', () => {
      window.location.pathname = '/l/abc123xyz789/my-layout';

      clearLayoutURL();

      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/');
    });

    it('skips update if already at root', () => {
      window.location.pathname = '/';

      clearLayoutURL();

      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('getCanonicalRedirect', () => {
    it('returns redirect URL when slug is missing', () => {
      window.location.pathname = '/l/abc123xyz789';
      const redirect = getCanonicalRedirect('abc123xyz789', 'My Layout');
      expect(redirect).toBe('/l/abc123xyz789/my-layout');
    });

    it('returns redirect URL when slug is wrong', () => {
      window.location.pathname = '/l/abc123xyz789/old-name';
      const redirect = getCanonicalRedirect('abc123xyz789', 'New Name');
      expect(redirect).toBe('/l/abc123xyz789/new-name');
    });

    it('returns null when slug is correct', () => {
      window.location.pathname = '/l/abc123xyz789/my-layout';
      const redirect = getCanonicalRedirect('abc123xyz789', 'My Layout');
      expect(redirect).toBeNull();
    });

    it('returns null when not on a layout URL', () => {
      window.location.pathname = '/';
      const redirect = getCanonicalRedirect('abc123xyz789', 'My Layout');
      expect(redirect).toBeNull();
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

  it('share hash takes precedence over path', () => {
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/l/abc123xyz789/my-layout',
        hash: '#share=abc123',
      },
      writable: true,
    });

    // Should return null because share takes precedence
    expect(parseLayoutFromURL()).toBeNull();
  });
});
