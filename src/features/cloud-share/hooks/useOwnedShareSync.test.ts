import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOwnedShareSync } from './useOwnedShareSync';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { createDefaultLayout, SHARED_PREVIEW_ID } from '@/core/constants';
import * as shareApi from '@/core/api/share';
import { ok, err, apiServerError } from '@/core/result';
import type { LayoutLibrary, CloudShareInfo, Layout } from '@/core/types';
import { layoutId } from '@/core/types';

// Mock the share API module
vi.mock('@/core/api/share', () => ({
  updateShare: vi.fn(),
}));

const TEST_LAYOUT_ID = layoutId('test-layout-id');
const TEST_SHARE_ID = 'share-123';
const TEST_DELETE_TOKEN = 'delete-token-xyz';

function createTestLibrary(cloudShare?: CloudShareInfo): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: TEST_LAYOUT_ID,
    settings: {},
    entries: [
      {
        id: TEST_LAYOUT_ID,
        name: 'Test Layout',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 0,
          layerCount: 1,
        },
        cloudShare,
      },
    ],
  };
}

function createCloudShareInfo(): CloudShareInfo {
  return {
    id: TEST_SHARE_ID,
    deleteToken: TEST_DELETE_TOKEN,
    permission: 'view',
    url: 'https://example.com/share/123',
    createdAt: Date.now(),
  };
}

describe('useOwnedShareSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset stores to default state
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({
      layout: defaultLayout,
      activeLayoutId: TEST_LAYOUT_ID,
      lastEditSource: 'local',
    });

    useLibraryStore.setState({
      library: createTestLibrary(),
      isLoaded: true,
      showLayoutManager: false,
    });

    // Default mock for updateShare
    vi.mocked(shareApi.updateShare).mockResolvedValue(ok(undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('sync conditions', () => {
    it('does not sync when layout has no cloudShare', async () => {
      // Library has no cloudShare
      useLibraryStore.setState({
        library: createTestLibrary(undefined),
      });

      renderHook(() => useOwnedShareSync());

      // Advance past debounce timer
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(shareApi.updateShare).not.toHaveBeenCalled();
    });

    it('does not sync when lastEditSource is not local', async () => {
      // Set up cloudShare
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      // Edit source is 'remote' (synced from collaborator)
      useLayoutStore.setState({
        lastEditSource: 'remote',
      });

      renderHook(() => useOwnedShareSync());

      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(shareApi.updateShare).not.toHaveBeenCalled();
    });

    it('does not sync when lastEditSource is init', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      useLayoutStore.setState({
        lastEditSource: 'init',
      });

      renderHook(() => useOwnedShareSync());

      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(shareApi.updateShare).not.toHaveBeenCalled();
    });

    it('does not sync when viewing shared preview', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      useLayoutStore.setState({
        activeLayoutId: SHARED_PREVIEW_ID,
        lastEditSource: 'local',
      });

      renderHook(() => useOwnedShareSync());

      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(shareApi.updateShare).not.toHaveBeenCalled();
    });

    it('syncs when all conditions are met', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      useLayoutStore.setState({
        lastEditSource: 'local',
        activeLayoutId: TEST_LAYOUT_ID,
      });

      renderHook(() => useOwnedShareSync());

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(shareApi.updateShare).toHaveBeenCalledWith(
        TEST_SHARE_ID,
        TEST_DELETE_TOKEN,
        expect.any(Object)
      );
    });
  });

  describe('debouncing', () => {
    it('debounces sync by 5 seconds', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      renderHook(() => useOwnedShareSync());

      // Before debounce period
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      expect(shareApi.updateShare).not.toHaveBeenCalled();

      // After debounce period
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    });

    it('resets debounce timer on new edits', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      const { rerender } = renderHook(() => useOwnedShareSync());

      // Wait 3 seconds
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(shareApi.updateShare).not.toHaveBeenCalled();

      // Simulate a new edit by updating the layout
      await act(async () => {
        const newLayout = { ...useLayoutStore.getState().layout, name: 'Updated Name' };
        useLayoutStore.setState({ layout: newLayout });
      });
      rerender();

      // Wait another 3 seconds (should not trigger yet, timer was reset)
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(shareApi.updateShare).not.toHaveBeenCalled();

      // Complete the debounce
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    });
  });

  describe('fingerprint comparison', () => {
    it('skips sync if layout fingerprint has not changed', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      const { rerender } = renderHook(() => useOwnedShareSync());

      // First sync
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(shareApi.updateShare).toHaveBeenCalledTimes(1);

      // Trigger another sync cycle with same layout
      useLayoutStore.setState({ lastEditSource: 'local' });
      rerender();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Should still be 1 call - skipped because fingerprint matches
      expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    });

    it('syncs again when layout actually changes', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      const { rerender } = renderHook(() => useOwnedShareSync());

      // First sync
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(shareApi.updateShare).toHaveBeenCalledTimes(1);

      // Change the layout
      await act(async () => {
        const updatedLayout: Layout = {
          ...useLayoutStore.getState().layout,
          name: 'A completely different name',
        };
        useLayoutStore.setState({
          layout: updatedLayout,
          lastEditSource: 'local',
        });
      });
      rerender();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Should have synced again with new layout
      expect(shareApi.updateShare).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('silently handles API errors', async () => {
      vi.mocked(shareApi.updateShare).mockResolvedValue(err(apiServerError()));

      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      renderHook(() => useOwnedShareSync());

      // Should not throw
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(shareApi.updateShare).toHaveBeenCalled();
    });

    it('silently handles network errors', async () => {
      vi.mocked(shareApi.updateShare).mockRejectedValue(new Error('Network error'));

      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      renderHook(() => useOwnedShareSync());

      // Should not throw
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(shareApi.updateShare).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('clears timer on unmount', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      const { unmount } = renderHook(() => useOwnedShareSync());

      // Start debounce timer but don't complete it
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(shareApi.updateShare).not.toHaveBeenCalled();

      // Unmount - should clear timer and trigger sync
      unmount();

      // Advance time - should not trigger additional syncs
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Only one sync from the unmount flush
      expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    });

    it('syncs pending changes on unmount', async () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShareInfo()),
      });

      const { unmount } = renderHook(() => useOwnedShareSync());

      // Start debounce
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Unmount triggers immediate sync
      unmount();

      expect(shareApi.updateShare).toHaveBeenCalledWith(
        TEST_SHARE_ID,
        TEST_DELETE_TOKEN,
        expect.any(Object)
      );
    });
  });

  describe('cloudShare validation', () => {
    it('does not sync when cloudShare has no id', async () => {
      useLibraryStore.setState({
        library: createTestLibrary({
          id: '',
          deleteToken: TEST_DELETE_TOKEN,
          permission: 'view',
          url: '',
          createdAt: Date.now(),
        }),
      });

      renderHook(() => useOwnedShareSync());

      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(shareApi.updateShare).not.toHaveBeenCalled();
    });

    it('does not sync when cloudShare has no deleteToken', async () => {
      useLibraryStore.setState({
        library: createTestLibrary({
          id: TEST_SHARE_ID,
          deleteToken: '',
          permission: 'view',
          url: '',
          createdAt: Date.now(),
        }),
      });

      renderHook(() => useOwnedShareSync());

      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(shareApi.updateShare).not.toHaveBeenCalled();
    });
  });
});
