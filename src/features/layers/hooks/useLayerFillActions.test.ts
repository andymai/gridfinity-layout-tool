// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayerFillActions } from './useLayerFillActions';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useToastStore } from '@/core/store/toast';
import { resetAllStores, createTestBin } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const mutations = vi.hoisted(() => ({
  fillLayer: vi.fn(),
  fillLayerGaps: vi.fn(),
  clearLayer: vi.fn(),
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => mutations,
}));

function activeLayerId(): string {
  const id = useSelectionStore.getState().activeLayerId;
  if (!id) throw new Error('no active layer in test setup');
  return id;
}

describe('useLayerFillActions', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    vi.useFakeTimers();
    const firstLayer = useLayoutStore.getState().layout.layers[0];
    useSelectionStore.getState().setActiveLayer(firstLayer.id);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the active layer and empty-cell count', () => {
    const { result } = renderHook(() => useLayerFillActions());
    expect(result.current.activeLayer?.id).toBe(activeLayerId());
    const { drawer } = useLayoutStore.getState().layout;
    expect(result.current.totalCells).toBe(drawer.width * drawer.depth);
    expect(result.current.emptyCells).toBeLessThanOrEqual(result.current.totalCells);
  });

  it('fillGaps dispatches the mutation and runs onAfterAction synchronously', () => {
    const onAfterAction = vi.fn();
    const { result } = renderHook(() => useLayerFillActions({ onAfterAction }));
    act(() => {
      result.current.fillGaps();
    });
    expect(mutations.fillLayerGaps).toHaveBeenCalledWith(
      activeLayerId(),
      expect.anything(),
      expect.any(Boolean)
    );
    expect(onAfterAction).toHaveBeenCalledTimes(1);
  });

  it('toasts the added count after the batch commits', () => {
    const layerId = activeLayerId();
    mutations.fillLayerGaps.mockImplementation(() => {
      const state = useLayoutStore.getState();
      useLayoutStore.setState({
        layout: {
          ...state.layout,
          bins: [...state.layout.bins, createTestBin({ layerId })],
        },
      });
    });
    const { result } = renderHook(() => useLayerFillActions());
    act(() => {
      result.current.fillGaps();
      vi.runAllTimers();
    });
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((toast) => toast.message.startsWith('toast.fillComplete'))).toBe(true);
  });

  it('confirmClear clears, deselects, closes the dialog, then runs onAfterAction', () => {
    const layerId = activeLayerId();
    const state = useLayoutStore.getState();
    useLayoutStore.setState({
      layout: { ...state.layout, bins: [createTestBin({ layerId })] },
    });
    useSelectionStore.getState().setSelectedBins(['some-bin']);

    const onAfterAction = vi.fn();
    const { result } = renderHook(() => useLayerFillActions({ onAfterAction }));
    act(() => {
      result.current.setClearConfirmOpen(true);
    });
    act(() => {
      result.current.confirmClear();
    });
    expect(mutations.clearLayer).toHaveBeenCalledWith(layerId);
    expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    expect(result.current.clearConfirmOpen).toBe(false);
    expect(onAfterAction).toHaveBeenCalledTimes(1);
  });

  it('confirmClear is a no-op on an empty layer', () => {
    const { result } = renderHook(() => useLayerFillActions());
    act(() => {
      result.current.confirmClear();
    });
    expect(mutations.clearLayer).not.toHaveBeenCalled();
  });

  it('fillWithSize dispatches, exits paint mode, and runs onAfterAction', () => {
    useInteractionStore.getState().setPaintSize({ width: 2, depth: 3 });
    const onAfterAction = vi.fn();
    const { result } = renderHook(() => useLayerFillActions({ onAfterAction }));
    act(() => {
      result.current.fillWithSize(2, 3);
    });
    expect(mutations.fillLayer).toHaveBeenCalledWith(
      activeLayerId(),
      2,
      3,
      expect.anything(),
      expect.any(Boolean)
    );
    expect(useInteractionStore.getState().paintSize).toBeNull();
    expect(onAfterAction).toHaveBeenCalledTimes(1);
  });
});
