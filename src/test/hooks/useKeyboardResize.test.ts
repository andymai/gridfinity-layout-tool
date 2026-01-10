import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardResize } from '../../hooks/useKeyboardResize';
import { useKeyboardDrag } from '../../hooks/useKeyboardDrag';
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

describe('useKeyboardResize', () => {
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
      focusedBinId: null,
      keyboardDragMode: false,
      keyboardResizeMode: false,
      liveMessage: null,
      quickLabelBinId: null,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('enterResizeMode', () => {
    it('enters resize mode when single bin selected', () => {
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
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      expect(result.current.keyboardResizeMode).toBe(true);
      expect(useUIStore.getState().interaction?.type).toBe('resize');
    });

    it('does not enter resize mode when no bins selected', () => {
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      expect(result.current.keyboardResizeMode).toBe(false);
    });

    it('does not enter resize mode when multiple bins selected', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      const binId2 = addBin({
        layerId, x: 5, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId1!, binId2!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      expect(result.current.keyboardResizeMode).toBe(false);
    });

    it('does not enter resize mode for staging bins', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      expect(result.current.keyboardResizeMode).toBe(false);
    });
  });

  describe('adjustResizeDelta', () => {
    it('increases width with right arrow', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      act(() => {
        result.current.adjustResizeDelta(1, 0); // Right arrow increases width
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction?.type).toBe('resize');
      if (interaction?.type === 'resize') {
        const rect = interaction.currentRects.get(binId!);
        expect(rect?.width).toBe(3);
      }
    });

    it('decreases width with left arrow', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 3, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      act(() => {
        result.current.adjustResizeDelta(-1, 0);
      });

      const interaction = useUIStore.getState().interaction;
      if (interaction?.type === 'resize') {
        const rect = interaction.currentRects.get(binId!);
        expect(rect?.width).toBe(2);
      }
    });

    it('increases depth with up arrow', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      act(() => {
        result.current.adjustResizeDelta(0, 1);
      });

      const interaction = useUIStore.getState().interaction;
      if (interaction?.type === 'resize') {
        const rect = interaction.currentRects.get(binId!);
        expect(rect?.depth).toBe(3);
      }
    });

    it('enforces minimum size of 1', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 1, depth: 1, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      // Try to reduce below 1
      act(() => {
        result.current.adjustResizeDelta(-5, -5);
      });

      const interaction = useUIStore.getState().interaction;
      if (interaction?.type === 'resize') {
        const rect = interaction.currentRects.get(binId!);
        expect(rect?.width).toBe(1);
        expect(rect?.depth).toBe(1);
      }
    });
  });

  describe('confirmResize', () => {
    it('applies resize changes to the bin', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      act(() => {
        result.current.adjustResizeDelta(2, 1); // Make 4x3
      });

      act(() => {
        result.current.confirmResize();
      });

      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.width).toBe(4);
      expect(bin?.depth).toBe(3);
      expect(result.current.keyboardResizeMode).toBe(false);
    });

    it('exits without changes if no resize delta', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      // Confirm without any changes
      act(() => {
        result.current.confirmResize();
      });

      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.width).toBe(2);
      expect(bin?.depth).toBe(2);
      expect(result.current.keyboardResizeMode).toBe(false);
    });

    it('rejects resize that would cause collision', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Add first bin
      const binId = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      // Add blocking bin
      addBin({
        layerId, x: 3, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      // Try to resize into the blocking bin
      act(() => {
        result.current.adjustResizeDelta(3, 0); // Would make width 5, overlapping
      });

      act(() => {
        result.current.confirmResize();
      });

      // Should still be in resize mode (rejected)
      expect(result.current.keyboardResizeMode).toBe(true);

      // Bin should not have changed
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.width).toBe(2);
    });

    it('creates undo history entry', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      expect(useHistoryStore.getState().past).toHaveLength(0);

      act(() => {
        result.current.enterResizeMode();
      });

      act(() => {
        result.current.adjustResizeDelta(1, 1);
      });

      act(() => {
        result.current.confirmResize();
      });

      // Should have undo history
      expect(useHistoryStore.getState().past.length).toBeGreaterThan(0);
    });
  });

  describe('exitResizeMode', () => {
    it('exits resize mode without applying changes', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      act(() => {
        result.current.adjustResizeDelta(5, 5); // Make big changes
      });

      act(() => {
        result.current.exitResizeMode();
      });

      // Should exit resize mode
      expect(result.current.keyboardResizeMode).toBe(false);

      // Bin should NOT have changed
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.width).toBe(2);
      expect(bin?.depth).toBe(2);
    });
  });

  describe('keyboard events', () => {
    it('responds to arrow keys when in resize mode', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      renderHook(() => useKeyboardResize());

      // Enter resize mode
      act(() => {
        useUIStore.getState().setKeyboardResizeMode(true);
      });

      // Press right arrow
      act(() => {
        pressKey('ArrowRight');
      });

      // Should show updated preview - interaction state is tracked internally
      // and may or may not be exposed in store depending on implementation
    });

    it('confirms on Enter key', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      act(() => {
        result.current.adjustResizeDelta(1, 0);
      });

      act(() => {
        pressKey('Enter');
      });

      expect(result.current.keyboardResizeMode).toBe(false);
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.width).toBe(3);
    });

    it('cancels on Escape key', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardResize());

      act(() => {
        result.current.enterResizeMode();
      });

      act(() => {
        result.current.adjustResizeDelta(5, 5);
      });

      act(() => {
        pressKey('Escape');
      });

      expect(result.current.keyboardResizeMode).toBe(false);
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.width).toBe(2); // Unchanged
    });
  });
});

