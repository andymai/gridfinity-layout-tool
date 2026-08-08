// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
import {
  getCommunityGalleryQuery,
  getCommunityDesignIdFromUrl,
  syncCommunityGalleryQuery,
  useCommunityRouting,
} from '@/shared/hooks/useCommunityRouting';

const DESIGN_ID = 'Abc123456789';
const AUTHOR_ID = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

function setCommunityFlag(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, community_showcase: enabled },
    },
  }));
}

describe('useCommunityRouting', () => {
  let originalPathname: string;

  beforeEach(() => {
    originalPathname = window.location.pathname;
    window.history.replaceState(null, '', '/');
    setCommunityFlag(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setCommunityFlag(false);
    window.history.replaceState(null, '', originalPathname);
  });

  describe('route detection', () => {
    it('returns false on root path', () => {
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(false);
    });

    it('returns true on /community', () => {
      window.history.replaceState(null, '', '/community');
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(true);
      expect(result.current.communityDesignIdFromUrl).toBeNull();
    });

    it('returns true on /community/ (trailing slash)', () => {
      window.history.replaceState(null, '', '/community/');
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(true);
    });

    it('returns true on a detail deep link and extracts the design id', () => {
      window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(true);
      expect(result.current.communityDesignIdFromUrl).toBe(DESIGN_ID);
    });

    it('tolerates a trailing slash on the detail deep link', () => {
      window.history.replaceState(null, '', `/community/d/${DESIGN_ID}/`);
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(true);
      expect(result.current.communityDesignIdFromUrl).toBe(DESIGN_ID);
    });

    it.each([
      '/communityx',
      '/community/d',
      '/community/d/',
      '/community/d/short',
      '/community/d/toolong1234567',
      '/community/d/bad-chars@@12',
      '/community/d/Abc123456789/extra',
    ])('rejects %s', (path) => {
      window.history.replaceState(null, '', path);
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(false);
      expect(result.current.communityDesignIdFromUrl).toBeNull();
    });
  });

  describe('community_showcase flag gate', () => {
    it('flag off: /community falls through (isCommunityRoute stays false)', () => {
      setCommunityFlag(false);
      window.history.replaceState(null, '', '/community');
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(false);
    });

    it('flag off: the detail deep link falls through too', () => {
      setCommunityFlag(false);
      window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(false);
    });

    it('flipping the flag on makes the current /community URL active', () => {
      setCommunityFlag(false);
      window.history.replaceState(null, '', '/community');
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.isCommunityRoute).toBe(false);
      act(() => setCommunityFlag(true));
      expect(result.current.isCommunityRoute).toBe(true);
    });
  });

  describe('navigation', () => {
    it('openCommunityDesignUrl pushes the deep link with the marker state', () => {
      window.history.replaceState(null, '', '/community');
      const { result } = renderHook(() => useCommunityRouting());
      act(() => result.current.openCommunityDesignUrl(DESIGN_ID));
      expect(window.location.pathname).toBe(`/community/d/${DESIGN_ID}`);
      expect(result.current.communityDesignIdFromUrl).toBe(DESIGN_ID);
      expect(window.history.state).toEqual({ communityRouteDetail: true });
    });

    it('closeCommunityDesignUrl pops the pushed entry (gallery beneath it)', () => {
      window.history.replaceState(null, '', '/community');
      const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
      const { result } = renderHook(() => useCommunityRouting());
      act(() => result.current.openCommunityDesignUrl(DESIGN_ID));
      act(() => result.current.closeCommunityDesignUrl());
      expect(backSpy).toHaveBeenCalledTimes(1);
    });

    it('closeCommunityDesignUrl replaces a cold-visit deep link (no entry beneath)', () => {
      window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
      const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
      const { result } = renderHook(() => useCommunityRouting());
      act(() => result.current.closeCommunityDesignUrl());
      expect(backSpy).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/community');
      expect(result.current.communityDesignIdFromUrl).toBeNull();
      expect(result.current.isCommunityRoute).toBe(true);
    });

    it('closeCommunityDesignUrl is a no-op away from the deep link', () => {
      window.history.replaceState(null, '', '/community');
      const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
      const { result } = renderHook(() => useCommunityRouting());
      act(() => result.current.closeCommunityDesignUrl());
      expect(backSpy).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/community');
    });
  });

  describe('popstate', () => {
    it('re-derives route and design id on browser navigation', () => {
      window.history.replaceState(null, '', '/community');
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.communityDesignIdFromUrl).toBeNull();

      act(() => {
        window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(result.current.isCommunityRoute).toBe(true);
      expect(result.current.communityDesignIdFromUrl).toBe(DESIGN_ID);

      act(() => {
        window.history.replaceState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(result.current.isCommunityRoute).toBe(false);
      expect(result.current.communityDesignIdFromUrl).toBeNull();
    });
  });

  describe('getCommunityDesignIdFromUrl', () => {
    it('reads the id straight from the current URL', () => {
      window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
      expect(getCommunityDesignIdFromUrl()).toBe(DESIGN_ID);
      window.history.replaceState(null, '', '/community');
      expect(getCommunityDesignIdFromUrl()).toBeNull();
    });
  });

  describe('gallery query string', () => {
    it('reads the query on the gallery path, without the leading ?', () => {
      window.history.replaceState(null, '', `/community?author=${AUTHOR_ID}&cat=tools`);
      expect(getCommunityGalleryQuery()).toBe(`author=${AUTHOR_ID}&cat=tools`);
    });

    it('is empty off the gallery path even with a query present', () => {
      window.history.replaceState(null, '', `/community/d/${DESIGN_ID}?author=${AUTHOR_ID}`);
      expect(getCommunityGalleryQuery()).toBe('');
    });

    it('exposes the query through the hook and re-derives it on popstate', () => {
      window.history.replaceState(null, '', '/community?cat=tools');
      const { result } = renderHook(() => useCommunityRouting());
      expect(result.current.communityGalleryQuery).toBe('cat=tools');
      act(() => {
        window.history.replaceState(null, '', '/community');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(result.current.communityGalleryQuery).toBe('');
    });

    it('writes, rewrites, and clears the query in place', () => {
      window.history.replaceState(null, '', '/community');
      syncCommunityGalleryQuery('cat=tools');
      expect(window.location.search).toBe('?cat=tools');
      syncCommunityGalleryQuery('cat=kitchen&liked=1');
      expect(window.location.search).toBe('?cat=kitchen&liked=1');
      syncCommunityGalleryQuery('');
      expect(window.location.search).toBe('');
      expect(window.location.pathname).toBe('/community');
    });

    it('replaces instead of pushing history entries', () => {
      // Narrowing a gallery is not navigation: pushing would mean a dozen
      // Back presses to leave a page filtered a dozen times.
      window.history.replaceState(null, '', '/community');
      const pushSpy = vi.spyOn(window.history, 'pushState');
      const replaceSpy = vi.spyOn(window.history, 'replaceState');
      syncCommunityGalleryQuery('cat=tools');
      expect(pushSpy).not.toHaveBeenCalled();
      expect(replaceSpy).toHaveBeenCalledTimes(1);
    });

    it('does not touch history when the query is unchanged', () => {
      window.history.replaceState(null, '', '/community?cat=tools');
      const replaceSpy = vi.spyOn(window.history, 'replaceState');
      syncCommunityGalleryQuery('cat=tools');
      expect(replaceSpy).not.toHaveBeenCalled();
    });

    it('is a no-op off the gallery path', () => {
      window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
      syncCommunityGalleryQuery('cat=tools');
      expect(window.location.search).toBe('');
    });

    it('preserves the detail marker state', () => {
      window.history.replaceState({ communityRouteDetail: true }, '', '/community');
      syncCommunityGalleryQuery('cat=tools');
      expect(window.history.state).toEqual({ communityRouteDetail: true });
    });
  });
});
