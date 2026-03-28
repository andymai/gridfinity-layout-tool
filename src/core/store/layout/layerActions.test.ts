import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { STAGING_ID, CONSTRAINTS } from '@/core/constants';
import { layerId } from '@/core/types';
import { isOk, isErr } from '@/core/result';
import { resetAllStores, expectOk } from '@/test/testUtils';

describe('layerActions', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('addLayer', () => {
    it('adds a layer and returns its id', () => {
      const result = useLayoutStore.getState().addLayer();
      expect(isOk(result)).toBe(true);
      expect(useLayoutStore.getState().layout.layers).toHaveLength(2);
    });

    it('returns error when at max layers', () => {
      // Set drawer height high enough to fit all layers
      useLayoutStore.getState().updateDrawer({ height: 100 });

      // Add layers up to max (already have 1)
      for (let i = 1; i < CONSTRAINTS.LAYERS_MAX; i++) {
        const r = useLayoutStore.getState().addLayer();
        expect(isOk(r)).toBe(true);
      }

      const result = useLayoutStore.getState().addLayer();
      expect(isErr(result)).toBe(true);
    });

    it('returns error when no remaining height in drawer', () => {
      // Set drawer height equal to existing layer height
      const layerHeight = useLayoutStore.getState().layout.layers[0].height;
      useLayoutStore.getState().updateDrawer({ height: layerHeight });

      const result = useLayoutStore.getState().addLayer();
      expect(isErr(result)).toBe(true);
    });
  });

  describe('updateLayer', () => {
    it('updates layer name', () => {
      const { layout, updateLayer } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      updateLayer(lid, { name: 'Renamed' });
      expect(useLayoutStore.getState().layout.layers[0].name).toBe('Renamed');
    });

    it('clamps layer height to available space', () => {
      const { layout, updateLayer } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      // Drawer height is 12, try to set layer to 100
      updateLayer(lid, { height: 100 });
      const h = useLayoutStore.getState().layout.layers[0].height;
      expect(h).toBeLessThanOrEqual(12);
    });

    it('clamps layer height to min', () => {
      const { layout, updateLayer } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      updateLayer(lid, { height: 0 });
      const h = useLayoutStore.getState().layout.layers[0].height;
      expect(h).toBeGreaterThanOrEqual(CONSTRAINTS.MIN_LAYER_HEIGHT);
    });

    it('returns error for non-existent layer', () => {
      const result = useLayoutStore.getState().updateLayer(layerId('ghost'), { name: 'X' });
      expect(isErr(result)).toBe(true);
    });
  });

  describe('deleteLayer', () => {
    it('deletes a layer and moves its bins to staging', () => {
      // Add a second layer first
      const addResult = useLayoutStore.getState().addLayer();
      const newLayerId = expectOk(addResult);

      // Add a bin to the new layer
      const { addBin, layout } = useLayoutStore.getState();
      addBin({
        layerId: newLayerId,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      // Delete the new layer
      const result = useLayoutStore.getState().deleteLayer(newLayerId);
      expectOk(result);
      expect(useLayoutStore.getState().layout.layers).toHaveLength(1);
      // Bin should be moved to staging
      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe(STAGING_ID);
    });

    it('returns error when deleting the last layer', () => {
      const { layout, deleteLayer } = useLayoutStore.getState();
      const result = deleteLayer(layout.layers[0].id);
      expect(isErr(result)).toBe(true);
    });

    it('returns error for non-existent layer', () => {
      // Need at least 2 layers to avoid "last entity" check
      useLayoutStore.getState().addLayer();
      const result = useLayoutStore.getState().deleteLayer(layerId('ghost'));
      expect(isErr(result)).toBe(true);
    });
  });

  describe('reorderLayers', () => {
    it('no-ops when from === to', () => {
      const result = useLayoutStore.getState().reorderLayers(0, 0);
      expectOk(result);
    });

    it('returns error for invalid source index', () => {
      const result = useLayoutStore.getState().reorderLayers(-1, 0);
      expect(isErr(result)).toBe(true);
    });

    it('returns error for invalid target index', () => {
      const result = useLayoutStore.getState().reorderLayers(0, 99);
      expect(isErr(result)).toBe(true);
    });

    it('reorders layers when no collisions', () => {
      // Add a second layer
      useLayoutStore.getState().addLayer();
      const layersBefore = useLayoutStore.getState().layout.layers.map((l) => l.id);
      expect(layersBefore).toHaveLength(2);

      const result = useLayoutStore.getState().reorderLayers(0, 1);
      expectOk(result);
      const layersAfter = useLayoutStore.getState().layout.layers.map((l) => l.id);
      expect(layersAfter[0]).toBe(layersBefore[1]);
      expect(layersAfter[1]).toBe(layersBefore[0]);
    });
  });
});
