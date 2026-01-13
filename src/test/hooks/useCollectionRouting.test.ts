import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCollectionRouting } from '../../hooks/useCollectionRouting';
import { useCollectionStore } from '../../store/collection';
import { useToastStore } from '../../store/toast';
import { useUIStore } from '../../store/ui';
import * as url from '../../utils/url';
import type { Collection } from '../../api/collection';

// Mock url module
vi.mock('../../utils/url', () => ({
  parseCollectionFromURL: vi.fn(),
  setCollectionURL: vi.fn(),
  clearCollectionURL: vi.fn(),
  getCollectionFromHistoryState: vi.fn(),
  isCollectionURL: vi.fn(),
}));

describe('useCollectionRouting', () => {
  const mockCollection: Collection = {
    id: 'abc123def456',
    name: 'Test Collection',
    layoutCount: 3,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    vi.mocked(url.parseCollectionFromURL).mockReturnValue(null);
    vi.mocked(url.isCollectionURL).mockReturnValue(false);

    // Reset collection store
    useCollectionStore.setState({
      activeCollection: null,
      activeCollectionLayouts: [],
      memberships: [],
      loadingState: 'idle',
      syncStates: {},
    });

    // Reset UI store
    useUIStore.setState({
      liveMessage: null,
    });

    // Reset toast store
    useToastStore.setState({
      toasts: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('navigateToCollection', () => {
    it('returns function for navigation', () => {
      const { result } = renderHook(() => useCollectionRouting());

      expect(typeof result.current.navigateToCollection).toBe('function');
    });

    it('calls joinCollection with collection ID', async () => {
      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      await act(async () => {
        await result.current.navigateToCollection('abc123def456');
      });

      expect(mockJoinCollection).toHaveBeenCalledWith('abc123def456');
    });

    it('returns true on successful join', async () => {
      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.navigateToCollection('abc123def456');
      });

      expect(success).toBe(true);
    });

    it('updates URL on successful join', async () => {
      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      await act(async () => {
        await result.current.navigateToCollection('abc123def456');
      });

      expect(url.setCollectionURL).toHaveBeenCalledWith('abc123def456', false, false);
    });

    it('announces success to screen reader', async () => {
      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      await act(async () => {
        await result.current.navigateToCollection('abc123def456');
      });

      expect(useUIStore.getState().liveMessage).toContain('Joined collection');
    });

    it('returns false on failed join', async () => {
      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.navigateToCollection('abc123def456');
      });

      expect(success).toBe(false);
    });

    it('shows toast on failed join', async () => {
      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      await act(async () => {
        await result.current.navigateToCollection('abc123def456');
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0].type).toBe('error');
    });

    it('clears URL on failed join', async () => {
      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Collection not found' },
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      await act(async () => {
        await result.current.navigateToCollection('abc123def456');
      });

      expect(url.clearCollectionURL).toHaveBeenCalled();
    });

    it('passes viewOnly flag to URL', async () => {
      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      await act(async () => {
        await result.current.navigateToCollection('abc123def456', true);
      });

      expect(url.setCollectionURL).toHaveBeenCalledWith('abc123def456', true, false);
    });
  });

  describe('exitCollection', () => {
    it('returns function for exiting', () => {
      const { result } = renderHook(() => useCollectionRouting());

      expect(typeof result.current.exitCollection).toBe('function');
    });

    it('calls leaveCollection', () => {
      const mockLeaveCollection = vi.fn();
      useCollectionStore.setState({
        leaveCollection: mockLeaveCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      act(() => {
        result.current.exitCollection();
      });

      expect(mockLeaveCollection).toHaveBeenCalled();
    });

    it('clears URL when exiting', () => {
      const mockLeaveCollection = vi.fn();
      useCollectionStore.setState({
        leaveCollection: mockLeaveCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      act(() => {
        result.current.exitCollection();
      });

      expect(url.clearCollectionURL).toHaveBeenCalled();
    });

    it('announces exit to screen reader', () => {
      const mockLeaveCollection = vi.fn();
      useCollectionStore.setState({
        leaveCollection: mockLeaveCollection,
      });

      const { result } = renderHook(() => useCollectionRouting());

      act(() => {
        result.current.exitCollection();
      });

      expect(useUIStore.getState().liveMessage).toContain('Left collection');
    });
  });

  describe('loading states', () => {
    it('returns isLoading true when loadingState is loading', () => {
      useCollectionStore.setState({
        loadingState: 'loading',
      });

      const { result } = renderHook(() => useCollectionRouting());

      expect(result.current.isLoading).toBe(true);
    });

    it('returns isLoading false when loadingState is idle', () => {
      useCollectionStore.setState({
        loadingState: 'idle',
      });

      const { result } = renderHook(() => useCollectionRouting());

      expect(result.current.isLoading).toBe(false);
    });

    it('returns isSyncing true when loadingState is syncing', () => {
      useCollectionStore.setState({
        loadingState: 'syncing',
      });

      const { result } = renderHook(() => useCollectionRouting());

      expect(result.current.isSyncing).toBe(true);
    });

    it('returns isSyncing false when loadingState is idle', () => {
      useCollectionStore.setState({
        loadingState: 'idle',
      });

      const { result } = renderHook(() => useCollectionRouting());

      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('initial URL handling', () => {
    it('parses collection from URL on mount', async () => {
      vi.mocked(url.parseCollectionFromURL).mockReturnValue({
        collectionId: 'abc123def456',
        viewOnly: false,
      });

      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      renderHook(() => useCollectionRouting());

      await waitFor(() => {
        expect(mockJoinCollection).toHaveBeenCalledWith('abc123def456');
      });
    });

    it('handles viewOnly URL parameter', async () => {
      vi.mocked(url.parseCollectionFromURL).mockReturnValue({
        collectionId: 'abc123def456',
        viewOnly: true,
      });

      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      renderHook(() => useCollectionRouting());

      await waitFor(() => {
        expect(mockJoinCollection).toHaveBeenCalledWith('abc123def456');
      });
    });

    it('does not parse URL on subsequent renders', async () => {
      vi.mocked(url.parseCollectionFromURL).mockReturnValue({
        collectionId: 'abc123def456',
        viewOnly: false,
      });

      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      const { rerender } = renderHook(() => useCollectionRouting());

      await waitFor(() => {
        expect(mockJoinCollection).toHaveBeenCalledTimes(1);
      });

      // Rerender should not trigger another join
      rerender();

      expect(mockJoinCollection).toHaveBeenCalledTimes(1);
    });
  });

  describe('popstate handling', () => {
    it('handles back/forward navigation to collection', async () => {
      vi.mocked(url.getCollectionFromHistoryState).mockReturnValue({
        collectionId: 'abc123def456',
        viewOnly: false,
      });

      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      renderHook(() => useCollectionRouting());

      await act(async () => {
        const event = new PopStateEvent('popstate', {
          state: { collectionId: 'abc123def456' },
        });
        window.dispatchEvent(event);
      });

      expect(mockJoinCollection).toHaveBeenCalledWith('abc123def456');
    });

    it('falls back to URL parsing when no state', async () => {
      vi.mocked(url.getCollectionFromHistoryState).mockReturnValue(null);
      vi.mocked(url.parseCollectionFromURL).mockReturnValue({
        collectionId: 'abc123def456',
        viewOnly: false,
      });

      const mockJoinCollection = vi.fn().mockResolvedValue({
        success: true,
        data: mockCollection,
      });
      useCollectionStore.setState({
        joinCollection: mockJoinCollection,
      });

      renderHook(() => useCollectionRouting());

      await act(async () => {
        const event = new PopStateEvent('popstate', { state: null });
        window.dispatchEvent(event);
      });

      expect(url.parseCollectionFromURL).toHaveBeenCalled();
    });

    it('leaves collection when navigating away', async () => {
      vi.mocked(url.getCollectionFromHistoryState).mockReturnValue(null);
      vi.mocked(url.parseCollectionFromURL).mockReturnValue(null);

      const mockLeaveCollection = vi.fn();
      useCollectionStore.setState({
        activeCollection: mockCollection,
        leaveCollection: mockLeaveCollection,
      });

      renderHook(() => useCollectionRouting());

      await act(async () => {
        const event = new PopStateEvent('popstate', { state: null });
        window.dispatchEvent(event);
      });

      expect(mockLeaveCollection).toHaveBeenCalled();
    });
  });

  describe('URL sync', () => {
    it('updates URL when activeCollection changes', () => {
      vi.mocked(url.parseCollectionFromURL).mockReturnValue(null);

      useCollectionStore.setState({
        activeCollection: mockCollection,
      });

      renderHook(() => useCollectionRouting());

      expect(url.setCollectionURL).toHaveBeenCalledWith('abc123def456', false, false);
    });

    it('clears URL when leaving collection mode', () => {
      vi.mocked(url.isCollectionURL).mockReturnValue(true);

      useCollectionStore.setState({
        activeCollection: null,
      });

      renderHook(() => useCollectionRouting());

      expect(url.clearCollectionURL).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes popstate listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useCollectionRouting());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    });
  });
});
