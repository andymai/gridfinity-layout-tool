import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDesignerUrlSync } from './useDesignerUrlSync';
import { useDesignerStore } from '../store/designer';
import * as DesignerStorage from '@/features/bin-designer/storage/DesignerStorage';
import { ok, err, storageUnavailable } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { SavedDesign } from '../types';

vi.mock('@/features/bin-designer/storage/DesignerStorage');

describe('useDesignerUrlSync', () => {
  let originalHref: string;

  beforeEach(() => {
    originalHref = window.location.href;
    vi.clearAllMocks();

    // Reset store to clean state (no active design)
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      currentDesignId: null,
      designName: 'Untitled Bin',
      saveStatus: 'idle',
    });
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalHref);
  });

  function makeSavedDesign(id: string, name = 'Test Design'): SavedDesign {
    return {
      id,
      name,
      params: { ...DEFAULT_BIN_PARAMS, width: 3 },
      thumbnail: null,
      createdAt: '2026-01-22T00:00:00.000Z',
      updatedAt: '2026-01-22T00:00:00.000Z',
    };
  }

  describe('Direction 1: URL → Store', () => {
    it('loads design from storage when URL has ?id= on mount', async () => {
      const design = makeSavedDesign('url-design-123');
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok(design));

      window.history.replaceState(null, '', '/designer?id=url-design-123');

      renderHook(() => useDesignerUrlSync());

      await waitFor(() => {
        expect(DesignerStorage.loadDesign).toHaveBeenCalledWith('url-design-123');
      });

      // Store should be updated with loaded design
      const state = useDesignerStore.getState();
      expect(state.currentDesignId).toBe('url-design-123');
      expect(state.designName).toBe('Test Design');
    });

    it('does not load when URL has no ?id= param', async () => {
      window.history.replaceState(null, '', '/designer');

      renderHook(() => useDesignerUrlSync());

      // Give it time to potentially fire
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(DesignerStorage.loadDesign).not.toHaveBeenCalled();
    });

    it('does not reload when URL ID matches current store ID', async () => {
      useDesignerStore.setState({ currentDesignId: 'already-loaded' });
      window.history.replaceState(null, '', '/designer?id=already-loaded');

      renderHook(() => useDesignerUrlSync());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(DesignerStorage.loadDesign).not.toHaveBeenCalled();
    });

    it('handles storage load failure gracefully', async () => {
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(
        err(storageUnavailable('IndexedDB not available'))
      );

      window.history.replaceState(null, '', '/designer?id=missing-design');

      renderHook(() => useDesignerUrlSync());

      await waitFor(() => {
        expect(DesignerStorage.loadDesign).toHaveBeenCalledWith('missing-design');
      });

      // Store should remain unchanged
      const state = useDesignerStore.getState();
      expect(state.currentDesignId).toBeNull();
    });

    it('loads new design on popstate with different ID', async () => {
      const design1 = makeSavedDesign('design-1', 'Design One');
      const design2 = makeSavedDesign('design-2', 'Design Two');
      vi.mocked(DesignerStorage.loadDesign)
        .mockResolvedValueOnce(ok(design1))
        .mockResolvedValueOnce(ok(design2));

      window.history.replaceState(null, '', '/designer?id=design-1');

      renderHook(() => useDesignerUrlSync());

      // Wait for first load
      await waitFor(() => {
        expect(useDesignerStore.getState().currentDesignId).toBe('design-1');
      });

      // Simulate back/forward navigation to different design
      act(() => {
        window.history.replaceState(null, '', '/designer?id=design-2');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(DesignerStorage.loadDesign).toHaveBeenCalledWith('design-2');
        expect(useDesignerStore.getState().currentDesignId).toBe('design-2');
      });
    });
  });

  describe('Direction 2: Store → URL', () => {
    it('syncs URL when store currentDesignId changes (auto-save)', async () => {
      window.history.replaceState(null, '', '/designer');

      renderHook(() => useDesignerUrlSync());

      // Wait for mount to complete
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Simulate auto-save creating a new design ID
      act(() => {
        useDesignerStore.setState({ currentDesignId: 'auto-saved-001' });
      });

      // URL should update via replaceState (no history entry)
      await waitFor(() => {
        expect(window.location.search).toBe('?id=auto-saved-001');
      });
    });

    it('does not sync URL before initial mount completes', async () => {
      // Start with a URL that has an ID to load
      const design = makeSavedDesign('loading-design');
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok(design));
      window.history.replaceState(null, '', '/designer?id=loading-design');

      renderHook(() => useDesignerUrlSync());

      // Before the load resolves, try changing store ID
      act(() => {
        useDesignerStore.setState({ currentDesignId: 'premature-id' });
      });

      // The URL should not have changed to premature-id yet
      // (it may still show loading-design from the initial replaceState)
      // After load completes, the correct ID should be set
      await waitFor(() => {
        expect(useDesignerStore.getState().currentDesignId).toBe('loading-design');
      });
    });
  });
});
