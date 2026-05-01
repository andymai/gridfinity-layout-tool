import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { resetAllStores, expectOk } from '@/test/testUtils';

describe('bulkActions', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('clearLayer', () => {
    it('returns 0 when layer has no bins', () => {
      const { layout, clearLayer } = useLayoutStore.getState();
      const count = clearLayer(layout.layers[0].id);
      expect(count).toBe(0);
    });

    it('removes all bins from the specified layer', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      const cid = layout.categories[0].id;

      addBin({
        layerId: lid,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: cid,
        label: '',
        notes: '',
      });
      addBin({
        layerId: lid,
        x: 2,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: cid,
        label: '',
        notes: '',
      });

      const count = useLayoutStore.getState().clearLayer(lid);
      expect(count).toBe(2);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('only removes bins from the target layer', () => {
      const { addBin, addLayer, layout } = useLayoutStore.getState();
      const lid1 = layout.layers[0].id;
      const cid = layout.categories[0].id;

      // Add second layer
      const lid2 = expectOk(addLayer());

      addBin({
        layerId: lid1,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: cid,
        label: '',
        notes: '',
      });
      addBin({
        layerId: lid2,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: cid,
        label: '',
        notes: '',
      });

      const count = useLayoutStore.getState().clearLayer(lid1);
      expect(count).toBe(1);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe(lid2);
    });
  });

  describe('fillLayer', () => {
    it('returns number of bins added', () => {
      const { fillLayer, layout } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      const cid = layout.categories[0].id;

      // Fill a 10x8 grid with 1x1 bins = up to 80 bins
      const count = fillLayer(lid, 1, 1, cid);
      expect(count).toBeGreaterThan(0);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(count);
    });

    it('returns 0 when layer is already full', () => {
      const { fillLayer, layout } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      const cid = layout.categories[0].id;

      fillLayer(lid, 1, 1, cid);
      const firstCount = useLayoutStore.getState().layout.bins.length;

      const secondCount = useLayoutStore.getState().fillLayer(lid, 1, 1, cid);
      expect(secondCount).toBe(0);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(firstCount);
    });
  });

  describe('fillLayerGaps', () => {
    it('fills remaining gaps in a partially filled layer', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      const cid = layout.categories[0].id;

      // Place one bin, leaving gaps
      addBin({
        layerId: lid,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: cid,
        label: '',
        notes: '',
      });
      const addedCount = useLayoutStore.getState().fillLayerGaps(lid, cid);
      expect(addedCount).toBeGreaterThan(0);
    });

    it('returns 0 when layer is full', () => {
      const { fillLayer, layout } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      const cid = layout.categories[0].id;

      fillLayer(lid, 1, 1, cid);
      const addedCount = useLayoutStore.getState().fillLayerGaps(lid, cid);
      expect(addedCount).toBe(0);
    });
  });
});
