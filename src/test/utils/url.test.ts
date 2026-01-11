import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseLayoutIdFromHash,
  setLayoutHash,
  clearLayoutHash,
  hasShareHash,
  getLayoutIdFromHistoryState,
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

    it('returns null for non-layout hash', () => {
      window.location.hash = '#something-else';
      expect(parseLayoutIdFromHash()).toBeNull();
    });

    it('returns null for share hash (share takes precedence)', () => {
      window.location.hash = '#share=abc123';
      expect(parseLayoutIdFromHash()).toBeNull();
    });

    it('returns layout ID from valid hash', () => {
      window.location.hash = '#layout/abc-123-uuid';
      expect(parseLayoutIdFromHash()).toBe('abc-123-uuid');
    });

    it('returns null for empty layout ID', () => {
      window.location.hash = '#layout/';
      expect(parseLayoutIdFromHash()).toBeNull();
    });

    it('handles complex layout IDs', () => {
      window.location.hash = '#layout/550e8400-e29b-41d4-a716-446655440000';
      expect(parseLayoutIdFromHash()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('setLayoutHash', () => {
    it('sets hash using replaceState by default', () => {
      setLayoutHash('test-id');

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { layoutId: 'test-id' },
        '',
        '#layout/test-id'
      );
      expect(window.history.pushState).not.toHaveBeenCalled();
    });

    it('uses pushState when addToHistory is true', () => {
      setLayoutHash('test-id', true);

      expect(window.history.pushState).toHaveBeenCalledWith(
        { layoutId: 'test-id' },
        '',
        '#layout/test-id'
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

    it('returns false for layout hash', () => {
      window.location.hash = '#layout/abc';
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
