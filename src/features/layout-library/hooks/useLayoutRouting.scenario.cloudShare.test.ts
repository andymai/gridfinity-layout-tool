/**
 * Tests for useLayoutRouting behavior with cloud share URLs.
 *
 * Key requirement: useLayoutRouting must NOT change the URL when it points
 * to a layout ID that doesn't exist locally (potential cloud share).
 * SharedLayoutImporter handles cloud share fetching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutRouting } from '@/features/layout-library/hooks/useLayoutRouting';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import * as url from '@/shared/utils/url';
import { gridUnits, heightUnits, mm, layerId, categoryId, layoutId } from '@/core/types';
import type { LayoutPreview } from '@/core/types';

// Mock the url utilities
vi.mock('@/shared/utils/url', async () => {
  const actual = await vi.importActual('@/shared/utils/url');
  return {
    ...actual,
    parseLayoutFromURL: vi.fn(),
    setLayoutURL: vi.fn(),
    clearLayoutURL: vi.fn(),
    getCanonicalRedirect: vi.fn(),
    getLayoutIdFromHistoryState: vi.fn(),
  };
});

vi.mock('@/core/storage', () => ({
  loadLayoutAsync: vi.fn(),
}));

describe('useLayoutRouting with cloud share URLs', () => {
  const mockLocalLayoutId = 'localLayout1';
  const mockCloudShareId = 'cloudShare12'; // 12 chars to match share ID format
  const mockLocalLayoutName = 'My Local Layout';

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores
    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: mockLocalLayoutName,
        drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
        bins: [],
        layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(1) }],
        categories: [{ id: categoryId('cat1'), name: 'Default', color: '#666666' }],
        printBedSize: mm(256),
        gridUnitMm: mm(42),
        heightUnitMm: mm(7),
      },
      activeLayoutId: layoutId(mockLocalLayoutId),
    });

    useLibraryStore.setState({
      isLoaded: true,
      library: {
        version: '1.0',
        activeLayoutId: layoutId(mockLocalLayoutId),
        settings: {},
        entries: [
          {
            id: layoutId(mockLocalLayoutId),
            name: mockLocalLayoutName,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: {
              drawerWidth: gridUnits(10),
              drawerDepth: gridUnits(8),
              drawerHeight: heightUnits(12),
              binCount: 0,
              layerCount: 1,
            } satisfies LayoutPreview,
          },
        ],
      },
    });

    useSharedPreviewStore.setState({ sharedPreview: null });

    // Default mock implementations
    vi.mocked(url.parseLayoutFromURL).mockReturnValue(null);
    vi.mocked(url.getCanonicalRedirect).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial URL handling', () => {
    it('should NOT change URL when URL points to non-local layout ID', () => {
      // URL is /l/{cloudShareId}/some-layout - not a local layout
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockCloudShareId,
        slug: 'shared-layout',
      });

      renderHook(() => useLayoutRouting());

      // Should NOT call setLayoutURL to change to local layout
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });

    it('should set URL to active layout when URL has no layout ID', () => {
      // URL is / (root, no layout)
      vi.mocked(url.parseLayoutFromURL).mockReturnValue(null);

      renderHook(() => useLayoutRouting());

      expect(url.setLayoutURL).toHaveBeenCalledWith(mockLocalLayoutId, mockLocalLayoutName, false);
    });
  });

  describe('URL update on active layout change', () => {
    it('should NOT change URL when URL points to non-local layout ID', async () => {
      // URL is /l/{cloudShareId}/some-layout
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockCloudShareId,
        slug: 'shared-layout',
      });

      const { rerender } = renderHook(() => useLayoutRouting());

      // Simulate active layout change (which normally triggers URL update)
      await act(async () => {
        useLayoutStore.setState({
          layout: { ...useLayoutStore.getState().layout, name: 'Updated Name' },
        });
        rerender();
      });

      // Should NOT change URL to local layout
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });

    it('should update URL when URL points to local layout with wrong slug', async () => {
      // URL is /l/{localLayoutId}/wrong-slug
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockLocalLayoutId,
        slug: 'wrong-slug',
      });
      // Mock that a canonical redirect is needed
      vi.mocked(url.getCanonicalRedirect).mockReturnValue(
        `/l/${mockLocalLayoutId}/my-local-layout`
      );

      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      renderHook(() => useLayoutRouting());

      // Should redirect to correct slug via replaceState (not setLayoutURL)
      expect(replaceStateSpy).toHaveBeenCalled();
    });
  });

  describe('slug update effect', () => {
    it('should NOT redirect when URL points to non-local layout ID', () => {
      // URL is /l/{cloudShareId}/some-layout
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockCloudShareId,
        slug: 'shared-layout',
      });
      vi.mocked(url.getCanonicalRedirect).mockReturnValue(
        `/l/${mockLocalLayoutId}/my-local-layout`
      );

      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      renderHook(() => useLayoutRouting());

      // Should NOT call replaceState to change URL
      expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('should redirect when URL points to local layout with wrong slug', () => {
      // URL is /l/{localLayoutId}/wrong-slug
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockLocalLayoutId,
        slug: 'wrong-slug',
      });
      vi.mocked(url.getCanonicalRedirect).mockReturnValue(
        `/l/${mockLocalLayoutId}/my-local-layout`
      );

      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      renderHook(() => useLayoutRouting());

      // Should redirect to correct slug
      expect(replaceStateSpy).toHaveBeenCalled();
    });
  });

  describe('shared preview mode', () => {
    it('should preserve URL when in shared preview mode', () => {
      // During shared preview, keep the share URL visible for better UX
      useSharedPreviewStore.setState({
        sharedPreview: {
          layout: {} as any,
          originalName: 'Shared Layout',
          authorName: null,
          cloudShareId: null,
          permission: null,
        },
      });

      renderHook(() => useLayoutRouting());

      // Should NOT clear or change the URL during shared preview
      expect(url.clearLayoutURL).not.toHaveBeenCalled();
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });
  });

  describe('re-renders with cloud share URLs', () => {
    it('should preserve URL on component re-render when loading cloud share', () => {
      // Simulating what happens when SharedLayoutImporter is loading a cloud share
      // The URL has a cloud share ID that doesn't exist locally
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockCloudShareId,
        slug: 'shared-layout',
      });

      const { rerender } = renderHook(() => useLayoutRouting());

      // First render should not change URL
      expect(url.setLayoutURL).not.toHaveBeenCalled();

      // Re-render (simulating state change during cloud share fetch)
      rerender();

      // Should still not change URL
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });

    it('should preserve URL when layout store updates during cloud share load', async () => {
      // URL has a cloud share ID
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockCloudShareId,
        slug: 'shared-layout',
      });

      const { rerender } = renderHook(() => useLayoutRouting());

      // Simulate layout store update (which normally triggers URL update)
      await act(async () => {
        useLayoutStore.setState({
          layout: {
            ...useLayoutStore.getState().layout,
            name: 'Different Name',
          },
        });
        rerender();
      });

      // Should NOT change URL - cloud share loading should not be interrupted
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });
  });

  describe('popstate handler with cloud share URLs', () => {
    it('should not interfere with cloud share URLs during navigation', () => {
      // URL has a cloud share ID
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockCloudShareId,
        slug: 'shared-layout',
      });
      vi.mocked(url.getLayoutIdFromHistoryState).mockReturnValue(mockCloudShareId);

      renderHook(() => useLayoutRouting());

      // Simulate popstate event (browser back/forward)
      act(() => {
        window.dispatchEvent(
          new PopStateEvent('popstate', {
            state: { layoutId: mockCloudShareId },
          })
        );
      });

      // Should not redirect to local layout
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });
  });

  describe('unified URL format /l/{id}/{slug}', () => {
    it('should handle cloud share with /l/ URL format', () => {
      // Cloud shares now use /l/{shareId}/{slug} format (unified with local layouts)
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockCloudShareId,
        slug: 'my-shared-layout',
      });

      renderHook(() => useLayoutRouting());

      // Since cloudShareId is not in library, should not change URL
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });

    it('should distinguish between cloud share ID and local layout ID in same URL format', () => {
      // Both cloud shares and local layouts use /l/{id}/{slug}
      // The difference is whether the ID exists in the local library

      // First: cloud share (not in library)
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockCloudShareId,
        slug: 'shared-layout',
      });

      const { unmount } = renderHook(() => useLayoutRouting());
      expect(url.setLayoutURL).not.toHaveBeenCalled();
      unmount();

      vi.clearAllMocks();

      // Second: local layout (in library)
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({
        layoutId: mockLocalLayoutId,
        slug: 'local-layout',
      });
      vi.mocked(url.getCanonicalRedirect).mockReturnValue(null);

      renderHook(() => useLayoutRouting());
      // Local layout exists, no redirect needed, URL should be managed normally
      // (in this case, slug is correct so no setLayoutURL needed)
    });
  });
});
