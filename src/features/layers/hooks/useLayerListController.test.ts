// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayerListController } from './useLayerListController';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { resetAllStores } from '@/test/testUtils';
import { ok, err } from '@/core/result';
import { layerId } from '@/core/types';
import type { Layer } from '@/core/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const mutations = vi.hoisted(() => ({
  addLayer: vi.fn(),
  updateLayer: vi.fn(),
  deleteLayer: vi.fn(),
  reorderLayers: vi.fn(),
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => mutations,
}));

function seedLayers(layers: Layer[]): void {
  const state = useLayoutStore.getState();
  useLayoutStore.setState({ layout: { ...state.layout, layers } });
}

const layerA: Layer = { id: layerId('layer-a'), name: 'A', height: 3 as Layer['height'] };
const layerB: Layer = { id: layerId('layer-b'), name: 'B', height: 3 as Layer['height'] };

describe('useLayerListController', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    mutations.updateLayer.mockReturnValue(ok(undefined));
    mutations.deleteLayer.mockReturnValue(ok(undefined));
    mutations.reorderLayers.mockReturnValue(ok(undefined));
    mutations.addLayer.mockReturnValue(ok(layerId('new-layer')));
    seedLayers([layerA, layerB]);
    useSelectionStore.getState().setActiveLayer(layerA.id);
  });

  it('reverses array order for display (top layer first)', () => {
    const { result } = renderHook(() => useLayerListController());
    expect(result.current.layers.map((l) => l.name)).toEqual(['A', 'B']);
    expect(result.current.displayLayers.map((l) => l.name)).toEqual(['B', 'A']);
  });

  it('adds a layer and activates it', () => {
    const { result } = renderHook(() => useLayerListController());
    act(() => {
      result.current.addLayerWithAutoExpand();
    });
    expect(mutations.addLayer).toHaveBeenCalledTimes(1);
    expect(useSelectionStore.getState().activeLayerId).toBe(layerId('new-layer'));
  });

  it('maps display indices to array indices when reordering', () => {
    const { result } = renderHook(() => useLayerListController());
    act(() => {
      // Move display-top (array index 1) to display-bottom (array index 0).
      result.current.reorderByDisplayIndex(0, 1);
    });
    expect(mutations.reorderLayers).toHaveBeenCalledWith(1, 0);
  });

  it('ignores out-of-range reorder targets', () => {
    const { result } = renderHook(() => useLayerListController());
    act(() => {
      result.current.reorderByDisplayIndex(0, -1);
    });
    expect(mutations.reorderLayers).not.toHaveBeenCalled();
  });

  it('routes reorder errors to onReorderError when provided', () => {
    mutations.reorderLayers.mockReturnValue(err({ code: 'LAYOUT_LAYER_LIMIT' } as never));
    const onReorderError = vi.fn();
    const { result } = renderHook(() => useLayerListController({ onReorderError }));
    act(() => {
      result.current.reorderByDisplayIndex(0, 1);
    });
    expect(onReorderError).toHaveBeenCalledTimes(1);
  });

  it('delete flow: request opens, confirm deletes and reassigns the active layer', () => {
    const { result } = renderHook(() => useLayerListController());
    act(() => {
      result.current.requestDelete(layerA.id);
    });
    expect(result.current.deleteLayerId).toBe(layerA.id);
    expect(result.current.layerToDelete?.name).toBe('A');
    act(() => {
      result.current.confirmDelete();
    });
    expect(mutations.deleteLayer).toHaveBeenCalledWith(layerA.id);
    expect(useSelectionStore.getState().activeLayerId).toBe(layerB.id);
    expect(result.current.deleteLayerId).toBeNull();
  });

  it('requestDelete is a no-op at the minimum layer count', () => {
    seedLayers([layerA]);
    const { result } = renderHook(() => useLayerListController());
    act(() => {
      result.current.requestDelete(layerA.id);
    });
    expect(result.current.deleteLayerId).toBeNull();
  });

  it('clamps height changes at the minimum layer height', () => {
    seedLayers([{ ...layerA, height: 2 as Layer['height'] }, layerB]);
    const { result } = renderHook(() => useLayerListController());
    act(() => {
      result.current.changeLayerHeight(layerA.id, -1);
    });
    expect(mutations.updateLayer).toHaveBeenCalledWith(layerA.id, { height: 2 });
  });

  it('truncates renames to the label length limit', () => {
    const { result } = renderHook(() => useLayerListController());
    act(() => {
      result.current.renameLayer(layerA.id, 'x'.repeat(500));
    });
    const [, patch] = mutations.updateLayer.mock.calls[0] as [unknown, { name: string }];
    expect(patch.name.length).toBeLessThan(500);
  });
});
