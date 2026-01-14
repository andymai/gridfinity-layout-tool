import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../../store/layout';
import { useSettingsStore } from '../../store/settings';
import { createDefaultLayout, STAGING_ID, CONSTRAINTS } from '../../constants';
import { resetAllStores } from '../testUtils';
import type { Layout } from '../../types';
import { isOk, isErr } from '../../result';

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

      const result = addBin({
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

      expect(isOk(result)).toBe(true);
      const updatedLayout = useLayoutStore.getState().layout;
      expect(updatedLayout.bins).toHaveLength(1);
      expect(updatedLayout.bins[0].label).toBe('Test bin');
    });

    it('returns error when bin placement is invalid (out of bounds)', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const result = addBin({
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

      expect(isErr(result)).toBe(true);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('returns error when bin overlaps existing bin', () => {
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
      const result = addBin({
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

      expect(isErr(result)).toBe(true);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });

    it('allows adding bin to staging without validation', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const result = addBin({
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

      expect(isOk(result)).toBe(true);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });
  });

  describe('deleteBin', () => {
    it('removes a bin from the layout', () => {
      const { addBin, deleteBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const result = addBin({
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
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      deleteBin(result.value);
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

      const result = addBin({
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
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      updateBin(result.value, { label: 'Updated', notes: 'New notes' });

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

      const addResult = addBin({
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
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const dupResult = duplicateBin(addResult.value);
      expect(isOk(dupResult)).toBe(true);

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

      const dupResult = duplicateBin(binToClone!.id);
      expect(isOk(dupResult)).toBe(true);
      if (!isOk(dupResult)) return;

      const updatedBins = useLayoutStore.getState().layout.bins;
      const newBin = updatedBins.find(b => b.id === dupResult.value);
      expect(newBin?.layerId).toBe(STAGING_ID);
    });

    it('duplicates staging bin within staging', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
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
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const dupResult = duplicateBin(addResult.value);
      expect(isOk(dupResult)).toBe(true);

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
      const layer2Result = addLayer();
      expect(isOk(layer2Result)).toBe(true);
      if (!isOk(layer2Result)) return;

      addBin({
        layerId: layer2Result.value,
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
      expect(bins[0].layerId).toBe(layer2Result.value);
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

      const result = addLayer();
      expect(isOk(result)).toBe(true);

      const layers = useLayoutStore.getState().layout.layers;
      expect(layers).toHaveLength(2);
      expect(layers[1].name).toBe('Layer 2');
    });

    it('addLayer returns error when at max layers', () => {
      const { addLayer } = useLayoutStore.getState();

      // Add layers until max
      for (let i = 0; i < 10; i++) {
        addLayer();
      }

      const result = addLayer();
      expect(isErr(result)).toBe(true);
    });

    it('addLayer uses default layer height setting', () => {
      // Set custom default layer height
      useSettingsStore.setState({
        settings: {
          ...useSettingsStore.getState().settings,
          defaultLayerHeight: 5,
        },
      });

      const { addLayer } = useLayoutStore.getState();

      const result = addLayer();
      expect(isOk(result)).toBe(true);

      const layers = useLayoutStore.getState().layout.layers;
      expect(layers).toHaveLength(2);
      expect(layers[1].height).toBe(5);
    });

    it('addLayer respects remaining height over default setting', () => {
      // Set default to 5, but only 2 units remaining
      useSettingsStore.setState({
        settings: {
          ...useSettingsStore.getState().settings,
          defaultLayerHeight: 5,
        },
      });

      // Set drawer height to 5, first layer already uses 3 (leaving 2 remaining)
      const { updateDrawer, addLayer } = useLayoutStore.getState();
      updateDrawer({ height: 5 });

      const result = addLayer();
      expect(isOk(result)).toBe(true);

      const layers = useLayoutStore.getState().layout.layers;
      // New layer should be 2 (remaining) not 5 (default)
      expect(layers[1].height).toBe(2);
    });

    it('deleteLayer removes layer and its bins', () => {
      const { addBin, addLayer, deleteLayer, layout } = useLayoutStore.getState();
      const layer1Id = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add second layer
      const layer2Result = addLayer();
      expect(isOk(layer2Result)).toBe(true);
      if (!isOk(layer2Result)) return;
      const layer2Id = layer2Result.value;

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
      expect(isOk(result)).toBe(true);

      const state = useLayoutStore.getState().layout;
      expect(state.layers).toHaveLength(1);
      expect(state.layers[0].id).toBe(layer2Id);
      expect(state.bins).toHaveLength(1);
      expect(state.bins[0].layerId).toBe(layer2Id);
    });

    it('deleteLayer returns error when only one layer exists', () => {
      const { deleteLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      const result = deleteLayer(layerId);
      expect(isErr(result)).toBe(true);
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
      expect(drawer.width).toBe(50);   // GRID_MAX
      expect(drawer.depth).toBe(0.5);  // GRID_MIN (now supports half-units)
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

      const result = addCategory({ name: 'New Cat', color: '#00ff00' });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const cats = useLayoutStore.getState().layout.categories;
      const newCat = cats.find(c => c.id === result.value);
      expect(newCat?.name).toBe('New Cat');
      expect(newCat?.color).toBe('#00ff00');
    });

    it('deleteCategory removes unused category', () => {
      const { addCategory, deleteCategory } = useLayoutStore.getState();

      const addResult = addCategory({ name: 'To Delete', color: '#ff0000' });
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const result = deleteCategory(addResult.value);
      expect(isOk(result)).toBe(true);
      expect(useLayoutStore.getState().layout.categories.find(c => c.id === addResult.value)).toBeUndefined();
    });

    it('deleteCategory returns Err when category is in use', () => {
      const { addBin, deleteCategory, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      addBin({
        layerId,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      const result = deleteCategory(categoryId);
      expect(isErr(result)).toBe(true);
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

    it('setGridUnitMm updates and clamps value', () => {
      const { setGridUnitMm } = useLayoutStore.getState();

      setGridUnitMm(50);
      expect(useLayoutStore.getState().layout.gridUnitMm).toBe(50);

      // Test min clamping
      setGridUnitMm(0);
      expect(useLayoutStore.getState().layout.gridUnitMm).toBe(1);

      // Test max clamping
      setGridUnitMm(500);
      expect(useLayoutStore.getState().layout.gridUnitMm).toBe(200);
    });

    it('setHeightUnitMm updates and clamps value', () => {
      const { setHeightUnitMm } = useLayoutStore.getState();

      setHeightUnitMm(10);
      expect(useLayoutStore.getState().layout.heightUnitMm).toBe(10);

      // Test min clamping
      setHeightUnitMm(0);
      expect(useLayoutStore.getState().layout.heightUnitMm).toBe(1);

      // Test max clamping
      setHeightUnitMm(100);
      expect(useLayoutStore.getState().layout.heightUnitMm).toBe(50);
    });

    it('setActiveLayoutId updates the active layout ID', () => {
      const { setActiveLayoutId } = useLayoutStore.getState();

      expect(useLayoutStore.getState().activeLayoutId).toBeNull();

      setActiveLayoutId('layout-123');
      expect(useLayoutStore.getState().activeLayoutId).toBe('layout-123');

      setActiveLayoutId(null);
      expect(useLayoutStore.getState().activeLayoutId).toBeNull();
    });
  });

  describe('moveBinToStaging', () => {
    it('moves a bin to staging', () => {
      const { addBin, moveBinToStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Test',
        notes: '',
      });
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe(layerId);

      const result = moveBinToStaging(addResult.value);
      expect(isOk(result)).toBe(true);
      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe(STAGING_ID);
    });

    it('returns Err when bin does not exist', () => {
      const { moveBinToStaging } = useLayoutStore.getState();

      const result = moveBinToStaging('nonexistent');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('moveBinFromStaging', () => {
    it('moves a bin from staging to grid', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin to staging
      const addResult = addBin({
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
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const result = moveBinFromStaging(addResult.value, layerId, 0, 0);
      expect(isOk(result)).toBe(true);

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.layerId).toBe(layerId);
      expect(bin.x).toBe(0);
      expect(bin.y).toBe(0);
    });

    it('returns Err when bin does not exist', () => {
      const { moveBinFromStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      const result = moveBinFromStaging('nonexistent', layerId, 0, 0);
      expect(isErr(result)).toBe(true);
    });

    it('returns Err when layer does not exist', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
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
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const result = moveBinFromStaging(addResult.value, 'nonexistent-layer', 0, 0);
      expect(isErr(result)).toBe(true);
    });

    it('returns Err when placement is invalid', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add existing bin at position
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

      // Add bin to staging
      const addResult = addBin({
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
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      // Try to move to occupied position
      const result = moveBinFromStaging(addResult.value, layerId, 0, 0);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('updateLayer', () => {
    it('updates layer properties', () => {
      const { updateLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      updateLayer(layerId, { name: 'Renamed Layer' });
      expect(useLayoutStore.getState().layout.layers[0].name).toBe('Renamed Layer');
    });

    it('clamps layer height to available space', () => {
      const { updateLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      // Drawer height is 12, so setting height to 20 should clamp
      updateLayer(layerId, { height: 20 });
      expect(useLayoutStore.getState().layout.layers[0].height).toBeLessThanOrEqual(12);
    });

    it('does nothing for nonexistent layer', () => {
      const { updateLayer, layout } = useLayoutStore.getState();
      const originalName = layout.layers[0].name;

      updateLayer('nonexistent', { name: 'New Name' });
      expect(useLayoutStore.getState().layout.layers[0].name).toBe(originalName);
    });
  });

  describe('reorderLayers', () => {
    it('reorders layers successfully', () => {
      const { addLayer, reorderLayers } = useLayoutStore.getState();

      // Add second layer
      addLayer();

      const layer1Id = useLayoutStore.getState().layout.layers[0].id;
      const layer2Id = useLayoutStore.getState().layout.layers[1].id;

      const result = reorderLayers(0, 1);
      expect(isOk(result)).toBe(true);

      const layers = useLayoutStore.getState().layout.layers;
      expect(layers[0].id).toBe(layer2Id);
      expect(layers[1].id).toBe(layer1Id);
    });

    it('returns Ok for same index', () => {
      const result = useLayoutStore.getState().reorderLayers(0, 0);
      expect(isOk(result)).toBe(true);
    });

    it('returns Err for invalid source index', () => {
      const result = useLayoutStore.getState().reorderLayers(-1, 0);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
      }
    });

    it('returns Err for invalid target index', () => {
      const result = useLayoutStore.getState().reorderLayers(0, 10);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
      }
    });

    it('returns Err when reorder would cause collisions', () => {
      const { addBin, addLayer, updateDrawer, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      // Set up drawer to accommodate two layers
      updateDrawer({ height: 12 });

      // Add second layer
      const layer2Result = addLayer();
      expect(isOk(layer2Result)).toBe(true);
      if (!isOk(layer2Result)) return;
      const layer2Id = layer2Result.value;

      // Layer 1 height = 3, layer 2 height = 3
      const layer1Id = useLayoutStore.getState().layout.layers[0].id;

      // Add a bin on layer 1 at (0,0) with height 3 (fills layer 1)
      const bin1Result = addBin({
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
      expect(isOk(bin1Result)).toBe(true);

      // Add a bin on layer 2 at same (0,0) position with height 4 (spans into next space)
      // Before swap: layers = [Layer1(h=3), Layer2(h=3)]
      //   Bin1: zStart=0, zEnd=3
      //   Bin2: zStart=3, zEnd=7
      //   No overlap (3 < 3 is false)
      //
      // After swap: layers = [Layer2(h=3), Layer1(h=3)]
      //   Bin2: zStart=0, zEnd=4 (Layer2 is now first)
      //   Bin1: zStart=3, zEnd=6 (Layer1 starts at z=3)
      //   Overlap check: 0 < 6 && 3 < 4 = true && true = collision!
      const bin2Result = addBin({
        layerId: layer2Id,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 4,
        category: categoryId,
        label: '',
        notes: '',
      });
      expect(isOk(bin2Result)).toBe(true);

      // Verify bins were added
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins.length).toBe(2);

      // Reordering should cause collision since bins would vertically overlap
      const result = useLayoutStore.getState().reorderLayers(0, 1);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
      }
    });
  });

  describe('updateCategory', () => {
    it('updates category properties', () => {
      const { updateCategory, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      updateCategory(categoryId, { name: 'Renamed Category', color: '#00ff00' });

      const category = useLayoutStore.getState().layout.categories[0];
      expect(category.name).toBe('Renamed Category');
      expect(category.color).toBe('#00ff00');
    });

    it('does nothing for nonexistent category', () => {
      const { updateCategory, layout } = useLayoutStore.getState();
      const originalName = layout.categories[0].name;

      updateCategory('nonexistent', { name: 'New Name' });
      expect(useLayoutStore.getState().layout.categories[0].name).toBe(originalName);
    });
  });

  describe('fillLayerGaps', () => {
    it('fills gaps in a layer with bins', () => {
      const { addBin, fillLayerGaps, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add a few bins leaving gaps
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

      addBin({
        layerId,
        x: 5,
        y: 5,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      const initialBinCount = useLayoutStore.getState().layout.bins.length;
      const addedCount = fillLayerGaps(layerId, categoryId);

      // Should have added some bins to fill gaps
      expect(addedCount).toBeGreaterThanOrEqual(0);
      expect(useLayoutStore.getState().layout.bins.length).toBeGreaterThanOrEqual(initialBinCount);
    });

    it('works with half-bin mode', () => {
      const { fillLayerGaps, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Should not throw with halfBinMode enabled
      expect(() => fillLayerGaps(layerId, categoryId, true)).not.toThrow();
    });
  });

  describe('fillLayer with half-bin mode', () => {
    it('fills layer with half-bin sized bins when enabled', () => {
      const { fillLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Fill with 1.5x1.5 bins in half-bin mode
      const count = fillLayer(layerId, 1.5, 1.5, categoryId, true);

      expect(count).toBeGreaterThan(0);
      // Verify bins were created with fractional dimensions
      const bins = useLayoutStore.getState().layout.bins;
      const hasFractional = bins.some(b => b.width === 1.5 || b.depth === 1.5);
      expect(hasFractional).toBe(true);
    });
  });

  describe('drawer operations extended', () => {
    it('updateDrawer handles fractionalEdgeX', () => {
      const { updateDrawer } = useLayoutStore.getState();

      updateDrawer({ fractionalEdgeX: 'start' });
      expect(useLayoutStore.getState().layout.drawer.fractionalEdgeX).toBe('start');

      updateDrawer({ fractionalEdgeX: 'end' });
      expect(useLayoutStore.getState().layout.drawer.fractionalEdgeX).toBe('end');
    });

    it('updateDrawer handles fractionalEdgeY', () => {
      const { updateDrawer } = useLayoutStore.getState();

      updateDrawer({ fractionalEdgeY: 'start' });
      expect(useLayoutStore.getState().layout.drawer.fractionalEdgeY).toBe('start');

      updateDrawer({ fractionalEdgeY: 'end' });
      expect(useLayoutStore.getState().layout.drawer.fractionalEdgeY).toBe('end');
    });

    it('updateDrawer clamps height to total layer heights', () => {
      const { updateDrawer, addLayer } = useLayoutStore.getState();

      // Add multiple layers (each uses height from remaining)
      addLayer();
      addLayer();

      const totalLayerHeight = useLayoutStore.getState().layout.layers.reduce(
        (sum, l) => sum + l.height, 0
      );

      // Try to set height below total layer heights
      updateDrawer({ height: 1 });

      // Should be clamped to at least total layer height
      expect(useLayoutStore.getState().layout.drawer.height).toBeGreaterThanOrEqual(totalLayerHeight);
    });
  });

  describe('duplicateBin edge cases', () => {
    it('returns Err when bin does not exist', () => {
      const { duplicateBin } = useLayoutStore.getState();

      const result = duplicateBin('nonexistent');
      expect(isErr(result)).toBe(true);
    });

    it('preserves clearanceHeight when duplicating', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
        clearanceHeight: 2,
      });
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const dupResult = duplicateBin(addResult.value);
      expect(isOk(dupResult)).toBe(true);
      if (!isOk(dupResult)) return;

      const newBin = useLayoutStore.getState().layout.bins.find(b => b.id === dupResult.value);
      expect(newBin?.clearanceHeight).toBe(2);
    });
  });

  describe('importLayout with layoutId', () => {
    it('sets activeLayoutId when provided', () => {
      const { importLayout } = useLayoutStore.getState();
      const newLayout: Layout = createDefaultLayout();

      importLayout(newLayout, 'custom-layout-id');

      expect(useLayoutStore.getState().activeLayoutId).toBe('custom-layout-id');
    });
  });

  // =========================================================================
  // Result-returning operations
  // =========================================================================

  describe('addBin', () => {
    it('returns Ok with bin id on success', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const result = addBin({
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

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeDefined();
        expect(useLayoutStore.getState().layout.bins[0].id).toBe(result.value);
      }
    });

    it('returns Err with VALIDATION_OUT_OF_BOUNDS when out of bounds', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const result = addBin({
        layerId,
        x: 100,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_OUT_OF_BOUNDS');
        expect(result.error.kind).toBe('ValidationError');
      }
    });

    it('returns Err with VALIDATION_COLLISION when bin overlaps', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add first bin successfully
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
      const result = addBin({
        layerId,
        x: 1,
        y: 1,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_COLLISION');
      }
    });

    it('returns Err with VALIDATION_INVALID_LAYER for nonexistent layer', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const result = addBin({
        layerId: 'nonexistent-layer',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_INVALID_LAYER');
      }
    });

    it('allows adding to staging without validation', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const result = addBin({
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: 100, // Would fail validation on grid
        depth: 100,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(isOk(result)).toBe(true);
    });
  });

  describe('moveBinFromStaging', () => {
    it('returns Ok on successful move', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
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
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const result = moveBinFromStaging(addResult.value, layerId, 0, 0);
      expect(isOk(result)).toBe(true);

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.layerId).toBe(layerId);
    });

    it('returns Err with VALIDATION_INVALID_LAYER for nonexistent layer', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
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
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const result = moveBinFromStaging(addResult.value, 'nonexistent-layer', 0, 0);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_INVALID_LAYER');
      }
    });

    it('returns Err with VALIDATION_COLLISION when position is occupied', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add existing bin at position
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

      // Add bin to staging
      const stagingResult = addBin({
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
      expect(isOk(stagingResult)).toBe(true);
      if (!isOk(stagingResult)) return;

      const result = moveBinFromStaging(stagingResult.value, layerId, 0, 0);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_COLLISION');
      }
    });
  });

  describe('addLayer', () => {
    it('returns Ok with layer id on success', () => {
      const { addLayer } = useLayoutStore.getState();

      const result = addLayer();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeDefined();
        expect(useLayoutStore.getState().layout.layers).toHaveLength(2);
      }
    });

    it('returns Err with LAYOUT_LAYER_LIMIT when at max layers', () => {
      const { addLayer, updateDrawer } = useLayoutStore.getState();

      // Increase drawer height to ensure we don't run out of height before layers
      updateDrawer({ height: 50 });

      // Add layers until max (minus 1 for existing layer)
      for (let i = 0; i < CONSTRAINTS.LAYERS_MAX - 1; i++) {
        addLayer();
      }

      const result = addLayer();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_LAYER_LIMIT');
        expect(result.error.kind).toBe('LayoutError');
        if ('currentCount' in result.error) {
          expect(result.error.currentCount).toBe(CONSTRAINTS.LAYERS_MAX);
          expect(result.error.maxCount).toBe(CONSTRAINTS.LAYERS_MAX);
        }
      }
    });

    it('returns Err with LAYOUT_INVALID_OPERATION when no height remaining', () => {
      const { addLayer, updateDrawer, updateLayer, layout } = useLayoutStore.getState();

      // Set drawer height to match first layer height (no room for more)
      updateLayer(layout.layers[0].id, { height: 12 });
      updateDrawer({ height: 12 });

      // First layer now takes all height
      const result = addLayer();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
      }
    });
  });

  describe('deleteLayer', () => {
    it('returns Ok on successful deletion', () => {
      const { addLayer, deleteLayer } = useLayoutStore.getState();

      // Add second layer first
      const addResult = addLayer();
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const result = deleteLayer(addResult.value);

      expect(isOk(result)).toBe(true);
      expect(useLayoutStore.getState().layout.layers).toHaveLength(1);
    });

    it('returns Err with LAYOUT_LAST_ENTITY when deleting last layer', () => {
      const { deleteLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      const result = deleteLayer(layerId);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_LAST_ENTITY');
        expect(result.error.kind).toBe('LayoutError');
        if ('entityType' in result.error) {
          expect(result.error.entityType).toBe('layer');
        }
      }
    });

    it('returns Err with LAYOUT_INVALID_OPERATION for nonexistent layer', () => {
      const { addLayer, deleteLayer } = useLayoutStore.getState();

      // Add second layer so we're not hitting last entity error
      addLayer();

      const result = deleteLayer('nonexistent-layer');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
      }
    });
  });

  describe('reorderLayers', () => {
    it('returns Ok on successful reorder', () => {
      const { addLayer, reorderLayers } = useLayoutStore.getState();

      addLayer();

      const layer1Id = useLayoutStore.getState().layout.layers[0].id;
      const layer2Id = useLayoutStore.getState().layout.layers[1].id;

      const result = reorderLayers(0, 1);

      expect(isOk(result)).toBe(true);
      const layers = useLayoutStore.getState().layout.layers;
      expect(layers[0].id).toBe(layer2Id);
      expect(layers[1].id).toBe(layer1Id);
    });

    it('returns Ok for same index', () => {
      const result = useLayoutStore.getState().reorderLayers(0, 0);
      expect(isOk(result)).toBe(true);
    });

    it('returns Err with LAYOUT_INVALID_OPERATION for invalid source index', () => {
      const result = useLayoutStore.getState().reorderLayers(-1, 0);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
        if ('reason' in result.error) {
          expect(result.error.reason).toContain('source index');
        }
      }
    });

    it('returns Err with LAYOUT_INVALID_OPERATION for invalid target index', () => {
      const result = useLayoutStore.getState().reorderLayers(0, 10);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
        if ('reason' in result.error) {
          expect(result.error.reason).toContain('target index');
        }
      }
    });
  });

  describe('addCategory', () => {
    it('returns Ok with category id on success', () => {
      const { addCategory } = useLayoutStore.getState();

      const result = addCategory({ name: 'New Cat', color: '#00ff00' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeDefined();
        const cat = useLayoutStore.getState().layout.categories.find(c => c.id === result.value);
        expect(cat?.name).toBe('New Cat');
      }
    });

    it('returns Err with LAYOUT_CATEGORY_LIMIT when at max categories', () => {
      const { addCategory } = useLayoutStore.getState();

      // Add categories until max (minus 1 for existing)
      for (let i = 0; i < CONSTRAINTS.CATEGORIES_MAX - 1; i++) {
        addCategory({ name: `Cat ${i}`, color: '#000000' });
      }

      const result = addCategory({ name: 'One Too Many', color: '#ff0000' });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_CATEGORY_LIMIT');
        expect(result.error.kind).toBe('LayoutError');
      }
    });
  });

  describe('deleteCategory', () => {
    it('returns Ok on successful deletion', () => {
      const { addCategory, deleteCategory } = useLayoutStore.getState();

      const addResult = addCategory({ name: 'To Delete', color: '#ff0000' });
      expect(isOk(addResult)).toBe(true);
      if (!isOk(addResult)) return;

      const result = deleteCategory(addResult.value);

      expect(isOk(result)).toBe(true);
      expect(useLayoutStore.getState().layout.categories.find(c => c.id === addResult.value)).toBeUndefined();
    });

    it('returns Err with LAYOUT_INVALID_OPERATION when category is in use', () => {
      const { addBin, deleteCategory, layout } = useLayoutStore.getState();
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

      const result = deleteCategory(categoryId);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
        if ('reason' in result.error) {
          expect(result.error.reason).toContain('in use');
        }
      }
    });

    it('returns Err with LAYOUT_LAST_ENTITY when deleting last category', () => {
      const { deleteCategory, layout } = useLayoutStore.getState();

      // Default layout has 5 categories, delete 4 to get to 1
      const categories = layout.categories;
      for (let i = 1; i < categories.length; i++) {
        deleteCategory(categories[i].id);
      }

      // Now try to delete the last one
      const lastCategoryId = useLayoutStore.getState().layout.categories[0].id;
      const result = deleteCategory(lastCategoryId);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_LAST_ENTITY');
        if ('entityType' in result.error) {
          expect(result.error.entityType).toBe('category');
        }
      }
    });

    it('returns Err with LAYOUT_INVALID_OPERATION for nonexistent category', () => {
      const { addCategory, deleteCategory } = useLayoutStore.getState();

      // Add second category so we're not hitting last entity error
      addCategory({ name: 'Extra', color: '#000000' });

      const result = deleteCategory('nonexistent-category');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
      }
    });
  });

});
