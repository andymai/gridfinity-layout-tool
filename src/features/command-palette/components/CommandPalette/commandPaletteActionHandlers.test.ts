import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionHandlers } from './commandPaletteActionHandlers';
import { useHalfGridModeStore, useLayoutStore, useToastStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { connectSelectionPruning, eventBus } from '@/core/cqrs';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { createTestBin, createTestLayout, getBinId, resetAllStores } from '@/test/testUtils';
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

function fullLayer(onLayer: Bin['layerId']): Bin[] {
  const bins: Bin[] = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 8; y++) {
      bins.push(
        createTestBin({
          id: binId(`f-${x}-${y}`),
          layerId: onLayer,
          x: gridUnits(x),
          y: gridUnits(y),
        })
      );
    }
  }
  return bins;
}

function knifeBlockPair(): Bin[] {
  return [
    createTestBin({ id: binId('block'), layerId: L1, pairId: 'p1', pairRole: 'block' }),
    createTestBin({
      id: binId('rest'),
      layerId: L1,
      x: gridUnits(3),
      pairId: 'p1',
      pairRole: 'rest',
    }),
  ];
}

function countStoreUpdates(run: () => void): number {
  let updates = 0;
  const unsubscribe = useLayoutStore.subscribe(() => {
    updates++;
  });
  run();
  unsubscribe();
  return updates;
}

