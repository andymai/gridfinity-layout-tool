import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import { expectOk, expectErr } from '@/test/testUtils';
import { gridUnits, heightUnits } from '@/core/types';

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
      const result1 = addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: 'Bin 1',
        notes: '',
      });
      const result2 = addBin({
        layerId,
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: 'Bin 2',
        notes: '',
      });

      const bin1Id = expectOk(result1);
      const bin2Id = expectOk(result2);

      // Simulate moving both bins (update positions)
      updateBin(bin1Id, { x: gridUnits(0), y: gridUnits(4) });
      updateBin(bin2Id, { x: gridUnits(2), y: gridUnits(4) });

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
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      // Add second bin at position that would collide if moved
      addBin({
        layerId,
        x: gridUnits(4),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      // Third bin - if we tried to add at (1,0), it would collide with first
      const collidingResult = addBin({
        layerId,
        x: gridUnits(1),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      // Should return error because of collision
      expectErr(collidingResult);
    });
  });

  describe('duplicate bin ID remapping', () => {
    it('generates unique ID when duplicating bin', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: 'Original',
        notes: '',
      });

      const addResultValue = expectOk(addResult);

      const originalId = addResultValue;
      const dupResult = duplicateBin(originalId);

      const dupResultValue = expectOk(dupResult);

      const duplicateId = dupResultValue;
      expect(duplicateId).not.toBe(originalId);

      const bins = useLayoutStore.getState().layout.bins;
      const ids = bins.map((b) => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(bins.length);
    });

    it('copies all bin properties except ID and position', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(3),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: 'Test Label',
        notes: 'Test notes',
        clearanceHeight: heightUnits(2),
      });

      const addResultValue = expectOk(addResult);

      const originalId = addResultValue;
      const dupResult = duplicateBin(originalId);

      const dupResultValue = expectOk(dupResult);

      const duplicateId = dupResultValue;
      const bins = useLayoutStore.getState().layout.bins;
      const original = bins.find((b) => b.id === originalId);
      const duplicate = bins.find((b) => b.id === duplicateId);

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

      const addResult = addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      const addResultValue = expectOk(addResult);

      const originalId = addResultValue;

      // Duplicate multiple times
      const dup1 = duplicateBin(originalId);
      const dup2 = duplicateBin(originalId);
      const dup3 = duplicateBin(originalId);

      const dup1Id = expectOk(dup1);
      const dup2Id = expectOk(dup2);
      const dup3Id = expectOk(dup3);

      const ids = [originalId, dup1Id, dup2Id, dup3Id];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);
    });
  });

  describe('delete cascade to staging cleanup', () => {
    it('removes bin from staging when deleted', () => {
      const { addBin, deleteBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      // Add bin directly to staging
      const addResult = addBin({
        layerId: STAGING_ID,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      const addResultValue = expectOk(addResult);

      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

      deleteBin(addResultValue);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('clears all staging bins when using clearLayer on grid layer', () => {
      const { addBin, clearLayer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bins to layer
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });
      addBin({
        layerId,
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      // Add bin to staging
      addBin({
        layerId: STAGING_ID,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(3);

      // Clear only the grid layer
      clearLayer(layerId);

      // Staging bin should remain
      const remainingBins = useLayoutStore.getState().layout.bins;
      expect(remainingBins).toHaveLength(1);
      expect(remainingBins[0].layerId).toBe(STAGING_ID);
    });

    it('stages bins from deleted layer without affecting existing staging bins', () => {
      const { addBin, addLayer, deleteLayer, layout } = useLayoutStore.getState();
      const layer1Id = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add second layer
      const layerResult = addLayer();
      const layerResultValue = expectOk(layerResult);

      const layer2Id = layerResultValue;

      // Add bin to each layer
      const bin1Result = addBin({
        layerId: layer1Id,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });
      const bin2Result = addBin({
        layerId: layer2Id,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      // Add to staging
      const bin3Result = addBin({
        layerId: STAGING_ID,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      expectOk(bin1Result);
      expectOk(bin2Result);
      expectOk(bin3Result);

      expect(useLayoutStore.getState().layout.bins).toHaveLength(3);

      // Delete layer 1 — bin1 should be staged, not removed
      deleteLayer(layer1Id);

      const remainingBins = useLayoutStore.getState().layout.bins;
      expect(remainingBins).toHaveLength(3);

      const layerIds = remainingBins.map((b) => b.layerId);
      expect(layerIds).toContain(layer2Id);
      // Both the original staging bin and the newly staged bin from layer1
      expect(remainingBins.filter((b) => b.layerId === STAGING_ID)).toHaveLength(2);
    });
  });

  describe('bulk resize scenarios', () => {
    it('allows resizing bin when space is available', () => {
      const { addBin, updateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      const addResultValue = expectOk(addResult);

      // Resize the bin
      updateBin(addResultValue, { width: gridUnits(4), depth: gridUnits(4) });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.width).toBe(4);
      expect(bin.depth).toBe(4);
    });

    it('preserves bin position when resizing', () => {
      const { addBin, updateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const addResult = addBin({
        layerId,
        x: gridUnits(2),
        y: gridUnits(2),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      const addResultValue = expectOk(addResult);

      updateBin(addResultValue, { width: gridUnits(3), depth: gridUnits(3) });

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

      const bin1Result = addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });
      const bin2Result = addBin({
        layerId,
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });
      const bin3Result = addBin({
        layerId,
        x: gridUnits(4),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      const bin1Id = expectOk(bin1Result);
      const bin2Id = expectOk(bin2Result);
      const bin3Id = expectOk(bin3Result);

      expect(useLayoutStore.getState().layout.bins).toHaveLength(3);

      // Delete multiple
      deleteBin(bin1Id);
      deleteBin(bin3Id);

      const remaining = useLayoutStore.getState().layout.bins;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(bin2Id);
    });

    it('handles batch updates to multiple bins', () => {
      const { addBin, updateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;
      const newCategoryId = layout.categories[1].id;

      const bin1Result = addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });
      const bin2Result = addBin({
        layerId,
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      });

      const bin1Id = expectOk(bin1Result);
      const bin2Id = expectOk(bin2Result);

      // Update category for multiple bins
      updateBin(bin1Id, { category: newCategoryId });
      updateBin(bin2Id, { category: newCategoryId });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].category).toBe(newCategoryId);
      expect(bins[1].category).toBe(newCategoryId);
    });
  });
});
