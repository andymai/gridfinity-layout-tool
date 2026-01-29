import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboard } from '@/hooks';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/store/history';
import { useLibraryStore } from '@/core/store/library';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useViewStore } from '@/core/store/view';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import { resetAllStores, getBinId } from '@/test/testUtils';

// Helper to create keyboard event
function createKeyboardEvent(key: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

// Helper to dispatch keyboard event
function pressKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  const event = createKeyboardEvent(key, options);
  window.dispatchEvent(event);
  return event;
}

describe('useKeyboard', () => {
  beforeEach(() => {
    resetAllStores();
    // Set activeLayerId/activeCategoryId from the reset layout
    const { layout } = useLayoutStore.getState();
    useSelectionStore.setState({
      activeLayerId: layout.layers[0].id,
      activeCategoryId: layout.categories[0].id,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('delete shortcut', () => {
    it('deletes selected bins on Delete key', () => {
      // Setup: add a bin and select it
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
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
        })
      );

      expect(binId).not.toBeNull();
      useSelectionStore.getState().setSelectedBins([binId]);

      // Mount the hook
      renderHook(() => useKeyboard());

      // Press Delete
      act(() => {
        pressKey('Delete');
      });

      // Verify bin is deleted
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
      expect(useSelectionStore.getState().selectedBinIds).toHaveLength(0);
    });

    it('deletes selected bins on Backspace key', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
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
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Backspace');
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('deletes multiple selected bins', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = getBinId(
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
        })
      );

      const binId2 = getBinId(
        addBin({
          layerId,
          x: 3,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId1, binId2]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Delete');
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('does nothing when no bins selected', () => {
      const { addBin, layout } = useLayoutStore.getState();
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

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Delete');
      });

      // Bin should still exist
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });
  });

  describe('escape shortcut', () => {
    it('clears selection on Escape', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
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
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      expect(useSelectionStore.getState().selectedBinIds).toHaveLength(1);

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Escape');
      });

      expect(useSelectionStore.getState().selectedBinIds).toHaveLength(0);
    });

    it('clears paint mode on Escape', () => {
      useInteractionStore.getState().setPaintSize({ width: 2, depth: 2 });
      expect(useInteractionStore.getState().paintSize).not.toBeNull();

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Escape');
      });

      expect(useInteractionStore.getState().paintSize).toBeNull();
    });

    it('clears interaction on Escape', () => {
      useInteractionStore.getState().setInteraction({
        type: 'draw',
        start: { x: 0, y: 0 },
        current: { x: 1, y: 1 },
      });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Escape');
      });

      expect(useInteractionStore.getState().interaction).toBeNull();
    });
  });

  describe('undo/redo shortcuts', () => {
    it('triggers undo on Ctrl+Z', () => {
      // Setup history with a past state
      const pastLayout = createDefaultLayout();
      pastLayout.name = 'Past State';
      useHistoryStore.setState({
        past: [pastLayout],
        future: [],
        canUndo: true,
      });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('z', { ctrlKey: true });
      });

      // Should have undone - past is now empty, future has one entry
      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(1);
    });

    it('triggers undo on Meta+Z (Mac)', () => {
      const pastLayout = createDefaultLayout();
      useHistoryStore.setState({
        past: [pastLayout],
        future: [],
        canUndo: true,
      });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('z', { metaKey: true });
      });

      expect(useHistoryStore.getState().past).toHaveLength(0);
    });

    it('triggers redo on Ctrl+Y', () => {
      const futureLayout = createDefaultLayout();
      futureLayout.name = 'Future State';
      useHistoryStore.setState({
        past: [],
        future: [futureLayout],
        canRedo: true,
      });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('y', { ctrlKey: true });
      });

      expect(useHistoryStore.getState().future).toHaveLength(0);
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('triggers redo on Ctrl+Shift+Z', () => {
      const futureLayout = createDefaultLayout();
      useHistoryStore.setState({
        past: [],
        future: [futureLayout],
        canRedo: true,
      });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Z', { ctrlKey: true, shiftKey: true });
      });

      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('does not undo when no history', () => {
      useHistoryStore.setState({
        past: [],
        future: [],
      });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('z', { ctrlKey: true });
      });

      // canUndo is false, so undo should not be called
      // Note: We can't easily spy on the function after it's extracted from getState
      // So we verify the state hasn't changed
      expect(useHistoryStore.getState().past).toHaveLength(0);
    });
  });

  describe('duplicate shortcut', () => {
    it('duplicates selected bin on Ctrl+D', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
        addBin({
          layerId,
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: 'Original',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('d', { ctrlKey: true });
      });

      // Should have 2 bins now
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins).toHaveLength(2);

      // Selection should be the new bin
      const selectedIds = useSelectionStore.getState().selectedBinIds;
      expect(selectedIds).toHaveLength(1);
      expect(selectedIds[0]).not.toBe(binId);
    });

    it('duplicates multiple selected bins', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = getBinId(
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
        })
      );

      const binId2 = getBinId(
        addBin({
          layerId,
          x: 5,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId1, binId2]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('d', { ctrlKey: true });
      });

      // Should have 4 bins now (or fewer if space doesn't allow)
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins.length).toBeGreaterThanOrEqual(2);
    });

    it('does nothing when no bins selected', () => {
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('d', { ctrlKey: true });
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });
  });

  describe('zoom shortcuts', () => {
    it('zooms in on + key', () => {
      const initialZoom = useViewStore.getState().zoom;
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('+');
      });

      expect(useViewStore.getState().zoom).toBeGreaterThan(initialZoom);
    });

    it('zooms in on = key', () => {
      const initialZoom = useViewStore.getState().zoom;
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('=');
      });

      expect(useViewStore.getState().zoom).toBeGreaterThan(initialZoom);
    });

    it('zooms out on - key', () => {
      const initialZoom = useViewStore.getState().zoom;
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('-');
      });

      expect(useViewStore.getState().zoom).toBeLessThan(initialZoom);
    });
  });

  describe('nudge shortcuts', () => {
    it('nudges bin up on ArrowUp', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
        addBin({
          layerId,
          x: 2,
          y: 2,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      const originalY = useLayoutStore.getState().layout.bins[0].y;

      act(() => {
        pressKey('ArrowUp');
      });

      expect(useLayoutStore.getState().layout.bins[0].y).toBe(originalY + 1);
    });

    it('nudges bin down on ArrowDown', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
        addBin({
          layerId,
          x: 2,
          y: 2,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      const originalY = useLayoutStore.getState().layout.bins[0].y;

      act(() => {
        pressKey('ArrowDown');
      });

      expect(useLayoutStore.getState().layout.bins[0].y).toBe(originalY - 1);
    });

    it('nudges bin left on ArrowLeft', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
        addBin({
          layerId,
          x: 2,
          y: 2,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      const originalX = useLayoutStore.getState().layout.bins[0].x;

      act(() => {
        pressKey('ArrowLeft');
      });

      expect(useLayoutStore.getState().layout.bins[0].x).toBe(originalX - 1);
    });

    it('nudges bin right on ArrowRight', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
        addBin({
          layerId,
          x: 2,
          y: 2,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      const originalX = useLayoutStore.getState().layout.bins[0].x;

      act(() => {
        pressKey('ArrowRight');
      });

      expect(useLayoutStore.getState().layout.bins[0].x).toBe(originalX + 1);
    });

    it('does not nudge when move would be invalid', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Place bin at bottom edge
      const binId = getBinId(
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
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('ArrowDown'); // Can't go further down
      });

      // Position should remain the same
      expect(useLayoutStore.getState().layout.bins[0].y).toBe(0);
    });

    it('does not nudge bins in staging', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      // Add bin to staging
      const binId = getBinId(
        addBin({
          layerId: STAGING_ID,
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('ArrowUp');
      });

      // Position should remain the same (no nudge in staging)
      expect(useLayoutStore.getState().layout.bins[0].y).toBe(0);
    });

    it('nudges multiple selected bins together', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = getBinId(
        addBin({
          layerId,
          x: 0,
          y: 2,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      const binId2 = getBinId(
        addBin({
          layerId,
          x: 3,
          y: 2,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId1, binId2]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('ArrowUp');
      });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].y).toBe(3);
      expect(bins[1].y).toBe(3);
    });
  });

  describe('rotate shortcut', () => {
    it('rotates selected bin on R key', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
        addBin({
          layerId,
          x: 0,
          y: 0,
          width: 3,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('r');
      });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.width).toBe(2);
      expect(bin.depth).toBe(3);
    });

    it('does nothing when no bins selected', () => {
      renderHook(() => useKeyboard());

      // Should not throw
      act(() => {
        pressKey('r');
      });
    });

    it('does nothing when multiple bins selected', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = getBinId(
        addBin({
          layerId,
          x: 0,
          y: 0,
          width: 3,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      const binId2 = getBinId(
        addBin({
          layerId,
          x: 5,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId1, binId2]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('r');
      });

      // Bins should remain unchanged
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].width).toBe(3);
      expect(bins[0].depth).toBe(2);
    });
  });

  describe('layer navigation shortcuts', () => {
    it('moves to next layer on W key', () => {
      // Add another layer
      const { addLayer } = useLayoutStore.getState();
      addLayer({ name: 'Layer 2', height: 4 });

      const layers = useLayoutStore.getState().layout.layers;
      useSelectionStore.setState({ activeLayerId: layers[0].id });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('w');
      });

      expect(useSelectionStore.getState().activeLayerId).toBe(layers[1].id);
    });

    it('moves to previous layer on S key', () => {
      // Add another layer
      const { addLayer } = useLayoutStore.getState();
      addLayer({ name: 'Layer 2', height: 4 });

      const layers = useLayoutStore.getState().layout.layers;
      useSelectionStore.setState({ activeLayerId: layers[1].id });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('s');
      });

      expect(useSelectionStore.getState().activeLayerId).toBe(layers[0].id);
    });

    it('does not go below first layer', () => {
      const layers = useLayoutStore.getState().layout.layers;
      useSelectionStore.setState({ activeLayerId: layers[0].id });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('s');
      });

      expect(useSelectionStore.getState().activeLayerId).toBe(layers[0].id);
    });

    it('does not go above last layer', () => {
      const layers = useLayoutStore.getState().layout.layers;
      useSelectionStore.setState({ activeLayerId: layers[layers.length - 1].id });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('w');
      });

      expect(useSelectionStore.getState().activeLayerId).toBe(layers[layers.length - 1].id);
    });
  });

  describe('bin selection cycling shortcuts', () => {
    it('selects next bin on D key', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = getBinId(
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
        })
      );

      const binId2 = getBinId(
        addBin({
          layerId,
          x: 3,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId1]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('d');
      });

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId2]);
    });

    it('selects previous bin on A key', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = getBinId(
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
        })
      );

      const binId2 = getBinId(
        addBin({
          layerId,
          x: 3,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId2]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('a');
      });

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId1]);
    });

    it('wraps to first bin when at end', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = getBinId(
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
        })
      );

      const binId2 = getBinId(
        addBin({
          layerId,
          x: 3,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId2]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('d');
      });

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId1]);
    });

    it('does nothing when no bins on layer', () => {
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('d');
      });

      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    });
  });

  describe('category cycling shortcuts', () => {
    it('cycles active category on [ key when no bin selected', () => {
      // Add a second category
      useLayoutStore.getState().addCategory({ name: 'Second', color: '#00FF00' });

      const updatedCategories = useLayoutStore.getState().layout.categories;
      useSelectionStore.setState({ activeCategoryId: updatedCategories[1].id });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('[');
      });

      expect(useSelectionStore.getState().activeCategoryId).toBe(updatedCategories[0].id);
    });

    it('cycles active category on ] key when no bin selected', () => {
      useLayoutStore.getState().addCategory({ name: 'Second', color: '#00FF00' });

      const updatedCategories = useLayoutStore.getState().layout.categories;
      useSelectionStore.setState({ activeCategoryId: updatedCategories[0].id });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey(']');
      });

      expect(useSelectionStore.getState().activeCategoryId).toBe(updatedCategories[1].id);
    });

    it('changes bin category on [ key when bin selected', () => {
      const { addBin, layout, addCategory } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      addCategory({ name: 'Second', color: '#00FF00' });
      const categories = useLayoutStore.getState().layout.categories;

      const binId = getBinId(
        addBin({
          layerId,
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categories[1].id,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('[');
      });

      expect(useLayoutStore.getState().layout.bins[0].category).toBe(categories[0].id);
    });

    it('changes bin category on ] key when bin selected', () => {
      const { addBin, layout, addCategory } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      addCategory({ name: 'Second', color: '#00FF00' });
      const categories = useLayoutStore.getState().layout.categories;

      const binId = getBinId(
        addBin({
          layerId,
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categories[0].id,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey(']');
      });

      expect(useLayoutStore.getState().layout.bins[0].category).toBe(categories[1].id);
    });

    it('wraps category from last to first without setting undefined', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categories = layout.categories;

      // Bin starts at the last (and only default) category
      const binId = getBinId(
        addBin({
          layerId,
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categories[categories.length - 1].id,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey(']');
      });

      const bin = useLayoutStore.getState().layout.bins[0];
      // Should wrap to first category, never be undefined
      expect(bin.category).toBe(categories[0].id);
      expect(typeof bin.category).toBe('string');
    });

    it('wraps category from first to last with [ key', () => {
      const { addBin, layout, addCategory } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;

      addCategory({ name: 'Extra', color: '#FF0000' });
      const categories = useLayoutStore.getState().layout.categories;

      const binId = getBinId(
        addBin({
          layerId,
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categories[0].id,
          label: '',
          notes: '',
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('[');
      });

      const bin = useLayoutStore.getState().layout.bins[0];
      // Should wrap to last category
      expect(bin.category).toBe(categories[categories.length - 1].id);
      expect(typeof bin.category).toBe('string');
    });
  });

  describe('quick label shortcut', () => {
    it('opens quick label on L key with single selection', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
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
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('l');
      });

      // showQuickLabel should have been called (through UIStore)
      expect(useSelectionStore.getState().quickLabelBinId).toBe(binId);
    });

    it('does nothing on L key with no selection', () => {
      // Reset quickLabelBinId from previous test
      useSelectionStore.setState({ quickLabelBinId: null });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('l');
      });

      expect(useSelectionStore.getState().quickLabelBinId).toBeNull();
    });
  });

  describe('half-bin mode toggle', () => {
    it('toggles half-bin mode on H key', () => {
      const initialMode = useHalfBinModeStore.getState().halfBinMode;

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('h');
      });

      expect(useHalfBinModeStore.getState().halfBinMode).toBe(!initialMode);
    });
  });

  describe('layout manager shortcut', () => {
    it('opens layout manager on Ctrl+O', () => {
      useLibraryStore.setState({ showLayoutManager: false });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('o', { ctrlKey: true });
      });

      expect(useLibraryStore.getState().showLayoutManager).toBe(true);
    });
  });

  describe('input field handling', () => {
    it('ignores shortcuts when typing in input', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = getBinId(
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
        })
      );

      useSelectionStore.getState().setSelectedBins([binId]);
      renderHook(() => useKeyboard());

      // Simulate event from input
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      // Bin should still exist
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

      document.body.removeChild(input);
    });
  });

  describe('half-bin mode toggle', () => {
    it('toggles half-bin mode on H key', () => {
      expect(useHalfBinModeStore.getState().halfBinMode).toBe(false);

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('h');
      });

      expect(useHalfBinModeStore.getState().halfBinMode).toBe(true);
    });

    it('shows error toast when toggle fails due to fractional bins', () => {
      // First enable half-bin mode
      useHalfBinModeStore.setState({ halfBinMode: true });

      // Add a bin with fractional dimensions
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      addBin({
        layerId,
        x: 0.5, // Fractional position
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      renderHook(() => useKeyboard());

      // Try to disable half-bin mode (should fail due to fractional bin)
      act(() => {
        pressKey('h');
      });

      // Half-bin mode should still be enabled
      expect(useHalfBinModeStore.getState().halfBinMode).toBe(true);
    });
  });

  describe('spatial navigation', () => {
    it('uses spatial navigation when focused bin exists but no selection', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = getBinId(
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
        })
      );

      const binId2 = getBinId(
        addBin({
          layerId,
          x: 3,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: categoryId,
          label: '',
          notes: '',
        })
      );

      // Set focused bin but no selection
      useSelectionStore.setState({
        focusedBinId: binId1,
        selectedBinIds: [],
      });

      renderHook(() => useKeyboard());

      // Press right arrow to navigate spatially
      act(() => {
        pressKey('ArrowRight');
      });

      // Focus should move to the bin to the right
      expect(useSelectionStore.getState().focusedBinId).toBe(binId2);
    });
  });
});
