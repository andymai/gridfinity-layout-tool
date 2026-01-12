import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../../store/layout';
import { createDefaultLayout, STAGING_ID } from '../../constants';
import { resetAllStores } from '../testUtils';
import type { Layout } from '../../types';

describe('layout store', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addBin', () => {
    it('adds a bin to the layout', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Test bin',
        notes: '',
      });

      expect(binId).not.toBeNull();
      const updatedLayout = useLayoutStore.getState().layout;
      expect(updatedLayout.bins).toHaveLength(1);
      expect(updatedLayout.bins[0].label).toBe('Test bin');
    });

    it('returns null when bin placement is invalid (out of bounds)', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId,
        x: 100, // Way out of bounds
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(binId).toBeNull();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('returns null when bin overlaps existing bin', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add first bin
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      // Try to add overlapping bin
      const binId = addBin({
        layerId,
        x: 1, // Overlaps with first bin
        y: 1,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(binId).toBeNull();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });

    it('allows adding bin to staging without validation', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: 100, // Huge, would fail validation on grid
        depth: 100,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(binId).not.toBeNull();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });
  });

  describe('deleteBin', () => {
    it('removes a bin from the layout', () => {
      const { addBin, deleteBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

      deleteBin(binId!);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('does nothing when bin id does not exist', () => {
      const { addBin, deleteBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      deleteBin('nonexistent-id');
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });
  });

  describe('updateBin', () => {
    it('updates bin properties', () => {
      const { addBin, updateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Original',
        notes: '',
      });

      updateBin(binId!, { label: 'Updated', notes: 'New notes' });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.label).toBe('Updated');
      expect(bin.notes).toBe('New notes');
    });
  });

  describe('duplicateBin', () => {
    it('duplicates a bin to an adjacent position', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Original',
        notes: '',
      });

      const newId = duplicateBin(binId!);
      expect(newId).not.toBeNull();

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins).toHaveLength(2);
      expect(bins[1].label).toBe('Original');
      // Should be placed adjacent to original
      expect(bins[1].x).toBe(2); // Right of original
    });

    it('moves duplicate to staging when no adjacent space available', () => {
      const { duplicateBin, fillLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Fill the entire layer first
      fillLayer(layerId, 1, 1, categoryId);

      // Now duplicate one of the bins - should go to staging
      const bins = useLayoutStore.getState().layout.bins;
      const binToClone = bins.find(b => b.layerId !== STAGING_ID);

      const newId = duplicateBin(binToClone!.id);
      expect(newId).not.toBeNull();

      const updatedBins = useLayoutStore.getState().layout.bins;
      const newBin = updatedBins.find(b => b.id === newId);
      expect(newBin?.layerId).toBe(STAGING_ID);
    });

    it('duplicates staging bin within staging', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      const newId = duplicateBin(binId!);
      expect(newId).not.toBeNull();

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins).toHaveLength(2);
      expect(bins[1].layerId).toBe(STAGING_ID);
    });
  });

  describe('fillLayer', () => {
    it('fills empty layer with bins of specified size', () => {
      const { fillLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Default drawer is 10x8, fill with 2x2 bins
      const count = fillLayer(layerId, 2, 2, categoryId);

      // 10x8 / 2x2 = 5x4 = 20 bins
      expect(count).toBe(20);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(20);
    });

    it('skips cells occupied by existing bins', () => {
      const { addBin, fillLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add a 2x2 bin at origin
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      const count = fillLayer(layerId, 2, 2, categoryId);

      // Should be 20 - 1 = 19 new bins
      expect(count).toBe(19);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(20);
    });

    it('returns 0 for invalid layer', () => {
      const { fillLayer, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const count = fillLayer('nonexistent-layer', 2, 2, categoryId);
      expect(count).toBe(0);
    });
  });

  describe('clearLayer', () => {
    it('removes all bins from specified layer', () => {
      const { fillLayer, clearLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      fillLayer(layerId, 2, 2, categoryId);
      expect(useLayoutStore.getState().layout.bins.length).toBeGreaterThan(0);

      const count = clearLayer(layerId);
      expect(count).toBe(20);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('only removes bins from specified layer', () => {
      const { addBin, addLayer, clearLayer, layout } = useLayoutStore.getState();
      const layer1Id = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin to layer 1
      addBin({
        layerId: layer1Id,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      // Add layer 2 and add bin to it
      const layer2Id = addLayer();
      addBin({
        layerId: layer2Id!,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(2);

      clearLayer(layer1Id);
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins).toHaveLength(1);
      expect(bins[0].layerId).toBe(layer2Id);
    });
  });

  describe('importLayout', () => {
    it('replaces entire layout state', () => {
      const { importLayout, addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add some bins first
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

      // Import new layout
      const newLayout: Layout = {
        ...createDefaultLayout(),
        name: 'Imported Layout',
        bins: [],
      };

      importLayout(newLayout);

      const imported = useLayoutStore.getState().layout;
      expect(imported.name).toBe('Imported Layout');
      expect(imported.bins).toHaveLength(0);
    });

    it('preserves imported layout structure', () => {
      const { importLayout } = useLayoutStore.getState();

      const customLayout: Layout = {
        version: '1.0',
        name: 'Custom',
        drawer: { width: 5, depth: 5, height: 6 },
        printBedSize: 200,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: 'cat1', name: 'Custom Cat', color: '#ff0000' }],
        layers: [{ id: 'layer1', name: 'Custom Layer', height: 3 }],
        bins: [{
          id: 'bin1',
          layerId: 'layer1',
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: 'cat1',
          label: 'Imported bin',
          notes: '',
        }],
      };

      importLayout(customLayout);

      const imported = useLayoutStore.getState().layout;
      expect(imported.drawer.width).toBe(5);
      expect(imported.drawer.depth).toBe(5);
      expect(imported.categories[0].name).toBe('Custom Cat');
      expect(imported.layers[0].name).toBe('Custom Layer');
      expect(imported.bins[0].label).toBe('Imported bin');
    });
  });

  describe('layer operations', () => {
    it('addLayer creates new layer', () => {
      const { addLayer } = useLayoutStore.getState();

      const layerId = addLayer();
      expect(layerId).not.toBeNull();

      const layers = useLayoutStore.getState().layout.layers;
      expect(layers).toHaveLength(2);
      expect(layers[1].name).toBe('Layer 2');
    });

    it('addLayer returns null when at max layers', () => {
      const { addLayer } = useLayoutStore.getState();

      // Add layers until max
      for (let i = 0; i < 10; i++) {
        addLayer();
      }

      const result = addLayer();
      expect(result).toBeNull();
    });

    it('deleteLayer removes layer and its bins', () => {
      const { addBin, addLayer, deleteLayer, layout } = useLayoutStore.getState();
      const layer1Id = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add second layer
      const layer2Id = addLayer()!;

      // Add bin to each layer
      addBin({
        layerId: layer1Id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      addBin({
        layerId: layer2Id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(2);

      const result = deleteLayer(layer1Id);
      expect(result).toBe(true);

      const state = useLayoutStore.getState().layout;
      expect(state.layers).toHaveLength(1);
      expect(state.layers[0].id).toBe(layer2Id);
      expect(state.bins).toHaveLength(1);
      expect(state.bins[0].layerId).toBe(layer2Id);
    });

    it('deleteLayer returns false when only one layer exists', () => {
      const { deleteLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      const result = deleteLayer(layerId);
      expect(result).toBe(false);
      expect(useLayoutStore.getState().layout.layers).toHaveLength(1);
    });
  });

  describe('drawer operations', () => {
    it('updateDrawer updates drawer dimensions', () => {
      const { updateDrawer } = useLayoutStore.getState();

      updateDrawer({ width: 15, depth: 12 });

      const drawer = useLayoutStore.getState().layout.drawer;
      expect(drawer.width).toBe(15);
      expect(drawer.depth).toBe(12);
    });

    it('updateDrawer clamps values to constraints', () => {
      const { updateDrawer } = useLayoutStore.getState();

      updateDrawer({ width: 100, depth: -5 });

      const drawer = useLayoutStore.getState().layout.drawer;
      expect(drawer.width).toBe(50); // GRID_MAX
      expect(drawer.depth).toBe(1);  // GRID_MIN
    });

    it('updateDrawer moves out-of-bounds bins to staging', () => {
      const { addBin, updateDrawer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin at far right of 10-wide drawer
      addBin({
        layerId,
        x: 8,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      // Shrink drawer to 5 wide
      updateDrawer({ width: 5 });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].layerId).toBe(STAGING_ID);
    });
  });

  describe('category operations', () => {
    it('addCategory creates new category', () => {
      const { addCategory } = useLayoutStore.getState();

      const catId = addCategory({ name: 'New Cat', color: '#00ff00' });
      expect(catId).toBeDefined();

      const cats = useLayoutStore.getState().layout.categories;
      const newCat = cats.find(c => c.id === catId);
      expect(newCat?.name).toBe('New Cat');
      expect(newCat?.color).toBe('#00ff00');
    });

    it('deleteCategory removes unused category', () => {
      const { addCategory, deleteCategory } = useLayoutStore.getState();

      const catId = addCategory({ name: 'To Delete', color: '#ff0000' });
      const result = deleteCategory(catId);

      expect(result).toBe(true);
      expect(useLayoutStore.getState().layout.categories.find(c => c.id === catId)).toBeUndefined();
    });

    it('deleteCategory returns false when category is in use', () => {
      const { addBin, deleteCategory, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      addBin({
        layerId,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      const result = deleteCategory(categoryId);
      expect(result).toBe(false);
    });
  });

  describe('settings', () => {
    it('setName updates layout name', () => {
      const { setName } = useLayoutStore.getState();

      setName('My Custom Layout');
      expect(useLayoutStore.getState().layout.name).toBe('My Custom Layout');
    });

    it('setName truncates long names', () => {
      const { setName } = useLayoutStore.getState();

      const longName = 'A'.repeat(200);
      setName(longName);

      const name = useLayoutStore.getState().layout.name;
      expect(name.length).toBeLessThanOrEqual(100);
    });

    it('setPrintBedSize updates and clamps value', () => {
      const { setPrintBedSize } = useLayoutStore.getState();

      setPrintBedSize(300);
      expect(useLayoutStore.getState().layout.printBedSize).toBe(300);

      setPrintBedSize(1000);
      expect(useLayoutStore.getState().layout.printBedSize).toBe(500); // Max
    });
  });

});
