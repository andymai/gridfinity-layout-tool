import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBaseplateRouting } from '@/hooks/useBaseplateRouting';

describe('useBaseplateRouting', () => {
  let originalPathname: string;

  beforeEach(() => {
    originalPathname = window.location.pathname;
    // Reset to root before each test
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalPathname);
  });

  describe('isBaseplateRoute detection', () => {
    it('returns false on root path', () => {
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.isBaseplateRoute).toBe(false);
    });

    it('returns true on /baseplate path', () => {
      window.history.replaceState(null, '', '/baseplate');
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.isBaseplateRoute).toBe(true);
    });

    it('returns true on /baseplate/ (trailing slash)', () => {
      window.history.replaceState(null, '', '/baseplate/');
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.isBaseplateRoute).toBe(true);
    });

    it('returns false on a different path', () => {
      window.history.replaceState(null, '', '/designer');
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.isBaseplateRoute).toBe(false);
    });
  });

  describe('layoutIdFromUrl', () => {
    it('returns null on root path even with query params', () => {
      window.history.replaceState(null, '', '/?layoutId=abc');
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.layoutIdFromUrl).toBeNull();
    });

    it('parses layoutId from /baseplate?layoutId= param', () => {
      window.history.replaceState(null, '', '/baseplate?layoutId=abc123');
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.layoutIdFromUrl).toBe('abc123');
    });

    it('returns null on /baseplate with no layoutId param', () => {
      window.history.replaceState(null, '', '/baseplate');
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.layoutIdFromUrl).toBeNull();
    });
  });

  describe('navigateToBaseplate', () => {
    it('sets isBaseplateRoute to true', () => {
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.isBaseplateRoute).toBe(false);

      act(() => {
        result.current.navigateToBaseplate('layout-001');
      });

      expect(result.current.isBaseplateRoute).toBe(true);
    });

    it('updates layoutIdFromUrl', () => {
      const { result } = renderHook(() => useBaseplateRouting());

      act(() => {
        result.current.navigateToBaseplate('layout-001');
      });

      expect(result.current.layoutIdFromUrl).toBe('layout-001');
    });

    it('updates window location to /baseplate with layoutId param', () => {
      const { result } = renderHook(() => useBaseplateRouting());

      act(() => {
        result.current.navigateToBaseplate('my-layout');
      });

      expect(window.location.pathname).toBe('/baseplate');
      expect(window.location.search).toBe('?layoutId=my-layout');
    });

    it('URL-encodes the layoutId', () => {
      const { result } = renderHook(() => useBaseplateRouting());

      act(() => {
        result.current.navigateToBaseplate('layout with spaces');
      });

      expect(window.location.search).toContain('layoutId=layout%20with%20spaces');
      // The decoded value should still be correct
      expect(result.current.layoutIdFromUrl).toBe('layout with spaces');
    });

    it('dispatches popstate event for multi-instance sync', () => {
      const listener = vi.fn();
      window.addEventListener('popstate', listener);

      const { result } = renderHook(() => useBaseplateRouting());

      act(() => {
        result.current.navigateToBaseplate('layout-001');
      });

      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener('popstate', listener);
    });
  });

  describe('navigateBack', () => {
    it('sets isBaseplateRoute to false', () => {
      window.history.replaceState(null, '', '/baseplate?layoutId=abc');
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.isBaseplateRoute).toBe(true);

      act(() => {
        result.current.navigateBack();
      });

      expect(result.current.isBaseplateRoute).toBe(false);
    });

    it('clears layoutIdFromUrl', () => {
      window.history.replaceState(null, '', '/baseplate?layoutId=abc');
      const { result } = renderHook(() => useBaseplateRouting());

      act(() => {
        result.current.navigateBack();
      });

      expect(result.current.layoutIdFromUrl).toBeNull();
    });

    it('updates window location to /', () => {
      window.history.replaceState(null, '', '/baseplate?layoutId=abc');
      const { result } = renderHook(() => useBaseplateRouting());

      act(() => {
        result.current.navigateBack();
      });

      expect(window.location.pathname).toBe('/');
    });

    it('dispatches popstate event', () => {
      const listener = vi.fn();
      window.addEventListener('popstate', listener);

      const { result } = renderHook(() => useBaseplateRouting());

      act(() => {
        result.current.navigateBack();
      });

      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener('popstate', listener);
    });
  });

  describe('popstate handling', () => {
    it('updates isBaseplateRoute on browser back to /baseplate', () => {
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.isBaseplateRoute).toBe(false);

      act(() => {
        window.history.replaceState(null, '', '/baseplate');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(result.current.isBaseplateRoute).toBe(true);
    });

    it('updates isBaseplateRoute on browser back to /', () => {
      window.history.replaceState(null, '', '/baseplate');
      const { result } = renderHook(() => useBaseplateRouting());
      expect(result.current.isBaseplateRoute).toBe(true);

      act(() => {
        window.history.replaceState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(result.current.isBaseplateRoute).toBe(false);
    });

    it('updates layoutIdFromUrl on popstate', () => {
      const { result } = renderHook(() => useBaseplateRouting());

      act(() => {
        window.history.replaceState(null, '', '/baseplate?layoutId=nav-id');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(result.current.layoutIdFromUrl).toBe('nav-id');
    });

    it('cleans up popstate listener on unmount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useBaseplateRouting());
      unmount();

      // Verify removeEventListener was called with popstate
      expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('multiple instances stay in sync', () => {
    it('both instances see the same isBaseplateRoute after navigation', () => {
      const { result: hook1 } = renderHook(() => useBaseplateRouting());
      const { result: hook2 } = renderHook(() => useBaseplateRouting());

      expect(hook1.current.isBaseplateRoute).toBe(false);
      expect(hook2.current.isBaseplateRoute).toBe(false);

      act(() => {
        hook1.current.navigateToBaseplate('shared-layout');
      });

      expect(hook1.current.isBaseplateRoute).toBe(true);
      expect(hook2.current.isBaseplateRoute).toBe(true);
    });

    it('both instances see the same layoutIdFromUrl after navigation', () => {
      const { result: hook1 } = renderHook(() => useBaseplateRouting());
      const { result: hook2 } = renderHook(() => useBaseplateRouting());

      act(() => {
        hook1.current.navigateToBaseplate('shared-id');
      });

      expect(hook1.current.layoutIdFromUrl).toBe('shared-id');
      expect(hook2.current.layoutIdFromUrl).toBe('shared-id');
    });
  });
});
