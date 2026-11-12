import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectionActions } from './useSelectionActions';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { createTestLayout, createTestBin, resetAllStores } from '@/test/testUtils';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

describe('useSelectionActions', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('setCategory', () => {
    it('updates category on all selected bins', () => {
      const bins = [
        createTestBin({ id: binId('a'), x: gridUnits(0), y: gridUnits(0) }),
        createTestBin({ id: binId('b'), x: gridUnits(3), y: gridUnits(0) }),
      ];
      useLayoutStore.setState({ layout: createTestLayout({ bins }) });
      useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.setCategory(categoryId('new-cat'));
      });

      const updatedBins = useLayoutStore.getState().layout.bins;
      expect(updatedBins.every((b) => b.category === categoryId('new-cat'))).toBe(true);
    });
  });

  describe('rotateAll', () => {
    it('swaps width and depth on selected bins', () => {
      const bins = [
        createTestBin({
          id: binId('a'),
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(2),
          depth: gridUnits(3),
        }),
        createTestBin({
          id: binId('b'),
          x: gridUnits(5),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(4),
        }),
      ];
      useLayoutStore.setState({ layout: createTestLayout({ bins }) });
      useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.rotateAll();
      });

      const updatedBins = useLayoutStore.getState().layout.bins;
      const binA = updatedBins.find((b) => b.id === binId('a'));
      expect(binA?.width).toBe(3);
      expect(binA?.depth).toBe(2);
    });

    it('skips square bins', () => {
      const bins = [
        createTestBin({
          id: binId('a'),
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(2),
          depth: gridUnits(2),
        }),
        createTestBin({
          id: binId('b'),
          x: gridUnits(5),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(3),
        }),
      ];
      useLayoutStore.setState({ layout: createTestLayout({ bins }) });
      useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.rotateAll();
      });

      // Square bin 'a' unchanged
      const binA = useLayoutStore.getState().layout.bins.find((b) => b.id === binId('a'));
      expect(binA?.width).toBe(2);
      expect(binA?.depth).toBe(2);
    });
  });

  describe('rotateAll and locks', () => {
    it('leaves a size-locked bin unrotated and counts it as skipped', () => {
      const bins = [
        createTestBin({
          id: binId('a'),
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(2),
          depth: gridUnits(3),
          locked: true,
        }),
      ];
      useLayoutStore.setState({ layout: createTestLayout({ bins }) });
      useSelectionStore.setState({ selectedBinIds: [binId('a')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.rotateAll();
      });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.width).toBe(2);
      expect(bin.depth).toBe(3);
    });
  });

  describe('matchHeight', () => {
    it('sets all selected bins to the tallest height', () => {
      const bins = [
        createTestBin({ id: binId('a'), x: gridUnits(0), y: gridUnits(0), height: heightUnits(2) }),
        createTestBin({ id: binId('b'), x: gridUnits(3), y: gridUnits(0), height: heightUnits(5) }),
        createTestBin({ id: binId('c'), x: gridUnits(6), y: gridUnits(0), height: heightUnits(3) }),
      ];
      useLayoutStore.setState({ layout: createTestLayout({ bins }) });
      useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b'), binId('c')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.matchHeight();
      });

      const updatedBins = useLayoutStore.getState().layout.bins;
      expect(updatedBins.every((b) => b.height === 5)).toBe(true);
    });
  });

  describe('moveToLayer', () => {
    it('moves selected bins to the target layer', () => {
      const layout = createTestLayout({
        layers: [
          { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
        ],
        bins: [
          createTestBin({
            id: binId('a'),
            x: gridUnits(0),
            y: gridUnits(0),
            layerId: layerId('layer1'),
          }),
          createTestBin({
            id: binId('b'),
            x: gridUnits(3),
            y: gridUnits(0),
            layerId: layerId('layer1'),
          }),
        ],
      });
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.moveToLayer(layerId('layer2'));
      });

      const updatedBins = useLayoutStore.getState().layout.bins;
      expect(updatedBins.every((b) => b.layerId === layerId('layer2'))).toBe(true);
      // Selection should be cleared after move
      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    });

    // A locked bin still moves; only its size is frozen. Sending the target
    // layer's default height with it would make `bin.update` reject the whole
    // write, leaving the bin behind while the toast claimed it had moved.
    it('moves a size-locked bin without adopting the layer height', () => {
      const layout = createTestLayout({
        layers: [
          { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(6) },
        ],
        bins: [
          createTestBin({
            id: binId('a'),
            x: gridUnits(0),
            y: gridUnits(0),
            height: heightUnits(3),
            layerId: layerId('layer1'),
            locked: true,
          }),
        ],
      });
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('a')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.moveToLayer(layerId('layer2'));
      });

      const moved = useLayoutStore.getState().layout.bins[0];
      expect(moved.layerId).toBe(layerId('layer2'));
      expect(moved.height).toBe(3);
    });
  });

  describe('moveToStash', () => {
    it('moves all selected bins to staging and clears selection', () => {
      const bins = [
        createTestBin({ id: binId('a'), x: gridUnits(0), y: gridUnits(0) }),
        createTestBin({ id: binId('b'), x: gridUnits(3), y: gridUnits(0) }),
      ];
      useLayoutStore.setState({ layout: createTestLayout({ bins }) });
      useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.moveToStash();
      });

      const updatedBins = useLayoutStore.getState().layout.bins;
      expect(updatedBins.every((b) => b.layerId === STAGING_ID)).toBe(true);
      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
    });

    it('stashes a full layer in one store update and one undo step', () => {
      const bins: Bin[] = [];
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 8; y++) {
          bins.push(createTestBin({ id: binId(`f-${x}-${y}`), x: gridUnits(x), y: gridUnits(y) }));
        }
      }
      useLayoutStore.setState({ layout: createTestLayout({ bins }) });
      useSelectionStore.setState({ selectedBinIds: bins.map((b) => b.id) });
      useHistoryStore.getState().clear();
      const { result } = renderHook(() => useSelectionActions());
      let storeUpdates = 0;
      const unsubscribe = useLayoutStore.subscribe(() => {
        storeUpdates++;
      });

      act(() => {
        result.current.moveToStash();
      });
      unsubscribe();

      expect(storeUpdates).toBe(1);
      expect(useLayoutStore.getState().layout.bins.every((b) => b.layerId === STAGING_ID)).toBe(
        true
      );
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Moved 80 bins to stash');
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });
  });

  describe('deleteAll', () => {
    it('deletes all selected bins and clears selection', () => {
      const bins = [
        createTestBin({ id: binId('a'), x: gridUnits(0), y: gridUnits(0) }),
        createTestBin({ id: binId('b'), x: gridUnits(3), y: gridUnits(0) }),
        createTestBin({ id: binId('c'), x: gridUnits(6), y: gridUnits(0) }),
      ];
      useLayoutStore.setState({ layout: createTestLayout({ bins }) });
      useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });

      const { result } = renderHook(() => useSelectionActions());

      act(() => {
        result.current.deleteAll();
      });

      // Only 'c' should remain
      const updatedBins = useLayoutStore.getState().layout.bins;
      expect(updatedBins).toHaveLength(1);
      expect(updatedBins[0].id).toBe(binId('c'));
      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    });
  });

  describe('undo label', () => {
    function undoToast(): string | undefined {
      act(() => {
        useHistoryStore.getState().undo();
      });
      return useToastStore.getState().toasts.at(-1)?.message;
    }

    function seedTwoLayers(): void {
      const layout = createTestLayout({
        layers: [
          { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
        ],
        bins: [
          createTestBin({
            id: binId('a'),
            layerId: layerId('layer1'),
            x: gridUnits(0),
            width: gridUnits(1),
            depth: gridUnits(2),
            height: heightUnits(2),
          }),
          createTestBin({
            id: binId('b'),
            layerId: layerId('layer1'),
            x: gridUnits(3),
            width: gridUnits(1),
            depth: gridUnits(2),
            height: heightUnits(3),
          }),
          createTestBin({
            id: binId('c'),
            layerId: layerId('layer1'),
            x: gridUnits(6),
            width: gridUnits(1),
            depth: gridUnits(2),
            height: heightUnits(1),
          }),
        ],
      });
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b'), binId('c')] });
      useHistoryStore.getState().clear();
    }

    beforeEach(seedTwoLayers);

    it('names setCategory after the bins it updated', () => {
      const { result } = renderHook(() => useSelectionActions());
      act(() => {
        result.current.setCategory(categoryId('new-cat'));
      });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(undoToast()).toBe('↩ Undid: Updated 3 bins');
    });

    it('names rotateAll after the bins it updated', () => {
      const { result } = renderHook(() => useSelectionActions());
      act(() => {
        result.current.rotateAll();
      });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(undoToast()).toBe('↩ Undid: Updated 3 bins');
    });

    it('names matchHeight after the bins it updated', () => {
      const { result } = renderHook(() => useSelectionActions());
      act(() => {
        result.current.matchHeight();
      });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(undoToast()).toBe('↩ Undid: Updated 2 bins');
    });

    it('names moveToLayer after the bins it updated', () => {
      const { result } = renderHook(() => useSelectionActions());
      act(() => {
        result.current.moveToLayer(layerId('layer2'));
      });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(undoToast()).toBe('↩ Undid: Updated 3 bins');
    });

    it('names moveToStash as a move to the stash', () => {
      const { result } = renderHook(() => useSelectionActions());
      act(() => {
        result.current.moveToStash();
      });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(undoToast()).toBe('↩ Undid: Moved bins to stash');
    });

    it('names deleteAll as a delete', () => {
      const { result } = renderHook(() => useSelectionActions());
      act(() => {
        result.current.deleteAll();
      });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(undoToast()).toBe('↩ Undid: Deleted bins');
      expect(useLayoutStore.getState().layout.bins).toHaveLength(3);
    });
  });
});
