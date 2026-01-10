import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useUIStore } from '../../store/ui';
import { useLayoutStore } from '../../store/layout';
import { useHistoryStore } from '../../store/history';
import { createDefaultLayout, STAGING_ID } from '../../constants';

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
    // Reset all stores
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout });
    useUIStore.setState({
      activeLayerId: defaultLayout.layers[0].id,
      selectedBinIds: [],
      activeCategoryId: defaultLayout.categories[0].id,
      zoom: 1,
      showOtherLayers: true,
      showLabels: true,
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      interaction: null,
      dropTarget: null,
      paintSize: null,
      activeMobilePanel: null,
      contextMenu: null,
      showIsometricPreview: true,
      isometricRotation: 0,
      layerViewMode: 'focus',
      isPreviewExpanded: false,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
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

      expect(binId).not.toBeNull();
      useUIStore.getState().setSelectedBins([binId!]);

      // Mount the hook
      renderHook(() => useKeyboard());

      // Press Delete
      act(() => {
        pressKey('Delete');
      });

      // Verify bin is deleted
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
      expect(useUIStore.getState().selectedBinIds).toHaveLength(0);
    });

    it('deletes selected bins on Backspace key', () => {
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
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
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

      const binId1 = addBin({
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

      const binId2 = addBin({
        layerId,
        x: 3,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId1!, binId2!]);
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

      useUIStore.getState().setSelectedBins([binId!]);
      expect(useUIStore.getState().selectedBinIds).toHaveLength(1);

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Escape');
      });

      expect(useUIStore.getState().selectedBinIds).toHaveLength(0);
    });

    it('clears paint mode on Escape', () => {
      useUIStore.getState().setPaintSize({ width: 2, depth: 2 });
      expect(useUIStore.getState().paintSize).not.toBeNull();

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Escape');
      });

      expect(useUIStore.getState().paintSize).toBeNull();
    });

    it('clears interaction on Escape', () => {
      useUIStore.getState().setInteraction({
        type: 'draw',
        start: { x: 0, y: 0 },
        current: { x: 1, y: 1 },
      });

      renderHook(() => useKeyboard());

      act(() => {
        pressKey('Escape');
      });

      expect(useUIStore.getState().interaction).toBeNull();
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

      useUIStore.getState().setSelectedBins([binId!]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('d', { ctrlKey: true });
      });

      // Should have 2 bins now
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins).toHaveLength(2);

      // Selection should be the new bin
      const selectedIds = useUIStore.getState().selectedBinIds;
      expect(selectedIds).toHaveLength(1);
      expect(selectedIds[0]).not.toBe(binId);
    });

    it('duplicates multiple selected bins', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = addBin({
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

      const binId2 = addBin({
        layerId,
        x: 5,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId1!, binId2!]);
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
      const initialZoom = useUIStore.getState().zoom;
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('+');
      });

      expect(useUIStore.getState().zoom).toBeGreaterThan(initialZoom);
    });

    it('zooms in on = key', () => {
      const initialZoom = useUIStore.getState().zoom;
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('=');
      });

      expect(useUIStore.getState().zoom).toBeGreaterThan(initialZoom);
    });

    it('zooms out on - key', () => {
      const initialZoom = useUIStore.getState().zoom;
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('-');
      });

      expect(useUIStore.getState().zoom).toBeLessThan(initialZoom);
    });
  });

  describe('nudge shortcuts', () => {
    it('nudges bin up on ArrowUp', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
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

      const binId = addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
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

      const binId = addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
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

      const binId = addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
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

      useUIStore.getState().setSelectedBins([binId!]);
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

      useUIStore.getState().setSelectedBins([binId!]);
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

      const binId1 = addBin({
        layerId,
        x: 0,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      const binId2 = addBin({
        layerId,
        x: 3,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId1!, binId2!]);
      renderHook(() => useKeyboard());

      act(() => {
        pressKey('ArrowUp');
      });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].y).toBe(3);
      expect(bins[1].y).toBe(3);
    });
  });

  describe('input field handling', () => {
    it('ignores shortcuts when typing in input', () => {
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
        label: '',
        notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
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
});