describe('bulk bin actions', () => {
  let unsubscribePruning: () => void;

  beforeEach(() => {
    resetAllStores();
    unsubscribePruning = connectSelectionPruning(eventBus);
    useLayoutStore.setState({ layout: createTestLayout() });
    useSelectionStore.getState().setActiveLayer(L1);
    useHistoryStore.getState().clear();
  });

  afterEach(() => {
    unsubscribePruning();
  });

  function seed(bins: Bin[], selected: string[] = []): void {
    useLayoutStore.setState({ layout: { ...useLayoutStore.getState().layout, bins } });
    useSelectionStore.getState().setSelectedBins(selected.map(binId));
  }

  function run(command: string): number {
    const { result } = renderHook(() => useActionHandlers());
    return countStoreUpdates(() => {
      act(() => {
        result.current[command]?.();
      });
    });
  }

  describe('move-to-stash', () => {
    it('stashes the selection as one undo step and clears it', () => {
      seed(
        [
          createTestBin({ id: binId('a'), layerId: L1, x: gridUnits(0), y: gridUnits(0) }),
          createTestBin({ id: binId('b'), layerId: L1, x: gridUnits(3), y: gridUnits(2) }),
        ],
        ['a', 'b']
      );

      run('move-to-stash');

      expect(placement('a')).toEqual({ layerId: STAGING_ID, x: 0, y: 0 });
      expect(placement('b')).toEqual({ layerId: STAGING_ID, x: 3, y: 2 });
      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Moved 2 bins to stash');
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('also drops a selected bin that was already in the stash from the selection', () => {
      seed(
        [
          createTestBin({ id: binId('a'), layerId: L1 }),
          createTestBin({ id: binId('stashed'), layerId: STAGING_ID }),
        ],
        ['a', 'stashed']
      );

      run('move-to-stash');

      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    });

    it("takes a paired bin's partner along", () => {
      seed(knifeBlockPair(), ['block']);

      run('move-to-stash');

      expect(placement('block')?.layerId).toBe(STAGING_ID);
      expect(placement('rest')?.layerId).toBe(STAGING_ID);
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Moved 2 bins to stash');
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('stashes a full layer in one store update', () => {
      const bins = fullLayer(L1);
      seed(
        bins,
        bins.map((b) => b.id)
      );

      expect(run('move-to-stash')).toBe(1);
      expect(useLayoutStore.getState().layout.bins.every((b) => b.layerId === STAGING_ID)).toBe(
        true
      );
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });
  });

  describe('delete-selected', () => {
    it('deletes the selection as one undo step and clears it', () => {
      seed(
        [
          createTestBin({ id: binId('a'), layerId: L1, x: gridUnits(0) }),
          createTestBin({ id: binId('b'), layerId: L1, x: gridUnits(3) }),
          createTestBin({ id: binId('kept'), layerId: L1, x: gridUnits(6) }),
        ],
        ['a', 'b']
      );

      run('delete-selected');

      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual([binId('kept')]);
      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it("takes a paired bin's partner along", () => {
      seed(knifeBlockPair(), ['rest']);

      run('delete-selected');

      expect(useLayoutStore.getState().layout.bins).toEqual([]);
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('deletes a full layer in one store update', () => {
      const bins = fullLayer(L1);
      seed(
        bins,
        bins.map((b) => b.id)
      );

      expect(run('delete-selected')).toBe(1);
      expect(useLayoutStore.getState().layout.bins).toEqual([]);
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });
  });

  describe('clear-staging', () => {
    it('deletes every stashed bin as one undo step', () => {
      seed([
        createTestBin({ id: binId('s1'), layerId: STAGING_ID }),
        createTestBin({ id: binId('s2'), layerId: STAGING_ID }),
        createTestBin({ id: binId('placed'), layerId: L1 }),
      ]);

      run('clear-staging');

      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual([binId('placed')]);
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Cleared 2 bins from stash');
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('clears a full stash in one store update', () => {
      seed(fullLayer(STAGING_ID));

      expect(run('clear-staging')).toBe(1);
      expect(useLayoutStore.getState().layout.bins).toEqual([]);
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });
  });

  describe('restore-from-staging', () => {
    it('returns the stash to the active layer at its own positions, as one undo step', () => {
      seed([
        createTestBin({ id: binId('s1'), layerId: STAGING_ID, x: gridUnits(0), y: gridUnits(0) }),
        createTestBin({ id: binId('s2'), layerId: STAGING_ID, x: gridUnits(4), y: gridUnits(2) }),
      ]);

      run('restore-from-staging');

      expect(placement('s1')).toEqual({ layerId: L1, x: 0, y: 0 });
      expect(placement('s2')).toEqual({ layerId: L1, x: 4, y: 2 });
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Restored 2 bins from stash');
      expect(useHistoryStore.getState().past).toHaveLength(1);

      act(() => {
        useHistoryStore.getState().undo();
      });

      expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
        '↩ Undid: Moved bins from stash'
      );
      expect(placement('s1')).toEqual({ layerId: STAGING_ID, x: 0, y: 0 });
    });

    it('stops at the first stashed bin that does not fit', () => {
      seed([
        createTestBin({ id: binId('occupant'), layerId: L1, x: gridUnits(2), y: gridUnits(0) }),
        createTestBin({ id: binId('s1'), layerId: STAGING_ID, x: gridUnits(0), y: gridUnits(0) }),
        createTestBin({ id: binId('blocked'), layerId: STAGING_ID, x: gridUnits(2) }),
        createTestBin({ id: binId('s3'), layerId: STAGING_ID, x: gridUnits(4) }),
      ]);

      run('restore-from-staging');

      expect(placement('s1')?.layerId).toBe(L1);
      expect(placement('blocked')?.layerId).toBe(STAGING_ID);
      expect(placement('s3')?.layerId).toBe(STAGING_ID);
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('restores a full stash in one store update', () => {
      seed(fullLayer(STAGING_ID));

      expect(run('restore-from-staging')).toBe(1);
      expect(useLayoutStore.getState().layout.bins.every((b) => b.layerId === L1)).toBe(true);
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });
  });
});

describe('useActionHandlers', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('add-layer', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('names the layer limit when the layout is full', () => {
      const limits: { readonly LAYERS_MAX: number } = CONSTRAINTS;
      vi.spyOn(limits, 'LAYERS_MAX', 'get').mockReturnValue(2);
      useLayoutStore.setState({
        layout: createTestLayout({
          layers: [
            { id: L1, name: 'Layer 1', height: heightUnits(3) },
            { id: L2, name: 'Layer 2', height: heightUnits(3) },
          ],
        }),
      });
      const { result } = renderHook(() => useActionHandlers());

      act(() => {
        result.current['add-layer']?.();
      });

      expect(useLayoutStore.getState().layout.layers).toHaveLength(2);
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Maximum 2 layers reached');
    });
  });

  describe('toggle-half-bin', () => {
    it('opens the shared turn-off dialog, not a toast, when a bin sits on a half unit', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      const { layout, addBin } = useLayoutStore.getState();
      const id = getBinId(
        addBin({
          layerId: layout.layers[0].id,
          x: gridUnits(0.5),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(1),
          height: heightUnits(3),
          category: layout.categories[0].id,
          label: '',
          notes: '',
        })
      );
      const { result } = renderHook(() => useActionHandlers());

      act(() => {
        result.current['toggle-half-bin']?.();
      });

      expect(useHalfGridModeStore.getState().halfGridMode).toBe(true);
      expect(useHalfGridModeStore.getState().blockedViolation).toEqual({
        type: 'fractional_bins_exist',
        binIds: [id],
        count: 1,
      });
      expect(useToastStore.getState().toasts).toEqual([]);
    });

    it('turns the mode on', () => {
      const { result } = renderHook(() => useActionHandlers());

      act(() => {
        result.current['toggle-half-bin']?.();
      });

      expect(useHalfGridModeStore.getState().halfGridMode).toBe(true);
    });
  });
});
