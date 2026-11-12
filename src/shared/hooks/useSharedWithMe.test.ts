import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedWithMe } from '@/shared/hooks/useSharedWithMe';
import { useSharedWithMeStore } from '@/core/store/sharedWithMe';
import { useLayoutStore } from '@/core/store/layout';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { useToastStore } from '@/core/store/toast';
import { createDefaultLayout } from '@/core/constants';
import type { SharedWithMeEntry, Layout } from '@/core/types';
import { binId, categoryId, designId, gridUnits, heightUnits, layerId } from '@/core/types';
import type * as Storage from '@/core/storage';

// Mock the API module
vi.mock('@/core/api/share', () => ({
  fetchShare: vi.fn(),
}));

vi.mock('@/core/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof Storage>()),
  restoreSharedDesigns: vi.fn((_shareId: string, layout: Layout) => Promise.resolve(layout)),
}));

import { fetchShare } from '@/core/api/share';
import { restoreSharedDesigns, sharedDesignIds } from '@/core/storage';

const mockFetchShare = vi.mocked(fetchShare);

function createTestEntry(overrides?: Partial<SharedWithMeEntry>): SharedWithMeEntry {
  return {
    id: 'entry-1',
    sourceShareId: 'share-abc123',
    name: 'Shared Layout',
    authorName: 'Test Author',
    permission: 'view',
    preview: {
      drawerWidth: gridUnits(10),
      drawerDepth: gridUnits(8),
      drawerHeight: heightUnits(12),
      binCount: 0,
      layerCount: 1,
    },
    addedAt: Date.now(),
    lastAccessedAt: Date.now(),
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
        id: binId('bin-1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        layerId: layerId('layer-1'),
        category: categoryId('cat-1'),
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
            createdAt: new Date().toISOString(),
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

    it('keeps the link revision of the copy it opened, for the collab room', async () => {
      const entry = createTestEntry();
      useSharedWithMeStore.setState({ entries: [entry] });
      mockFetchShare.mockResolvedValueOnce({
        ok: true,
        value: {
          layout: createTestLayout(),
          metadata: {
            createdAt: '2026-11-01T09:00:00.000Z',
            lastUpdatedAt: '2026-11-01T10:00:00.000Z',
            permission: 'edit',
          },
        },
      });
      const { result } = renderHook(() => useSharedWithMe());

      await act(async () => {
        await result.current.openSharedLayout(entry);
      });

      expect(useSharedPreviewStore.getState().sharedPreview?.linkUpdatedAt).toBe(
        '2026-11-01T10:00:00.000Z'
      );
    });

    it("keeps the room's layout when the share's live room is open already", async () => {
      const entry = createTestEntry({ permission: 'edit' });
      useSharedWithMeStore.setState({ entries: [entry] });
      const inRoom: Layout = { ...createTestLayout(), name: 'Room edits' };
      useLayoutStore.setState({ layout: inRoom });
      useSharedPreviewStore
        .getState()
        .setSharedLayoutPreview(inRoom, 'Shared', undefined, 'share-abc123', 'edit');
      const linkedDesigns = [{ id: 'owner-design', name: 'Tray', params: {} as never }];
      mockFetchShare.mockResolvedValueOnce({
        ok: true,
        value: {
          layout: createTestLayout(),
          linkedDesigns,
          metadata: { createdAt: '2026-11-01T09:00:00.000Z', permission: 'edit' },
        },
      });
      const { result } = renderHook(() => useSharedWithMe());

      await act(async () => {
        await result.current.openSharedLayout(entry);
      });

      expect(useLayoutStore.getState().layout).toBe(inRoom);
      expect(useSharedPreviewStore.getState().sharedPreview?.designIds).toEqual(
        sharedDesignIds('share-abc123', linkedDesigns)
      );
    });

    it("restores the share's designs and keeps their id map, for the collab room", async () => {
      const entry = createTestEntry({ permission: 'edit' });
      useSharedWithMeStore.setState({ entries: [entry] });
      const shared = createTestLayout();
      const linkedDesigns = [{ id: 'owner-design', name: 'Tray', params: {} as never }];
      mockFetchShare.mockResolvedValueOnce({
        ok: true,
        value: {
          layout: shared,
          linkedDesigns,
          metadata: { createdAt: '2026-11-01T09:00:00.000Z', permission: 'edit' },
        },
      });
      const restored: Layout = {
        ...shared,
        bins: shared.bins.map((bin) => ({ ...bin, linkedDesignId: designId('design_shared_1') })),
      };
      vi.mocked(restoreSharedDesigns).mockResolvedValueOnce(restored);
      const { result } = renderHook(() => useSharedWithMe());

      await act(async () => {
        await result.current.openSharedLayout(entry);
      });

      expect(restoreSharedDesigns).toHaveBeenCalledWith('share-abc123', shared, linkedDesigns);
      expect(useLayoutStore.getState().layout.bins[0]?.linkedDesignId).toBe('design_shared_1');
      expect(useSharedPreviewStore.getState().sharedPreview?.designIds).toEqual(
        sharedDesignIds('share-abc123', linkedDesigns)
      );
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
