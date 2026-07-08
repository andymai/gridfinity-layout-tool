import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';

describe('useSupportersRouting', () => {
  let originalPathname: string;

  beforeEach(() => {
    originalPathname = window.location.pathname;
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalPathname);
  });

  describe('isSupportersRoute detection', () => {
    it('returns false on root path', () => {
      const { result } = renderHook(() => useSupportersRouting());
      expect(result.current.isSupportersRoute).toBe(false);
    });

    it('returns true on /supporters', () => {
      window.history.replaceState(null, '', '/supporters');
      const { result } = renderHook(() => useSupportersRouting());
      expect(result.current.isSupportersRoute).toBe(true);
    });

    it('returns true on /supporters/ (trailing slash)', () => {
      window.history.replaceState(null, '', '/supporters/');
      const { result } = renderHook(() => useSupportersRouting());
      expect(result.current.isSupportersRoute).toBe(true);
    });

    it('returns false on a different path', () => {
      window.history.replaceState(null, '', '/baseplate');
      const { result } = renderHook(() => useSupportersRouting());
      expect(result.current.isSupportersRoute).toBe(false);
    });
  });

  describe('navigation', () => {
    it('navigateToSupporters enters the route and updates the URL', () => {
      const { result } = renderHook(() => useSupportersRouting());
      act(() => result.current.navigateToSupporters());
      expect(result.current.isSupportersRoute).toBe(true);
      expect(window.location.pathname).toBe('/supporters');
    });

    it('navigateHome leaves the route and returns to /', () => {
      window.history.replaceState(null, '', '/supporters');
      const { result } = renderHook(() => useSupportersRouting());
      act(() => result.current.navigateHome());
      expect(result.current.isSupportersRoute).toBe(false);
      expect(window.location.pathname).toBe('/');
    });
  });
});
