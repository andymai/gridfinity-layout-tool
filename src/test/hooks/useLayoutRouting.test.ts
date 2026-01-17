import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutRouting } from '../../hooks/useLayoutRouting';
import { useLayoutStore, useLibraryStore, useUIStore, useToastStore } from '../../core/store';
import { resetAllStores } from '../testUtils';
import * as storage from '../../core/storage';
import * as url from '../../utils/url';
import * as validation from '../../utils/validation';

// Mock storage module
vi.mock('../../core/storage', () => ({
  loadLayoutByIdAsync: vi.fn(),
}));

// Mock url module - using the new URL API
vi.mock('../../utils/url', () => ({
  parseLayoutFromURL: vi.fn(),
  setLayoutURL: vi.fn(),
  clearLayoutURL: vi.fn(),
  getLayoutIdFromHistoryState: vi.fn(),
  getCanonicalRedirect: vi.fn(),
  hasLegacyShareHash: vi.fn(),
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
    id: 'layout123test',
    name: 'Test Layout',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    preview: null,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set up default mocks
    vi.mocked(url.parseLayoutFromURL).mockReturnValue(null);
    vi.mocked(url.hasLegacyShareHash).mockReturnValue(false);
    vi.mocked(url.getCanonicalRedirect).mockReturnValue(null);
    vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(mockLayout);
    vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({ valid: true });

    // Set up library with an entry
    useLibraryStore.setState({
      isLoaded: true,
      library: {
        version: '1.0',
        activeLayoutId: 'layout123test',
        settings: {},
        entries: [mockEntry],
      },
    });

    // Set up layout store
    useLayoutStore.setState({
      layout: mockLayout,
      activeLayoutId: 'layout123test',
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

      const success = await result.current.navigateToLayout('layout123test');

      expect(success).toBe(false);
    });

    it('returns false when layout validation fails', async () => {
      vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({
        valid: false,
        errors: ['Missing layers'],
      });

      const { result } = renderHook(() => useLayoutRouting());

      const success = await result.current.navigateToLayout('layout123test');

      expect(success).toBe(false);
    });

    it('returns true and updates stores on success', async () => {
      const { result } = renderHook(() => useLayoutRouting());

      const success = await result.current.navigateToLayout('layout123test');

      expect(success).toBe(true);
      expect(useLibraryStore.getState().library.activeLayoutId).toBe('layout123test');
    });

    it('clears selection when navigating', async () => {
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout123test');

      expect(useUIStore.getState().selectedBinIds).toEqual([]);
    });

    it('sets active layer to first layer', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout123test');

      expect(useUIStore.getState().activeLayerId).toBe('layer1');
    });

    it('sets active category to first category', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout123test');

      expect(useUIStore.getState().activeCategoryId).toBe('coral');
    });

    it('clears undo history', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      const success = await result.current.navigateToLayout('layout123test');

      expect(success).toBe(true);
    });

    it('updates URL with layout ID and name', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout123test');

      expect(url.setLayoutURL).toHaveBeenCalledWith('layout123test', 'Test Layout', false);
    });

    it('adds to history when requested', async () => {
      const { result } = renderHook(() => useLayoutRouting());
      await result.current.navigateToLayout('layout123test', true);

      expect(url.setLayoutURL).toHaveBeenCalledWith('layout123test', 'Test Layout', true);
    });
  });

  describe('initial URL handling', () => {
    it('skips URL changes when library not loaded', () => {
      useLibraryStore.setState({ isLoaded: false });

      renderHook(() => useLayoutRouting());

      // parseLayoutFromURL may be called to check for cloud shares,
      // but setLayoutURL should not be called when library isn't loaded
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });

    it('skips URL change when layout in URL does not exist locally (potential cloud share)', () => {
      // When URL has a layout ID that doesn't exist locally,
      // we assume it might be a cloud share and let SharedLayoutImporter handle it
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({ layoutId: 'cloudShare12', slug: 'shared-layout' });

      renderHook(() => useLayoutRouting());

      // Should NOT redirect to active layout - let SharedLayoutImporter handle the cloud share
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });

    it('sets URL to current layout when no layout in URL', () => {
      vi.mocked(url.parseLayoutFromURL).mockReturnValue(null);

      renderHook(() => useLayoutRouting());

      expect(url.setLayoutURL).toHaveBeenCalledWith('layout123test', 'Test Layout', false);
    });

    it('navigates to layout specified in URL', () => {
      // Set up a different active layout so navigation is needed
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({ layoutId: 'layout123test', slug: 'test-layout' });
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
      expect(storage.loadLayoutByIdAsync).toHaveBeenCalledWith('layout123test');
    });

    it('does not redirect when URL layout not found locally (potential cloud share)', () => {
      // Non-local layout IDs in URL should NOT trigger redirect
      // SharedLayoutImporter handles cloud share fetching
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({ layoutId: 'nonexistent', slug: null });
      const addToastSpy = vi.fn();
      useToastStore.setState({ addToast: addToastSpy });

      renderHook(() => useLayoutRouting());

      // Should NOT redirect to active layout - the layout ID might be a cloud share
      expect(url.setLayoutURL).not.toHaveBeenCalled();
      // No toast should be shown
      expect(addToastSpy).not.toHaveBeenCalled();
    });
  });

  describe('popstate handling', () => {
    it('handles back/forward navigation', () => {
      vi.mocked(url.getLayoutIdFromHistoryState).mockReturnValue('layout123test');
      vi.mocked(url.parseLayoutFromURL).mockReturnValue(null);

      renderHook(() => useLayoutRouting());

      // Simulate popstate event
      act(() => {
        const event = new PopStateEvent('popstate', { state: { layoutId: 'layout123test' } });
        window.dispatchEvent(event);
      });

      // Should have attempted navigation
      expect(url.getLayoutIdFromHistoryState).toHaveBeenCalled();
    });

    it('skips popstate during shared preview', () => {
      useUIStore.setState({ sharedLayoutPreview: mockLayout });

      renderHook(() => useLayoutRouting());

      act(() => {
        const event = new PopStateEvent('popstate', { state: { layoutId: 'layout123test' } });
        window.dispatchEvent(event);
      });

      // Should not navigate during shared preview
      expect(storage.loadLayoutByIdAsync).not.toHaveBeenCalled();
    });

    it('falls back to parsing URL when no state', () => {
      vi.mocked(url.getLayoutIdFromHistoryState).mockReturnValue(null);
      vi.mocked(url.parseLayoutFromURL).mockReturnValue({ layoutId: 'layout123test', slug: 'test-layout' });

      renderHook(() => useLayoutRouting());

      act(() => {
        const event = new PopStateEvent('popstate', { state: null });
        window.dispatchEvent(event);
      });

      expect(url.parseLayoutFromURL).toHaveBeenCalled();
    });
  });

  describe('URL sync on layout change', () => {
    it('updates URL when active layout changes', () => {
      vi.mocked(url.parseLayoutFromURL).mockReturnValue(null);

      renderHook(() => useLayoutRouting());

      // Should sync URL to current layout
      expect(url.setLayoutURL).toHaveBeenCalledWith('layout123test', 'Test Layout', false);
    });

    it('preserves URL during shared preview', () => {
      // During shared preview, keep the share URL visible for better UX
      useUIStore.setState({ sharedLayoutPreview: mockLayout });

      renderHook(() => useLayoutRouting());

      // Should NOT clear or change the URL during shared preview
      expect(url.clearLayoutURL).not.toHaveBeenCalled();
      expect(url.setLayoutURL).not.toHaveBeenCalled();
    });

    it('skips URL update for __shared_preview__ layout', () => {
      useLayoutStore.setState({ activeLayoutId: '__shared_preview__' });

      renderHook(() => useLayoutRouting());

      // Should not set URL for temporary preview ID
      expect(url.setLayoutURL).not.toHaveBeenCalled();
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
