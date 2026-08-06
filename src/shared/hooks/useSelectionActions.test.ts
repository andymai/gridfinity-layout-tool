import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectionActions } from './useSelectionActions';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { createTestLayout, createTestBin, resetAllStores } from '@/test/testUtils';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';
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
});
