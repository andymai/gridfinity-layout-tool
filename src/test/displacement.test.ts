import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../store/layout';
import { createDefaultLayout, STAGING_ID } from '../constants';

describe('bin displacement logic', () => {
  beforeEach(() => {
    useLayoutStore.setState({ layout: createDefaultLayout() });
  });

  describe('drawer resize causing bins to move to staging', () => {
    it('moves bins to staging when drawer width shrinks below bin position', () => {
      const { addBin, updateDrawer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin at far right edge of 10-wide drawer
      addBin({
        layerId,
        x: 8, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: 'Edge bin', notes: '',
      });

      // Verify bin is on layer
      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe(layerId);

      // Shrink drawer width to 5 (bin at x=8 is now out of bounds)
      updateDrawer({ width: 5 });

      // Bin should be moved to staging
      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.layerId).toBe(STAGING_ID);
    });

    it('moves bins to staging when drawer depth shrinks below bin position', () => {
      const { addBin, updateDrawer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin at far top of 8-deep drawer
      addBin({
        layerId,
        x: 0, y: 6, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe(layerId);

      // Shrink drawer depth to 4
      updateDrawer({ depth: 4 });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.layerId).toBe(STAGING_ID);
    });

    it('keeps bins in place when drawer resize does not affect them', () => {
      const { addBin, updateDrawer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin at origin
      addBin({
        layerId,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Shrink drawer but bin still fits
      updateDrawer({ width: 5, depth: 5 });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.layerId).toBe(layerId);
      expect(bin.x).toBe(0);
      expect(bin.y).toBe(0);
    });

    it('moves only affected bins when multiple exist', () => {
      const { addBin, updateDrawer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin at origin (will survive resize)
      const bin1 = addBin({
        layerId,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: 'Survivor', notes: '',
      });

      // Add bin at edge (will be displaced)
      const bin2 = addBin({
        layerId,
        x: 8, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: 'Displaced', notes: '',
      });

      // Shrink drawer
      updateDrawer({ width: 5 });

      const bins = useLayoutStore.getState().layout.bins;
      const survivorBin = bins.find(b => b.id === bin1);
      const displacedBin = bins.find(b => b.id === bin2);

      expect(survivorBin?.layerId).toBe(layerId);
      expect(displacedBin?.layerId).toBe(STAGING_ID);
    });

    it('displaces bin when it partially exceeds new drawer bounds', () => {
      const { addBin, updateDrawer, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add 3-wide bin starting at x=3
      // Bin occupies x: 3, 4, 5 (ends at 6)
      addBin({
        layerId,
        x: 3, y: 0, width: 3, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Shrink to width 5 - bin at x=3 with width=3 needs x+width <= 5
      // 3 + 3 = 6 > 5, so bin should be displaced
      updateDrawer({ width: 5 });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.layerId).toBe(STAGING_ID);
    });
  });

  describe('drawer height changes', () => {
    it('clamps drawer height to minimum of layer heights', () => {
      const { updateDrawer, addLayer } = useLayoutStore.getState();

      // Add a second layer (each starts with height 3)
      addLayer();

      // Total layer height is now 6
      // Try to set drawer height below this
      updateDrawer({ height: 4 });

      // Drawer height should be clamped to at least 6
      const drawer = useLayoutStore.getState().layout.drawer;
      expect(drawer.height).toBeGreaterThanOrEqual(6);
    });

    it('allows increasing drawer height freely', () => {
      const { updateDrawer } = useLayoutStore.getState();

      updateDrawer({ height: 20 });

      const drawer = useLayoutStore.getState().layout.drawer;
      expect(drawer.height).toBe(20);
    });
  });

  describe('collision prevention when adding bins', () => {
    it('returns null when adding bin that would collide with existing', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add first bin
      addBin({
        layerId,
        x: 0, y: 0, width: 3, depth: 3, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Try to add overlapping bin
      const result = addBin({
        layerId,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(result).toBeNull();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });

    it('allows adding bin adjacent to existing bin', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      addBin({
        layerId,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Add adjacent bin (touching but not overlapping)
      const adjacentId = addBin({
        layerId,
        x: 2, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(adjacentId).not.toBeNull();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(2);
    });

    it('allows adding bin in same footprint on different layer', () => {
      const { addBin, addLayer, layout } = useLayoutStore.getState();
      const layer1Id = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin on layer 1 with layer's minimum height (no clearance = no protrusion)
      // Layer 1 default height is 3, so bin height must be >= 3
      addBin({
        layerId: layer1Id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Add layer 2 (stacks on top of layer 1)
      const layer2Id = addLayer()!;

      // Add bin on layer 2 in same footprint
      // Since layer 1 bin has no clearanceHeight, it doesn't protrude into layer 2
      // Layer 2 also has height 3, so bin must be >= 3
      const layer2BinId = addBin({
        layerId: layer2Id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      expect(layer2BinId).not.toBeNull();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(2);
    });
  });

  describe('staging to grid movement', () => {
    it('successfully moves bin from staging to valid grid position', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin to staging
      const binId = addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Move to grid
      const success = moveBinFromStaging(binId!, layerId, 0, 0);

      expect(success).toBe(true);
      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.layerId).toBe(layerId);
      expect(bin.x).toBe(0);
      expect(bin.y).toBe(0);
    });

    it('fails to move bin from staging to occupied position', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin to grid
      addBin({
        layerId,
        x: 0, y: 0, width: 3, depth: 3, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Add bin to staging
      const stagingBinId = addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Try to move to overlapping position
      const success = moveBinFromStaging(stagingBinId!, layerId, 1, 1);

      expect(success).toBe(false);

      // Bin should still be in staging
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === stagingBinId);
      expect(bin?.layerId).toBe(STAGING_ID);
    });

    it('fails to move bin from staging to out-of-bounds position', () => {
      const { addBin, moveBinFromStaging, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add bin to staging
      const binId = addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 3, depth: 3, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Try to move to position that would exceed bounds
      // Drawer is 10x8, bin is 3x3, so x=8 means x+width=11 > 10
      const success = moveBinFromStaging(binId!, layerId, 8, 0);

      expect(success).toBe(false);

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.layerId).toBe(STAGING_ID);
    });

    it('updates bin height to match target layer height', () => {
      const { addBin, addLayer, updateLayer, moveBinFromStaging, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      // Add second layer with different height
      const layer2Id = addLayer()!;
      updateLayer(layer2Id, { height: 5 });

      // Add bin to staging with original height
      const binId = addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Move to layer 2
      moveBinFromStaging(binId!, layer2Id, 0, 0);

      // Bin height should match layer 2 height
      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.height).toBe(5);
    });
  });

  describe('duplicate displacement to staging', () => {
    it('moves duplicate to staging when no adjacent space available', () => {
      const { fillLayer, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Fill entire layer with 1x1 bins
      fillLayer(layerId, 1, 1, categoryId);

      // Try to duplicate a bin - no adjacent space
      const bins = useLayoutStore.getState().layout.bins;
      const someBin = bins.find(b => b.layerId === layerId);

      const dupId = duplicateBin(someBin!.id);

      // Duplicate should go to staging
      expect(dupId).not.toBeNull();
      const dupBin = useLayoutStore.getState().layout.bins.find(b => b.id === dupId);
      expect(dupBin?.layerId).toBe(STAGING_ID);
    });

    it('places duplicate adjacent when space is available', () => {
      const { addBin, duplicateBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add single bin with space around it
      const binId = addBin({
        layerId,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      const dupId = duplicateBin(binId!);

      expect(dupId).not.toBeNull();
      const dupBin = useLayoutStore.getState().layout.bins.find(b => b.id === dupId);

      // Should be on the same layer, adjacent to original
      expect(dupBin?.layerId).toBe(layerId);
      // Check it's adjacent (one of: right, below, left, above)
      const isAdjacent =
        (dupBin?.x === 4 && dupBin?.y === 2) || // right
        (dupBin?.x === 2 && dupBin?.y === 0) || // below
        (dupBin?.x === 0 && dupBin?.y === 2) || // left
        (dupBin?.x === 2 && dupBin?.y === 4);   // above
      expect(isAdjacent).toBe(true);
    });
  });
});
