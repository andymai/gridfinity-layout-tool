import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useHistoryStore } from '@/core/store/history';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { createDefaultLayout, CONSTRAINTS } from '@/core/constants';
import { isOk } from '@/core/result';
import { resetAllStores } from '@/test/testUtils';

describe('history store', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('push', () => {
    it('adds layout to history', () => {
      const { push } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      push(JSON.parse(JSON.stringify(layout)), 'bin.add');

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(1);
      expect(state.canUndo).toBe(true);
    });

    it('clears future on new push', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      // Push twice, then undo
      push(JSON.parse(JSON.stringify(layout)), 'bin.add');
      useLayoutStore.getState().setName('State 2');
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)), 'bin.add');

      undo();
      expect(useHistoryStore.getState().canRedo).toBe(true);

      // Push new state - should clear future
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)), 'bin.add');
      expect(useHistoryStore.getState().canRedo).toBe(false);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('limits history to UNDO_LIMIT', () => {
      const { push } = useHistoryStore.getState();

      // Push more than the limit
      for (let i = 0; i < CONSTRAINTS.UNDO_LIMIT + 10; i++) {
        const layout = { ...createDefaultLayout(), name: `State ${i}` };
        push(layout, 'bin.add');
      }

      const state = useHistoryStore.getState();
      expect(state.past.length).toBeLessThanOrEqual(CONSTRAINTS.UNDO_LIMIT);
    });
  });

  describe('undo', () => {
    it('restores previous layout state', () => {
      const { push, undo } = useHistoryStore.getState();
      const originalLayout = useLayoutStore.getState().layout;

      // Save original state
      push(JSON.parse(JSON.stringify(originalLayout)), 'bin.add');

      // Modify layout
      useLayoutStore.getState().setName('Modified Name');
      expect(useLayoutStore.getState().layout.name).toBe('Modified Name');

      // Undo
      undo();
      expect(useLayoutStore.getState().layout.name).toBe('Untitled layout');
    });

    it('moves current state to future', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      push(JSON.parse(JSON.stringify(layout)), 'bin.add');
      useLayoutStore.getState().setName('Modified');

      undo();

      const state = useHistoryStore.getState();
      expect(state.future).toHaveLength(1);
      expect(state.future[0].layout.name).toBe('Modified');
      expect(state.canRedo).toBe(true);
    });

    it('does nothing when past is empty', () => {
      const { undo } = useHistoryStore.getState();

      useLayoutStore.getState().setName('Current State');
      undo();

      // Should still be the current state
      expect(useLayoutStore.getState().layout.name).toBe('Current State');
    });

    it('updates canUndo correctly after undo', () => {
      const { push, undo } = useHistoryStore.getState();

      // Push two states
      push(JSON.parse(JSON.stringify(createDefaultLayout())), 'bin.add');
      push(JSON.parse(JSON.stringify({ ...createDefaultLayout(), name: 'Second' })), 'bin.add');

      expect(useHistoryStore.getState().canUndo).toBe(true);

      undo();
      expect(useHistoryStore.getState().canUndo).toBe(true); // Still one in past

      undo();
      expect(useHistoryStore.getState().canUndo).toBe(false); // Past is empty now
    });
  });

  describe('redo', () => {
    it('restores next layout state', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      push(JSON.parse(JSON.stringify(createDefaultLayout())), 'bin.add');
      useLayoutStore.getState().setName('Modified');

      undo();
      expect(useLayoutStore.getState().layout.name).toBe('Untitled layout');

      redo();
      expect(useLayoutStore.getState().layout.name).toBe('Modified');
    });

    it('moves current state to past', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      push(JSON.parse(JSON.stringify(createDefaultLayout())), 'bin.add');
      useLayoutStore.getState().setName('Modified');

      undo();

      const pastLengthBefore = useHistoryStore.getState().past.length;
      redo();

      expect(useHistoryStore.getState().past.length).toBe(pastLengthBefore + 1);
    });

    it('does nothing when future is empty', () => {
      const { redo } = useHistoryStore.getState();

      useLayoutStore.getState().setName('Current State');
      redo();

      expect(useLayoutStore.getState().layout.name).toBe('Current State');
    });

    it('updates canRedo correctly after redo', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      push(JSON.parse(JSON.stringify(createDefaultLayout())), 'bin.add');
      useLayoutStore.getState().setName('State 2');
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)), 'bin.add');
      useLayoutStore.getState().setName('State 3');

      undo();
      undo();

      expect(useHistoryStore.getState().canRedo).toBe(true);
      expect(useHistoryStore.getState().future).toHaveLength(2);

      redo();
      expect(useHistoryStore.getState().canRedo).toBe(true); // Still one in future

      redo();
      expect(useHistoryStore.getState().canRedo).toBe(false); // Future is empty
    });
  });

  describe('clear', () => {
    it('clears all history', () => {
      const { push, undo, clear } = useHistoryStore.getState();

      push(JSON.parse(JSON.stringify(createDefaultLayout())), 'bin.add');
      push(JSON.parse(JSON.stringify({ ...createDefaultLayout(), name: 'Second' })), 'bin.add');
      undo();

      expect(useHistoryStore.getState().past.length).toBeGreaterThan(0);
      expect(useHistoryStore.getState().future.length).toBeGreaterThan(0);

      clear();

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(0);
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);
    });
  });

  describe('store encapsulation', () => {
    it('undo calls restoreLayout instead of raw setState', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      push(JSON.parse(JSON.stringify(layout)), 'bin.add');
      useLayoutStore.getState().setName('Modified');

      const restoreSpy = vi.spyOn(useLayoutStore.getState(), 'restoreLayout');
      undo();

      expect(restoreSpy).toHaveBeenCalledOnce();
      expect(restoreSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Untitled layout' }));
    });

    it('redo calls restoreLayout instead of raw setState', () => {
      const { push } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      push(JSON.parse(JSON.stringify(layout)), 'bin.add');
      useLayoutStore.getState().setName('Modified');

      // Set up spy before any undo/redo
      const restoreSpy = vi.spyOn(useLayoutStore.getState(), 'restoreLayout');

      useHistoryStore.getState().undo();
      restoreSpy.mockClear(); // Clear the undo call

      useHistoryStore.getState().redo();

      expect(restoreSpy).toHaveBeenCalledOnce();
      expect(restoreSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Modified' }));
    });

    it('undo calls restoreSelection for stale selection pruning', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      push(JSON.parse(JSON.stringify(layout)), 'bin.add');

      const addResult = useLayoutStore.getState().addBin({
        layerId,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });
      if (!isOk(addResult)) throw new Error('addBin failed');

      useSelectionStore.setState({ selectedBinIds: [addResult.value] });

      const restoreSpy = vi.spyOn(useSelectionStore.getState(), 'restoreSelection');
      undo();

      expect(restoreSpy).toHaveBeenCalledOnce();
      expect(restoreSpy).toHaveBeenCalledWith(expect.objectContaining({ selectedBinIds: [] }));
    });
  });

  describe('performance', () => {
    it('handles large layouts with 2500 bins efficiently', { timeout: 60000 }, () => {
      const { push, undo, redo } = useHistoryStore.getState();

      // Create a layout with 2500 bins (the fill limit)
      const layout = createDefaultLayout();
      layout.drawer = { width: 50, depth: 50, height: 12 };

      // Generate 2500 bins (50x50 grid of 1x1 bins)
      const bins = [];
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          bins.push({
            id: `bin-${x}-${y}`,
            layerId: layout.layers[0].id,
            x,
            y,
            width: 1,
            depth: 1,
            height: 3,
            category: layout.categories[0].id,
            label: `Bin ${x},${y}`,
            notes: '',
          });
        }
      }
      layout.bins = bins;
      expect(layout.bins).toHaveLength(2500);

      // Set the layout
      useLayoutStore.setState({ layout });

      // Measure time for 10 push operations (simulating 10 undoable actions)
      const startPush = performance.now();
      for (let i = 0; i < 10; i++) {
        push(
          structuredClone ? structuredClone(layout) : JSON.parse(JSON.stringify(layout)),
          'bin.add'
        );
      }
      const pushDuration = performance.now() - startPush;

      // Should complete in reasonable time (<20000ms for 10 pushes).
      // Threshold is very generous to avoid flakiness in CI environments
      // which can be 5-10x slower than local dev machines. Still catches O(n²) regressions.
      expect(pushDuration).toBeLessThan(20000);

      // Measure undo/redo performance
      const startUndoRedo = performance.now();
      for (let i = 0; i < 5; i++) {
        undo();
        redo();
      }
      const undoRedoDuration = performance.now() - startUndoRedo;

      // Should complete in reasonable time. Very generous threshold for CI environments
      // which can be 5-10x slower than local dev. Still catches algorithmic regressions.
      expect(undoRedoDuration).toBeLessThan(20000);
    });
  });

  describe('undo/redo workflow', () => {
    it('handles complex undo/redo sequence', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      // Initial state
      const initial = useLayoutStore.getState().layout;
      push(JSON.parse(JSON.stringify(initial)), 'bin.add');

      // State 1: Add a bin
      useLayoutStore.getState().addBin({
        layerId: initial.layers[0].id,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: initial.categories[0].id,
        label: 'Bin 1',
        notes: '',
      });
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)), 'bin.add');

      // State 2: Add another bin
      useLayoutStore.getState().addBin({
        layerId: initial.layers[0].id,
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: initial.categories[0].id,
        label: 'Bin 2',
        notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(2);

      // Undo back to 1 bin
      undo();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
      expect(useLayoutStore.getState().layout.bins[0].label).toBe('Bin 1');

      // Undo back to 0 bins
      undo();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);

      // Redo to 1 bin
      redo();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

      // Redo to 2 bins
      redo();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(2);
    });
  });

  describe('selection pruning on undo/redo', () => {
    it('clears selectedBinIds for bins removed by undo', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Save state before adding bin
      push(JSON.parse(JSON.stringify(layout)), 'bin.add');

      // Add a bin
      const addResult = useLayoutStore.getState().addBin({
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

      if (!isOk(addResult)) throw new Error('addBin failed');
      const binId = addResult.value;

      // Select the new bin
      useSelectionStore.setState({ selectedBinIds: [binId] });
      expect(useSelectionStore.getState().selectedBinIds).toContain(binId);

      // Undo the bin creation
      undo();

      // Bin should not exist in layout
      expect(useLayoutStore.getState().layout.bins.find((b) => b.id === binId)).toBeUndefined();
      // Selection should be pruned
      expect(useSelectionStore.getState().selectedBinIds).not.toContain(binId);
    });

    it('clears focusedBinId when focused bin is removed by undo', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      push(JSON.parse(JSON.stringify(layout)), 'bin.add');

      const addResult = useLayoutStore.getState().addBin({
        layerId,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      if (!isOk(addResult)) throw new Error('addBin failed');
      const binId = addResult.value;

      useSelectionStore.setState({ focusedBinId: binId });

      undo();

      expect(useSelectionStore.getState().focusedBinId).toBeNull();
    });

    it('clears quickLabelBinId when bin is removed by undo', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      push(JSON.parse(JSON.stringify(layout)), 'bin.add');

      const addResult = useLayoutStore.getState().addBin({
        layerId,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      if (!isOk(addResult)) throw new Error('addBin failed');
      const binId = addResult.value;

      useSelectionStore.setState({ quickLabelBinId: binId });

      undo();

      expect(useSelectionStore.getState().quickLabelBinId).toBeNull();
    });

    it('preserves selectedBinIds for bins that still exist after undo', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add first bin
      const result1 = useLayoutStore.getState().addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Bin1',
        notes: '',
      });
      if (!isOk(result1)) throw new Error('addBin failed');
      const bin1Id = result1.value;

      // Save state with 1 bin
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)), 'bin.add');

      // Add second bin
      const result2 = useLayoutStore.getState().addBin({
        layerId,
        x: 4,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Bin2',
        notes: '',
      });
      if (!isOk(result2)) throw new Error('addBin failed');
      const bin2Id = result2.value;

      // Select both bins
      useSelectionStore.setState({ selectedBinIds: [bin1Id, bin2Id] });

      // Undo removes bin2 but keeps bin1
      undo();

      // Only bin1 should remain in selection
      expect(useSelectionStore.getState().selectedBinIds).toEqual([bin1Id]);
    });

    it('resets activeLayerId when active layer does not exist in restored layout', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;
      // Save state with only the default layer
      push(JSON.parse(JSON.stringify(layout)), 'bin.add');

      // Add a new layer and switch to it
      const addLayerResult = useLayoutStore.getState().addLayer('Layer 2');
      if (!isOk(addLayerResult)) throw new Error('addLayer failed');
      const newLayerId = addLayerResult.value;

      // Set the new layer as active
      useSelectionStore.setState({ activeLayerId: newLayerId });
      expect(useSelectionStore.getState().activeLayerId).toBe(newLayerId);

      // Undo the layer addition — restores layout without the new layer
      undo();

      // The active layer should be reset to a valid layer from the restored layout
      const activeLayerAfterUndo = useSelectionStore.getState().activeLayerId;
      const restoredLayers = useLayoutStore.getState().layout.layers;
      const activeLayerExists = restoredLayers.some((l) => l.id === activeLayerAfterUndo);
      expect(activeLayerExists).toBe(true);
    });

    it('resets activeCategoryId when active category does not exist in restored layout', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      // Save state
      push(JSON.parse(JSON.stringify(layout)), 'bin.add');

      // Add a new category and switch to it
      const addCatResult = useLayoutStore.getState().addCategory('Custom Cat');
      if (!isOk(addCatResult)) throw new Error('addCategory failed');
      const newCatId = addCatResult.value;

      useSelectionStore.setState({ activeCategoryId: newCatId });
      expect(useSelectionStore.getState().activeCategoryId).toBe(newCatId);

      // Undo — restores layout without the new category
      undo();

      const activeCatAfterUndo = useSelectionStore.getState().activeCategoryId;
      const restoredCategories = useLayoutStore.getState().layout.categories;
      const activeCatExists = restoredCategories.some((c) => c.id === activeCatAfterUndo);
      expect(activeCatExists).toBe(true);
    });

    it('prunes stale selections on redo', () => {
      const { push, undo, redo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add a bin
      const addResult = useLayoutStore.getState().addBin({
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
      if (!isOk(addResult)) throw new Error('addBin failed');
      const binId = addResult.value;

      // Save state with 1 bin
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)), 'bin.add');

      // Delete the bin
      useLayoutStore.getState().deleteBin(binId);

      // Select a fake bin ID that doesn't exist
      useSelectionStore.setState({ selectedBinIds: ['nonexistent-id'] });

      // Undo back to state with 1 bin
      undo();

      // After undo, 'nonexistent-id' should be pruned (doesn't exist in restored state)
      expect(useSelectionStore.getState().selectedBinIds).not.toContain('nonexistent-id');

      // Redo back to state with 0 bins
      useSelectionStore.setState({ selectedBinIds: [binId] });
      redo();

      // After redo, binId should be pruned (bin was deleted in this state)
      expect(useSelectionStore.getState().selectedBinIds).not.toContain(binId);
    });
  });

  describe('selection snapshot restoration', () => {
    it('undo restores the captured activeLayerId, not layers[0]', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;
      const addLayerResult = useLayoutStore.getState().addLayer();
      if (!isOk(addLayerResult)) throw new Error('addLayer failed');
      const topLayerId = addLayerResult.value;

      // User has the top layer active.
      useSelectionStore.getState().setActiveLayer(topLayerId);

      // Snapshot at this moment: layout has both layers, active = topLayerId.
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)), 'bin.add', {
        activeLayerId: topLayerId,
        activeCategoryId: useSelectionStore.getState().activeCategoryId,
        selectedBinIds: [],
        focusedBinId: null,
        quickLabelBinId: null,
      });

      // User performs some other action that would reset active layer via pruning
      // (simulate by directly changing active layer first)
      useSelectionStore.getState().setActiveLayer(layout.layers[0].id);

      undo();

      // Previously undo fell back to layers[0] because it used pruning on the
      // current selection. With the snapshot, the user's prior active layer is
      // restored faithfully.
      expect(useSelectionStore.getState().activeLayerId).toBe(topLayerId);
    });

    it('falls back to pruning when a history entry has no selection snapshot', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      // Legacy-style push (no selection snapshot) — should still work.
      push(JSON.parse(JSON.stringify(layout)), 'bin.add');

      useLayoutStore.getState().setName('Modified');
      undo();

      expect(useLayoutStore.getState().layout.name).toBe(layout.name);
    });
  });
});
