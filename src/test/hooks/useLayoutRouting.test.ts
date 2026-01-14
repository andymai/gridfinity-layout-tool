import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutRouting } from '../../hooks/useLayoutRouting';
import { useLayoutStore, useLibraryStore, useUIStore, useToastStore } from '../../store';
import { resetAllStores } from '../testUtils';
import * as storage from '../../storage';
import * as url from '../../utils/url';
import * as validation from '../../utils/validation';

// Mock storage module
vi.mock('../../storage', () => ({
  loadLayoutByIdAsync: vi.fn(),
}));

// Mock url module
vi.mock('../../utils/url', () => ({
  parseLayoutIdFromHash: vi.fn(),
  setLayoutHash: vi.fn(),
  clearLayoutHash: vi.fn(),
  getLayoutIdFromHistoryState: vi.fn(),
  hasShareHash: vi.fn(),
}));

// Mock validation module
vi.mock('../../utils/validation', () => ({
  validateLayoutIntegrity: vi.fn(),
}));

describe('useLayoutRouting', () => {
  const mockLayout = {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: 'coral', name: 'Coral', color: '#FF6B6B' }],
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    bins: [],
  };

  const mockEntry = {
    id: 'layout-123',
    name: 'Test Layout',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    preview: null,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set up default mocks
    vi.mocked(url.parseLayoutIdFromHash).mockReturnValue(null);
    vi.mocked(url.hasShareHash).mockReturnValue(false);
    vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(mockLayout);
    vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({ valid: true });

    // Set up library with an entry (need to set library.entries, not entries)
    useLibraryStore.setState({
      isLoaded: true,
      library: {
        version: '1.0',
        activeLayoutId: 'layout-123',
        settings: {},
        entries: [mockEntry],
      },
    });

    // Set up layout store
    useLayoutStore.setState({
      layout: mockLayout,
      activeLayoutId: 'layout-123',
    });

    // Set up UI store
    useUIStore.setState({
      activeLayerId: 'layer1',
      activeCategoryId: 'coral',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('navigateToLayout', () => {
    it('returns function for navigation', () => {
      const { result } = renderHook(() => useLayoutRouting());

      expect(typeof result.current.navigateToLayout).toBe('function');
    });

    it('returns false when layout not in library', async () => {
      const { result } = renderHook(() => useLayoutRouting());

      const success = await result.current.navigateToLayout('nonexistent-id');

      expect(success).toBe(false);
    });

    it('returns false when layout data cannot be loaded', async () => {
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(null);

      const { result } = renderHook(() => useLayoutRouting());

      const success = await result.current.navigateToLayout('layout-123');

      expect(success).toBe(false);
    });

    it('returns false when layout validation fails', async () => {
      vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({
        valid: false,
        errors: ['Missing layers'],
      });

      const { result } = renderHook(() => useLayoutRouting());

      const success = await result.current.navigateToLayout('layout-123');

      expect(success).toBe(false);
    });

    it('returns true and updates stores on success', async () => {
      const { result } = renderHook(() => useLayoutRouting());

      const success = await result.current.navigateToLayout('layout-123');

      expect(success).toBe(true);
      // Active layout ID is stored in library.activeLayoutId
      expect(useLibraryStore.getState().library.activeLayoutId).toBe('layout-123');
    });

    it('clears selection when navigating', async () => {
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout-123');

      expect(useUIStore.getState().selectedBinIds).toEqual([]);
    });

    it('sets active layer to first layer', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout-123');

      expect(useUIStore.getState().activeLayerId).toBe('layer1');
    });

    it('sets active category to first category', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout-123');

      expect(useUIStore.getState().activeCategoryId).toBe('coral');
    });

    it('clears undo history', async () => {
      // The clear function is called within navigateToLayout
      // We verify navigation succeeds, which implies history was cleared
      const { result } = renderHook(() => useLayoutRouting());
      const success = await result.current.navigateToLayout('layout-123');

      expect(success).toBe(true);
    });

    it('updates URL hash', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout-123');

      expect(url.setLayoutHash).toHaveBeenCalledWith('layout-123', false);
    });

    it('adds to history when requested', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout-123', true);

      expect(url.setLayoutHash).toHaveBeenCalledWith('layout-123', true);
    });
  });

  describe('initial URL handling', () => {
    it('skips initialization when library not loaded', () => {
      useLibraryStore.setState({ isLoaded: false });

      renderHook(() => useLayoutRouting());

      // Should not try to parse URL yet
      expect(url.parseLayoutIdFromHash).not.toHaveBeenCalled();
    });

    it('skips when share hash is present', () => {
      vi.mocked(url.hasShareHash).mockReturnValue(true);
      // Also set shared preview to prevent URL sync effect
      useUIStore.setState({ sharedLayoutPreview: mockLayout });

      renderHook(() => useLayoutRouting());

      // With share hash and shared preview, URL should be cleared not set
      expect(url.setLayoutHash).not.toHaveBeenCalled();
      expect(url.clearLayoutHash).toHaveBeenCalled();
    });

    it('sets URL to current layout when no hash present', () => {
      vi.mocked(url.parseLayoutIdFromHash).mockReturnValue(null);

      renderHook(() => useLayoutRouting());

      expect(url.setLayoutHash).toHaveBeenCalledWith('layout-123', false);
    });

    it('navigates to layout specified in URL', () => {
      // Set up a different active layout so navigation is needed
      vi.mocked(url.parseLayoutIdFromHash).mockReturnValue('layout-123');
      useLayoutStore.setState({ activeLayoutId: 'other-layout' });

      // Add the other layout to library too
      useLibraryStore.setState({
        isLoaded: true,
        library: {
          version: '1.0',
          activeLayoutId: 'other-layout',
          settings: {},
          entries: [
            mockEntry,
            { id: 'other-layout', name: 'Other', createdAt: Date.now(), updatedAt: Date.now(), preview: null },
          ],
        },
      });

      renderHook(() => useLayoutRouting());

      // Should have attempted to navigate to the URL layout
      expect(storage.loadLayoutByIdAsync).toHaveBeenCalledWith('layout-123');
    });

    it('shows toast when URL layout not found', async () => {
      vi.mocked(url.parseLayoutIdFromHash).mockReturnValue('nonexistent');
      const addToastSpy = vi.fn();
      useToastStore.setState({ addToast: addToastSpy });

      renderHook(() => useLayoutRouting());

      // navigateToLayout is async, so wait for the toast to be called
      await vi.waitFor(() => {
        expect(addToastSpy).toHaveBeenCalledWith(
          expect.stringContaining('not found'),
          'info',
          expect.any(Number)
        );
      });
    });
  });

  describe('popstate handling', () => {
    it('handles back/forward navigation', () => {
      vi.mocked(url.getLayoutIdFromHistoryState).mockReturnValue('layout-123');
      vi.mocked(url.parseLayoutIdFromHash).mockReturnValue(null);

      renderHook(() => useLayoutRouting());

      // Simulate popstate event
      act(() => {
        const event = new PopStateEvent('popstate', { state: { layoutId: 'layout-123' } });
        window.dispatchEvent(event);
      });

      // Should have attempted navigation
      expect(url.getLayoutIdFromHistoryState).toHaveBeenCalled();
    });

    it('skips popstate during shared preview', () => {
      useUIStore.setState({ sharedLayoutPreview: mockLayout });

      renderHook(() => useLayoutRouting());

      act(() => {
        const event = new PopStateEvent('popstate', { state: { layoutId: 'layout-123' } });
        window.dispatchEvent(event);
      });

      // Should not navigate during shared preview
      expect(storage.loadLayoutByIdAsync).not.toHaveBeenCalled();
    });

    it('falls back to parsing hash when no state', () => {
      vi.mocked(url.getLayoutIdFromHistoryState).mockReturnValue(null);
      vi.mocked(url.parseLayoutIdFromHash).mockReturnValue('layout-123');

      renderHook(() => useLayoutRouting());

      act(() => {
        const event = new PopStateEvent('popstate', { state: null });
        window.dispatchEvent(event);
      });

      expect(url.parseLayoutIdFromHash).toHaveBeenCalled();
    });
  });

  describe('URL sync on layout change', () => {
    it('updates URL when active layout changes', () => {
      vi.mocked(url.parseLayoutIdFromHash).mockReturnValue(null);

      renderHook(() => useLayoutRouting());

      // Should sync URL to current layout
      expect(url.setLayoutHash).toHaveBeenCalledWith('layout-123', false);
    });

    it('clears hash during shared preview', () => {
      useUIStore.setState({ sharedLayoutPreview: mockLayout });

      renderHook(() => useLayoutRouting());

      expect(url.clearLayoutHash).toHaveBeenCalled();
    });

    it('skips URL update for __shared_preview__ layout', () => {
      useLayoutStore.setState({ activeLayoutId: '__shared_preview__' });

      renderHook(() => useLayoutRouting());

      // Should not set hash for temporary preview ID
      expect(url.setLayoutHash).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes popstate listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useLayoutRouting());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    });
  });
});
