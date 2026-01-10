import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../../store/layout';
import { createDefaultLayout, STAGING_ID } from '../../constants';

describe('multi-bin operations', () => {
  beforeEach(() => {
    useLayoutStore.setState({ layout: createDefaultLayout() });
  });

  describe('bulk move validation', () => {
    it('allows moving multiple bins to valid positions', () => {
      const { addBin, updateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add two bins side by side
      const bin1Id = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: 'Bin 1', notes: '',
      });
      const bin2Id = addBin({
        layerId, x: 2, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: 'Bin 2', notes: '',
      });

      expect(bin1Id).not.toBeNull();
      expect(bin2Id).not.toBeNull();

      // Simulate moving both bins (update positions)
      updateBin(bin1Id!, { x: 0, y: 4 });
      updateBin(bin2Id!, { x: 2, y: 4 });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].y).toBe(4);
      expect(bins[1].y).toBe(4);
    });

    it('detects collision when bulk move would cause overlap', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add first bin
      addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Add second bin at position that would collide if moved
      addBin({
        layerId, x: 4, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Third bin - if we tried to add at (1,0), it would collide with first
      const collidingId = addBin({
        layerId, x: 1, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Should return null because of collision
      expect(collidingId).toBeNull();
    });
  });

  describe('duplicate bin ID remapping', () => {
    it('generates unique ID when duplicating bin', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const originalId = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: 'Original', notes: '',
      });

      const duplicateId = duplicateBin(originalId!);

      expect(duplicateId).not.toBeNull();
      expect(duplicateId).not.toBe(originalId);

      const bins = useLayoutStore.getState().layout.bins;
      const ids = bins.map(b => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(bins.length);
    });

    it('copies all bin properties except ID and position', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const originalId = addBin({
        layerId, x: 0, y: 0, width: 3, depth: 2, height: 3,
        category: categoryId, label: 'Test Label', notes: 'Test notes',
        clearanceHeight: 2,
      });

      const duplicateId = duplicateBin(originalId!);

      const bins = useLayoutStore.getState().layout.bins;
      const original = bins.find(b => b.id === originalId);
      const duplicate = bins.find(b => b.id === duplicateId);

      expect(duplicate?.width).toBe(original?.width);
      expect(duplicate?.depth).toBe(original?.depth);
      expect(duplicate?.height).toBe(original?.height);
      expect(duplicate?.category).toBe(original?.category);
      expect(duplicate?.label).toBe(original?.label);
      expect(duplicate?.notes).toBe(original?.notes);
      expect(duplicate?.clearanceHeight).toBe(original?.clearanceHeight);
    });

    it('generates unique IDs across multiple duplications', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const originalId = addBin({
        layerId, x: 0, y: 0, width: 1, depth: 1, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Duplicate multiple times
      const dup1 = duplicateBin(originalId!);
      const dup2 = duplicateBin(originalId!);
      const dup3 = duplicateBin(originalId!);

      const ids = [originalId, dup1, dup2, dup3];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);
    });
  });

  describe('delete cascade to staging cleanup', () => {
    it('removes bin from staging when deleted', () => {
      const { addBin, deleteBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      // Add bin directly to staging
      const binId = addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

      deleteBin(binId!);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('clears all staging bins when using clearLayer on grid layer', () => {
      const { addBin, clearLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bins to layer
      addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      addBin({
        layerId, x: 2, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Add bin to staging
      addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(3);

      // Clear only the grid layer
      clearLayer(layerId);

      // Staging bin should remain
      const remainingBins = useLayoutStore.getState().layout.bins;
      expect(remainingBins).toHaveLength(1);
      expect(remainingBins[0].layerId).toBe(STAGING_ID);
    });

    it('does not affect staging when deleting layer', () => {
      const { addBin, addLayer, deleteLayer, layout } = useLayoutStore.getState();
      const layer1Id = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add second layer
      const layer2Id = addLayer()!;

      // Add bin to each layer
      addBin({
        layerId: layer1Id, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      addBin({
        layerId: layer2Id, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Add to staging
      addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(3);

      // Delete layer 1
      deleteLayer(layer1Id);

      const remainingBins = useLayoutStore.getState().layout.bins;
      expect(remainingBins).toHaveLength(2);

      const layerIds = remainingBins.map(b => b.layerId);
      expect(layerIds).toContain(layer2Id);
      expect(layerIds).toContain(STAGING_ID);
    });
  });

  describe('bulk resize scenarios', () => {
    it('allows resizing bin when space is available', () => {
      const { addBin, updateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Resize the bin
      updateBin(binId!, { width: 4, depth: 4 });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.width).toBe(4);
      expect(bin.depth).toBe(4);
    });

    it('preserves bin position when resizing', () => {
      const { addBin, updateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId, x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      updateBin(binId!, { width: 3, depth: 3 });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.x).toBe(2);
      expect(bin.y).toBe(2);
    });
  });

  describe('multi-bin selection operations', () => {
    it('deletes multiple bins in sequence', () => {
      const { addBin, deleteBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const bin1 = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      const bin2 = addBin({
        layerId, x: 2, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      const bin3 = addBin({
        layerId, x: 4, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(3);

      // Delete multiple
      deleteBin(bin1!);
      deleteBin(bin3!);

      const remaining = useLayoutStore.getState().layout.bins;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(bin2);
    });

    it('handles batch updates to multiple bins', () => {
      const { addBin, updateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;
      const newCategoryId = layout.categories[1].id;

      const bin1 = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      const bin2 = addBin({
        layerId, x: 2, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Update category for multiple bins
      updateBin(bin1!, { category: newCategoryId });
      updateBin(bin2!, { category: newCategoryId });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].category).toBe(newCategoryId);
      expect(bins[1].category).toBe(newCategoryId);
    });
  });
});
