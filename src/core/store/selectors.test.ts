// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import {
  selectBins,
  selectLayers,
  useActiveLayerBins,
  useActiveLayer,
  useLayerBinCounts,
  useStagingBins,
  useSelectedBins,
} from '@/core/store/selectors';
import { resetAllStores, createTestLayout, createTestBin, expectOk } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';

describe('store selectors', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('selectBins', () => {
    it('extracts bins from layout state', () => {
      const state = useLayoutStore.getState();
      expect(selectBins(state)).toBe(state.layout.bins);
    });
  });

  describe('selectLayers', () => {
    it('extracts layers from layout state', () => {
      const state = useLayoutStore.getState();
      expect(selectLayers(state)).toBe(state.layout.layers);
    });
  });

  describe('useActiveLayerBins', () => {
    it('returns bins on the active layer only', () => {
      const layout = createTestLayout();
      const layerId = layout.layers[0].id;
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ activeLayerId: layerId });

      // Add bins on the active layer
      const result1 = useLayoutStore.getState().addBin(createTestBin({ layerId, x: 0, y: 0 }));
      expectOk(result1);
      const result2 = useLayoutStore.getState().addBin(createTestBin({ layerId, x: 2, y: 0 }));
      expectOk(result2);

      const { result } = renderHook(() => useActiveLayerBins());
      expect(result.current).toHaveLength(2);
      expect(result.current.every((b) => b.layerId === layerId)).toBe(true);
    });

    it('excludes staging bins', () => {
      const layout = createTestLayout();
      const layerId = layout.layers[0].id;
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ activeLayerId: layerId });

      // Add a grid bin and a staging bin
      expectOk(useLayoutStore.getState().addBin(createTestBin({ layerId, x: 0, y: 0 })));
      expectOk(
        useLayoutStore.getState().addBin(createTestBin({ layerId: STAGING_ID, x: 0, y: 0 }))
      );

      const { result } = renderHook(() => useActiveLayerBins());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].layerId).toBe(layerId);
    });

    it('returns empty array when active layer is staging', () => {
      const layout = createTestLayout();
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ activeLayerId: STAGING_ID });

      expectOk(
        useLayoutStore.getState().addBin(createTestBin({ layerId: STAGING_ID, x: 1, y: 1 }))
      );

      const { result } = renderHook(() => useActiveLayerBins());
      expect(result.current).toHaveLength(0);
    });

    it('returns empty array when no bins on active layer', () => {
      const layout = createTestLayout();
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ activeLayerId: layout.layers[0].id });

      const { result } = renderHook(() => useActiveLayerBins());
      expect(result.current).toHaveLength(0);
    });
  });

  describe('useActiveLayer', () => {
    it('returns the active layer object', () => {
      const layout = createTestLayout();
      const layerId = layout.layers[0].id;
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ activeLayerId: layerId });

      const { result } = renderHook(() => useActiveLayer());
      expect(result.current).toBeDefined();
      expect(result.current?.id).toBe(layerId);
    });

    it('returns undefined when active layer does not exist', () => {
      const layout = createTestLayout();
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ activeLayerId: 'nonexistent' as never });

      const { result } = renderHook(() => useActiveLayer());
      expect(result.current).toBeUndefined();
    });
  });

  describe('useLayerBinCounts', () => {
    it('counts bins per layer excluding staging', () => {
      const layout = createTestLayout();
      const layerId = layout.layers[0].id;
      useLayoutStore.setState({ layout });

      // Add 3 bins on the layer + 1 staging
      expectOk(useLayoutStore.getState().addBin(createTestBin({ layerId, x: 0, y: 0 })));
      expectOk(useLayoutStore.getState().addBin(createTestBin({ layerId, x: 1, y: 0 })));
      expectOk(useLayoutStore.getState().addBin(createTestBin({ layerId, x: 2, y: 0 })));
      expectOk(
        useLayoutStore.getState().addBin(createTestBin({ layerId: STAGING_ID, x: 0, y: 0 }))
      );

      const { result } = renderHook(() => useLayerBinCounts());
      expect(result.current.get(layerId)).toBe(3);
      expect(result.current.has(STAGING_ID)).toBe(false);
    });

    it('returns empty map when no bins', () => {
      const layout = createTestLayout();
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useLayerBinCounts());
      expect(result.current.size).toBe(0);
    });
  });

  describe('useStagingBins', () => {
    it('returns only staging bins', () => {
      const layout = createTestLayout();
      const layerId = layout.layers[0].id;
      useLayoutStore.setState({ layout });

      expectOk(useLayoutStore.getState().addBin(createTestBin({ layerId, x: 0, y: 0 })));
      expectOk(
        useLayoutStore.getState().addBin(createTestBin({ layerId: STAGING_ID, x: 0, y: 0 }))
      );
      expectOk(
        useLayoutStore.getState().addBin(createTestBin({ layerId: STAGING_ID, x: 1, y: 0 }))
      );

      const { result } = renderHook(() => useStagingBins());
      expect(result.current).toHaveLength(2);
      expect(result.current.every((b) => b.layerId === STAGING_ID)).toBe(true);
    });
  });

  describe('useSelectedBins', () => {
    it('returns full bin objects for selected IDs', () => {
      const layout = createTestLayout();
      const layerId = layout.layers[0].id;
      useLayoutStore.setState({ layout });

      const r1 = useLayoutStore.getState().addBin(createTestBin({ layerId, x: 0, y: 0 }));
      const r2 = useLayoutStore.getState().addBin(createTestBin({ layerId, x: 1, y: 0 }));
      const id1 = expectOk(r1);
      const id2 = expectOk(r2);

      useSelectionStore.setState({ selectedBinIds: [id1, id2] });

      const { result } = renderHook(() => useSelectedBins());
      expect(result.current).toHaveLength(2);
      expect(result.current.map((b) => b.id)).toContain(id1);
      expect(result.current.map((b) => b.id)).toContain(id2);
    });

    it('returns empty array when nothing selected', () => {
      useSelectionStore.setState({ selectedBinIds: [] });

      const { result } = renderHook(() => useSelectedBins());
      expect(result.current).toHaveLength(0);
    });

    it('filters out IDs that no longer exist in layout', () => {
      const layout = createTestLayout();
      const layerId = layout.layers[0].id;
      useLayoutStore.setState({ layout });

      const r1 = useLayoutStore.getState().addBin(createTestBin({ layerId, x: 0, y: 0 }));
      const id1 = expectOk(r1);

      // Select a valid ID and a fake one
      useSelectionStore.setState({ selectedBinIds: [id1, 'nonexistent' as never] });

      const { result } = renderHook(() => useSelectedBins());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe(id1);
    });
  });
});
