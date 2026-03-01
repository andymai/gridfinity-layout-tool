import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedWithMe } from '@/shared/hooks/useSharedWithMe';
import { useSharedWithMeStore } from '@/core/store/sharedWithMe';
import { useLayoutStore } from '@/core/store/layout';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useHistoryStore } from '@/core/store/history';
import { useToastStore } from '@/core/store/toast';
import { createDefaultLayout } from '@/core/constants';
import type { SharedWithMeEntry, Layout } from '@/core/types';

// Mock the API module
vi.mock('../../core/api/share', () => ({
  fetchShare: vi.fn(),
}));

import { fetchShare } from '@/core/api/share';

const mockFetchShare = vi.mocked(fetchShare);

function createTestEntry(overrides?: Partial<SharedWithMeEntry>): SharedWithMeEntry {
  return {
    id: 'entry-1',
    sourceShareId: 'share-abc123',
    name: 'Shared Layout',
    authorName: 'Test Author',
    permission: 'view',
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 0,
      layerCount: 1,
    },
    addedAt: Date.now(),
    status: 'available',
    ...overrides,
  };
}

function createTestLayout(): Layout {
  return {
    ...createDefaultLayout(),
    name: 'Shared Test Layout',
    bins: [
      {
        id: 'bin-1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: 'layer-1',
        category: 'cat-1',
        label: 'Test Bin',
        notes: '',
      },
    ],
  };
}

describe('useSharedWithMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores
    useSharedWithMeStore.setState({
      entries: [],
      isLoaded: true,
    });

    useLayoutStore.setState({
      layout: createDefaultLayout(),
    });

    useSharedPreviewStore.setState({ sharedPreview: null });

    useHistoryStore.getState().clear();
    useToastStore.setState({ toasts: [] });

    // Mock online status
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns shared with me entries from store', () => {
      const entries = [createTestEntry()];
      useSharedWithMeStore.setState({ entries });

      const { result } = renderHook(() => useSharedWithMe());

      expect(result.current.sharedWithMe).toEqual(entries);
      expect(result.current.isLoaded).toBe(true);
      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
    });

    it('returns empty array when no shared layouts', () => {
      const { result } = renderHook(() => useSharedWithMe());

      expect(result.current.sharedWithMe).toEqual([]);
    });
  });

  describe('openSharedLayout', () => {
    it('fetches and loads shared layout on success', async () => {
      const entry = createTestEntry();
      const layout = createTestLayout();

      useSharedWithMeStore.setState({
        entries: [entry],
      });

      mockFetchShare.mockResolvedValueOnce({
        ok: true,
        value: {
          layout,
          metadata: {
            permission: 'view',
            authorName: 'Test Author',
          },
        },
      });

      const { result } = renderHook(() => useSharedWithMe());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.openSharedLayout(entry);
      });

      expect(success).toBe(true);
      expect(mockFetchShare).toHaveBeenCalledWith('share-abc123');
      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
    });

    it('sets error state when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      const entry = createTestEntry();
      const { result } = renderHook(() => useSharedWithMe());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.openSharedLayout(entry);
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('offline');
      expect(mockFetchShare).not.toHaveBeenCalled();
    });

    it('handles API error', async () => {
      const entry = createTestEntry();
      useSharedWithMeStore.setState({ entries: [entry] });

      mockFetchShare.mockResolvedValueOnce({
        ok: false,
        error: {
          kind: 'ApiError',
          code: 'API_SERVER_ERROR',
          message: 'Server error',
          timestamp: Date.now(),
        },
      });

      const { result } = renderHook(() => useSharedWithMe());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.openSharedLayout(entry);
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeTruthy();
    });

    it('marks entry as deleted when not found', async () => {
      const entry = createTestEntry();
      useSharedWithMeStore.setState({ entries: [entry] });

      mockFetchShare.mockResolvedValueOnce({
        ok: false,
        error: {
          kind: 'ApiError',
          code: 'API_NOT_FOUND',
          message: 'Not found',
          timestamp: Date.now(),
        },
      });

      const { result } = renderHook(() => useSharedWithMe());

      await act(async () => {
        await result.current.openSharedLayout(entry);
      });

      expect(result.current.error).toContain('deleted');

      // Entry should be marked as deleted in store
      const updated = useSharedWithMeStore.getState().entries.find((e) => e.id === entry.id);
      expect(updated?.status).toBe('deleted');
    });

    it('sets loading state during fetch', async () => {
      const entry = createTestEntry();

      // Create a promise we can resolve manually
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchShare.mockReturnValueOnce(fetchPromise as never);

      const { result } = renderHook(() => useSharedWithMe());

      // Start the open operation
      act(() => {
        result.current.openSharedLayout(entry);
      });

      // Should be in loading state
      expect(result.current.status).toBe('loading');

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          value: {
            layout: createTestLayout(),
            metadata: { permission: 'view' },
          },
        });
      });

      // Should return to idle
      expect(result.current.status).toBe('idle');
    });
  });

  describe('removeSharedLayout', () => {
    it('removes entry from shared with me list', () => {
      const entry = createTestEntry();
      useSharedWithMeStore.setState({ entries: [entry] });

      const { result } = renderHook(() => useSharedWithMe());

      expect(result.current.sharedWithMe).toHaveLength(1);

      act(() => {
        result.current.removeSharedLayout(entry.id);
      });

      expect(useSharedWithMeStore.getState().entries).toHaveLength(0);
    });

    it('does nothing when entry does not exist', () => {
      const entry = createTestEntry();
      useSharedWithMeStore.setState({ entries: [entry] });

      const { result } = renderHook(() => useSharedWithMe());

      act(() => {
        result.current.removeSharedLayout('non-existent-id');
      });

      // Original entry should still exist
      expect(useSharedWithMeStore.getState().entries).toHaveLength(1);
    });
  });

  describe('reactivity', () => {
    it('updates when sharedWithMe entries change', () => {
      const { result, rerender } = renderHook(() => useSharedWithMe());

      expect(result.current.sharedWithMe).toHaveLength(0);

      // Add an entry to the store (wrap in act to suppress warning)
      act(() => {
        useSharedWithMeStore.setState({
          entries: [createTestEntry()],
        });
      });

      rerender();

      expect(result.current.sharedWithMe).toHaveLength(1);
    });
  });
});