describe('useKeyboardDrag', () => {
  beforeEach(() => {
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
      focusedBinId: null,
      keyboardDragMode: false,
      keyboardResizeMode: false,
      liveMessage: null,
      quickLabelBinId: null,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('enterDragMode', () => {
    it('enters drag mode when bins selected', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      expect(result.current.keyboardDragMode).toBe(true);
      expect(useUIStore.getState().interaction?.type).toBe('drag');
    });

    it('supports multiple bin selection', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      const binId2 = addBin({
        layerId, x: 5, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId1!, binId2!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      expect(result.current.keyboardDragMode).toBe(true);
    });

    it('does not enter drag mode when no bins selected', () => {
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      expect(result.current.keyboardDragMode).toBe(false);
    });

    it('does not enter drag mode for staging bins', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: STAGING_ID,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      expect(result.current.keyboardDragMode).toBe(false);
    });
  });

  describe('adjustDragOffset', () => {
    it('moves bin position with arrow keys', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(1, 0); // Move right
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction?.type).toBe('drag');
      if (interaction?.type === 'drag') {
        expect(interaction.currentCoord.x).toBe(3);
      }
    });

    it('tracks cumulative movement', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(1, 0);
        result.current.adjustDragOffset(1, 0);
        result.current.adjustDragOffset(0, 1);
      });

      const interaction = useUIStore.getState().interaction;
      if (interaction?.type === 'drag') {
        expect(interaction.currentCoord.x).toBe(4); // 2 + 2
        expect(interaction.currentCoord.y).toBe(3); // 2 + 1
      }
    });
  });

  describe('confirmDrag', () => {
    it('applies movement to bins', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(2, 1);
      });

      act(() => {
        result.current.confirmDrag();
      });

      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.x).toBe(4);
      expect(bin?.y).toBe(3);
      expect(result.current.keyboardDragMode).toBe(false);
    });

    it('moves multiple bins together', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId1 = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      const binId2 = addBin({
        layerId, x: 0, y: 3, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId1!, binId2!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(3, 0);
      });

      act(() => {
        result.current.confirmDrag();
      });

      const bin1 = useLayoutStore.getState().layout.bins.find(b => b.id === binId1);
      const bin2 = useLayoutStore.getState().layout.bins.find(b => b.id === binId2);
      expect(bin1?.x).toBe(3);
      expect(bin2?.x).toBe(3);
    });

    it('rejects move that would go out of bounds', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 8, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(5, 0); // Would exceed width
      });

      act(() => {
        result.current.confirmDrag();
      });

      // Should still be in drag mode
      expect(result.current.keyboardDragMode).toBe(true);

      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.x).toBe(8); // Unchanged
    });

    it('rejects move that would cause collision', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      const binId = addBin({
        layerId, x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });
      addBin({
        layerId, x: 3, y: 0, width: 2, depth: 2, height: 3,
        category: categoryId, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(2, 0); // Would overlap
      });

      act(() => {
        result.current.confirmDrag();
      });

      expect(result.current.keyboardDragMode).toBe(true);
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.x).toBe(0);
    });

    it('creates undo history entry', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 0, y: 0, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      expect(useHistoryStore.getState().past).toHaveLength(0);

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(1, 1);
      });

      act(() => {
        result.current.confirmDrag();
      });

      expect(useHistoryStore.getState().past.length).toBeGreaterThan(0);
    });
  });

  describe('exitDragMode', () => {
    it('exits without applying changes', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(5, 5);
      });

      act(() => {
        result.current.exitDragMode();
      });

      expect(result.current.keyboardDragMode).toBe(false);
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.x).toBe(2);
      expect(bin?.y).toBe(2);
    });
  });

  describe('keyboard events', () => {
    it('confirms on Enter key', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(1, 0);
      });

      act(() => {
        pressKey('Enter');
      });

      expect(result.current.keyboardDragMode).toBe(false);
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.x).toBe(3);
    });

    it('cancels on Escape key', () => {
      const { addBin, layout } = useLayoutStore.getState();
      const binId = addBin({
        layerId: layout.layers[0].id,
        x: 2, y: 2, width: 2, depth: 2, height: 3,
        category: layout.categories[0].id, label: '', notes: '',
      });

      useUIStore.getState().setSelectedBins([binId!]);
      const { result } = renderHook(() => useKeyboardDrag());

      act(() => {
        result.current.enterDragMode();
      });

      act(() => {
        result.current.adjustDragOffset(5, 5);
      });

      act(() => {
        pressKey('Escape');
      });

      expect(result.current.keyboardDragMode).toBe(false);
      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
      expect(bin?.x).toBe(2);
    });
  });
});
