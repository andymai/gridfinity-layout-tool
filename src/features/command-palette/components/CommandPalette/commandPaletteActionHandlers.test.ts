import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionHandlers } from './commandPaletteActionHandlers';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { STAGING_ID } from '@/core/constants';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin } from '@/core/types';

const L1 = layerId('layer1');
const L2 = layerId('layer2');

function placement(id: string) {
  const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId(id));
  return bin && { layerId: bin.layerId, x: bin.x, y: bin.y };
}

describe('clear-layer', () => {
  beforeEach(() => {
    resetAllStores();
    useLayoutStore.setState({
      layout: createTestLayout({
        layers: [
          { id: L1, name: 'Layer 1', height: heightUnits(3) },
          { id: L2, name: 'Layer 2', height: heightUnits(3) },
        ],
        bins: [
          createTestBin({ id: binId('a'), layerId: L1, x: gridUnits(0), y: gridUnits(0) }),
          createTestBin({ id: binId('b'), layerId: L1, x: gridUnits(3), y: gridUnits(2) }),
          createTestBin({ id: binId('above'), layerId: L2, x: gridUnits(0), y: gridUnits(0) }),
        ],
      }),
    });
    useSelectionStore.getState().setActiveLayer(L1);
    useSelectionStore.getState().setSelectedBins([binId('a')]);
    useHistoryStore.getState().clear();
  });

  it('moves the bins on the active layer to the stash, as one undo step', () => {
    const { result } = renderHook(() => useActionHandlers());

    act(() => {
      result.current['clear-layer']?.();
    });

    expect(useLayoutStore.getState().layout.bins).toHaveLength(3);
    expect(placement('a')).toEqual({ layerId: STAGING_ID, x: 0, y: 0 });
    expect(placement('b')).toEqual({ layerId: STAGING_ID, x: 3, y: 2 });
    expect(placement('above')).toEqual({ layerId: L2, x: 0, y: 0 });
    expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Cleared 2 bins from layer');
    expect(useHistoryStore.getState().past).toHaveLength(1);

    act(() => {
      useHistoryStore.getState().undo();
    });

    expect(placement('a')).toEqual({ layerId: L1, x: 0, y: 0 });
    expect(placement('b')).toEqual({ layerId: L1, x: 3, y: 2 });
  });

  it('changes nothing on an empty layer', () => {
    useSelectionStore.getState().setActiveLayer(L2);
    useLayoutStore.setState({
      layout: {
        ...useLayoutStore.getState().layout,
        bins: useLayoutStore.getState().layout.bins.filter((b) => b.layerId !== L2),
      },
    });
    const before = useLayoutStore.getState().layout;
    const { result } = renderHook(() => useActionHandlers());

    act(() => {
      result.current['clear-layer']?.();
    });

    expect(useLayoutStore.getState().layout).toBe(before);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it('moves a full layer to the stash in one store update', () => {
    const bins: Bin[] = [];
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 8; y++) {
        bins.push(
          createTestBin({ id: binId(`f-${x}-${y}`), layerId: L1, x: gridUnits(x), y: gridUnits(y) })
        );
      }
    }
    useLayoutStore.setState({ layout: { ...useLayoutStore.getState().layout, bins } });
    let storeUpdates = 0;
    const unsubscribe = useLayoutStore.subscribe(() => {
      storeUpdates++;
    });
    const { result } = renderHook(() => useActionHandlers());

    act(() => {
      result.current['clear-layer']?.();
    });
    unsubscribe();

    expect(storeUpdates).toBe(1);
    expect(placement('f-9-7')).toEqual({ layerId: STAGING_ID, x: 9, y: 7 });
    expect(useLayoutStore.getState().layout.bins.every((b) => b.layerId === STAGING_ID)).toBe(true);
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Cleared 80 bins from layer');
    expect(useHistoryStore.getState().past).toHaveLength(1);
  });
});
