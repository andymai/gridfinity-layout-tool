import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDesignerInit } from '../../hooks/useDesignerInit';
import { useDesignerStore } from '../../store/designer';
import * as DesignerStorage from '@/features/bin-designer/storage/DesignerStorage';
import { ok, err, storageUnavailable } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '../../constants/defaults';
import type { SavedDesign } from '../../types';

vi.mock('@/features/bin-designer/storage/DesignerStorage');
vi.mock('@/hooks/useDesignerRouting', () => ({
  useDesignerRouting: () => ({
    designIdFromUrl: null,
    syncUrlToDesign: vi.fn(),
  }),
}));

describe('useDesignerInit', () => {
  const mockDesign: SavedDesign = {
    id: 'init-design-123',
    name: 'Untitled Bin',
    params: { ...DEFAULT_BIN_PARAMS },
    thumbnail: null,
    createdAt: '2026-01-27T00:00:00.000Z',
    updatedAt: '2026-01-27T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store to clean state
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      currentDesignId: null,
      designName: 'Untitled Bin',
      saveStatus: 'idle',
      history: { past: [], future: [] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a new design on first load when no design exists', async () => {
    vi.mocked(DesignerStorage.initializeDesigner).mockResolvedValue(ok(mockDesign));
    vi.mocked(DesignerStorage.setActiveDesignId).mockImplementation(() => {});

    renderHook(() => useDesignerInit());

    await waitFor(() => {
      expect(DesignerStorage.initializeDesigner).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(useDesignerStore.getState().currentDesignId).toBe('init-design-123');
    });

    expect(DesignerStorage.setActiveDesignId).toHaveBeenCalledWith('init-design-123');
  });

  it('should not initialize when currentDesignId is already set', async () => {
    useDesignerStore.setState({ currentDesignId: 'existing-design' });

    renderHook(() => useDesignerInit());

    // Give it time to potentially call initializeDesigner
    await new Promise((r) => setTimeout(r, 50));

    expect(DesignerStorage.initializeDesigner).not.toHaveBeenCalled();
  });

  it('should create a new design after newDesign() is called', async () => {
    // Start with an existing design
    useDesignerStore.setState({ currentDesignId: 'existing-design' });

    vi.mocked(DesignerStorage.createNewDesign).mockResolvedValue(ok(mockDesign));
    vi.mocked(DesignerStorage.setActiveDesignId).mockImplementation(() => {});

    const { rerender } = renderHook(() => useDesignerInit());

    // Simulate user clicking "New Design" which sets currentDesignId to null
    act(() => {
      useDesignerStore.getState().newDesign();
    });

    rerender();

    await waitFor(() => {
      expect(DesignerStorage.createNewDesign).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(useDesignerStore.getState().currentDesignId).toBe('init-design-123');
    });
  });

  it('should handle initialization error gracefully', async () => {
    vi.mocked(DesignerStorage.initializeDesigner).mockResolvedValue(
      err(storageUnavailable('indexedDB', new Error('storage error')))
    );

    renderHook(() => useDesignerInit());

    await waitFor(() => {
      expect(DesignerStorage.initializeDesigner).toHaveBeenCalled();
    });

    // Should not crash, currentDesignId stays null
    expect(useDesignerStore.getState().currentDesignId).toBeNull();
  });
});
