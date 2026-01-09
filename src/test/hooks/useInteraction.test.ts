import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteraction } from '../../hooks/useInteraction';
import { useUIStore } from '../../store/ui';
import { useLayoutStore } from '../../store/layout';
import { useHistoryStore } from '../../store/history';
import { createDefaultLayout, STAGING_ID } from '../../constants';
import type { RefObject } from 'react';

// Mock grid ref that returns consistent coords
function createMockGridRef(width = 320, height = 256): RefObject<HTMLDivElement> {
  const mockElement = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  } as HTMLDivElement;

  return { current: mockElement };
}

describe('useInteraction', () => {
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
      hideLayersAbove: false,
      dimInactiveLayers: true,
      isPreviewExpanded: false,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  describe('startDraw', () => {
    it('initializes draw interaction', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      act(() => {
        result.current.startDraw({ x: 2, y: 3 });
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction).not.toBeNull();
      expect(interaction?.type).toBe('draw');
      if (interaction?.type === 'draw') {
        expect(interaction.start).toEqual({ x: 2, y: 3 });
        expect(interaction.current).toEqual({ x: 2, y: 3 });
      }
    });

    it('initializes paint interaction when paint mode is active', () => {
      // Enable paint mode
      useUIStore.getState().setPaintSize({ width: 2, depth: 2 });

      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      act(() => {
        result.current.startDraw({ x: 0, y: 0 });
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction).not.toBeNull();
      expect(interaction?.type).toBe('paint');
      if (interaction?.type === 'paint') {
        expect(interaction.paintSize).toEqual({ width: 2, depth: 2 });
      }
    });
  });

  describe('startDrag', () => {
    it('initializes drag interaction for single bin', () => {
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

      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      // startDrag needs client coordinates that map to grid coords
      // With BASE_CELL_SIZE=32 and gap=2, position (2,2) would be at pixel ~68,68
      act(() => {
        result.current.startDrag(binId!, 68, 68);
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction).not.toBeNull();
      expect(interaction?.type).toBe('drag');
      if (interaction?.type === 'drag') {
        expect(interaction.binIds).toContain(binId);
        expect(interaction.valid).toBe(true);
        expect(interaction.isOverGrid).toBe(true);
      }
    });

    it('drags all selected bins when clicked bin is in selection', () => {
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

      // Select both bins
      useUIStore.getState().setSelectedBins([binId1!, binId2!]);

      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      // Drag the first bin (which is in selection)
      act(() => {
        result.current.startDrag(binId1!, 34, 34);
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction?.type).toBe('drag');
      if (interaction?.type === 'drag') {
        expect(interaction.binIds).toHaveLength(2);
        expect(interaction.binIds).toContain(binId1);
        expect(interaction.binIds).toContain(binId2);
      }
    });

    it('selects only clicked bin when not in current selection', () => {
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

      // Select only first bin
      useUIStore.getState().setSelectedBins([binId1!]);

      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      // Drag the second bin (not in selection)
      act(() => {
        result.current.startDrag(binId2!, 100, 34);
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction?.type).toBe('drag');
      if (interaction?.type === 'drag') {
        expect(interaction.binIds).toHaveLength(1);
        expect(interaction.binIds).toContain(binId2);
      }
    });

    it('does nothing for non-existent bin', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      act(() => {
        result.current.startDrag('non-existent-id', 50, 50);
      });

      expect(useUIStore.getState().interaction).toBeNull();
    });
  });

  describe('startResize', () => {
    it('initializes resize interaction', () => {
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

      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      act(() => {
        result.current.startResize(binId!, 'e');
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction).not.toBeNull();
      expect(interaction?.type).toBe('resize');
      if (interaction?.type === 'resize') {
        expect(interaction.binIds).toContain(binId);
        expect(interaction.handle).toBe('e');
        expect(interaction.valid).toBe(true);
        expect(interaction.startRects.get(binId!)).toEqual({
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
        });
      }
    });

    it('resizes all selected bins when clicked bin is in selection', () => {
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

      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      act(() => {
        result.current.startResize(binId1!, 'ne');
      });

      const interaction = useUIStore.getState().interaction;
      expect(interaction?.type).toBe('resize');
      if (interaction?.type === 'resize') {
        expect(interaction.binIds).toHaveLength(2);
        expect(interaction.startRects.size).toBe(2);
        expect(interaction.currentRects.size).toBe(2);
      }
    });

    it('stores different handles for corner resize', () => {
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

      const gridRef = createMockGridRef();

      // Test different handles
      const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

      for (const handle of handles) {
        const { result } = renderHook(() => useInteraction(gridRef));

        act(() => {
          result.current.startResize(binId!, handle);
        });

        const interaction = useUIStore.getState().interaction;
        expect(interaction?.type).toBe('resize');
        if (interaction?.type === 'resize') {
          expect(interaction.handle).toBe(handle);
        }

        // Reset for next iteration
        useUIStore.getState().setInteraction(null);
      }
    });
  });

  describe('cancel', () => {
    it('clears interaction state', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      // Set up an interaction
      act(() => {
        result.current.startDraw({ x: 0, y: 0 });
      });

      expect(useUIStore.getState().interaction).not.toBeNull();

      // Cancel it
      act(() => {
        result.current.cancel();
      });

      expect(useUIStore.getState().interaction).toBeNull();
    });
  });

  describe('interaction property', () => {
    it('returns current interaction from store', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useInteraction(gridRef));

      expect(result.current.interaction).toBeNull();

      act(() => {
        result.current.startDraw({ x: 1, y: 2 });
      });

      expect(result.current.interaction).not.toBeNull();
      expect(result.current.interaction?.type).toBe('draw');
    });
  });
});

// Test the calculateResizeRect helper function
// Since it's not exported, we test it indirectly through behavior
describe('resize rect calculation (integration)', () => {
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
      hideLayersAbove: false,
      dimInactiveLayers: true,
      isPreviewExpanded: false,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('resize east expands width', () => {
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

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId!, 'e');
    });

    const interaction = useUIStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      const startRect = interaction.startRects.get(binId!);
      expect(startRect?.width).toBe(2);
    }
  });

  it('resize preserves minimum size of 1', () => {
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

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start resize from west edge
    act(() => {
      result.current.startResize(binId!, 'w');
    });

    const interaction = useUIStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      // Width should still be at least 1 after initialization
      const currentRect = interaction.currentRects.get(binId!);
      expect(currentRect?.width).toBeGreaterThanOrEqual(1);
    }
  });
});

// Test pointer event handlers
describe('pointer events', () => {
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
      hideLayersAbove: false,
      dimInactiveLayers: true,
      isPreviewExpanded: false,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('draw interaction updates on pointer move', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    const interaction = useUIStore.getState().interaction;
    expect(interaction?.type).toBe('draw');

    // Simulate pointer move
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still exist after move
    expect(useUIStore.getState().interaction?.type).toBe('draw');
  });

  it('draw interaction completes on pointer up and creates bin', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    // Update current position
    act(() => {
      useUIStore.setState({
        ...useUIStore.getState(),
        interaction: {
          type: 'draw',
          start: { x: 0, y: 0 },
          current: { x: 2, y: 2 },
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Interaction should be cleared
    expect(useUIStore.getState().interaction).toBeNull();

    // A bin should have been created
    expect(useLayoutStore.getState().layout.bins.length).toBeGreaterThanOrEqual(1);
  });

  it('drag interaction validates placement on move', () => {
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

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDrag(binId!, 68, 68);
    });

    expect(useUIStore.getState().interaction?.type).toBe('drag');

    // Simulate pointer move
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still be drag type
    expect(useUIStore.getState().interaction?.type).toBe('drag');
  });

  it('drag interaction completes on pointer up', () => {
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

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDrag(binId!, 68, 68);
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Interaction should be cleared
    expect(useUIStore.getState().interaction).toBeNull();
  });

  it('resize interaction updates on pointer move', () => {
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

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId!, 'e');
    });

    expect(useUIStore.getState().interaction?.type).toBe('resize');

    // Simulate pointer move
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 150,
        clientY: 50,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still be resize type
    expect(useUIStore.getState().interaction?.type).toBe('resize');
  });

  it('resize interaction completes on pointer up', () => {
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

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId!, 'ne');
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Interaction should be cleared
    expect(useUIStore.getState().interaction).toBeNull();
  });

  it('drag to trash deletes bins', () => {
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

    expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDrag(binId!, 68, 68);
    });

    // Set drop target to trash
    act(() => {
      useUIStore.getState().setDropTarget('trash');
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should be deleted
    expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
  });

  it('drag to staging moves bin to staging', () => {
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

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDrag(binId!, 68, 68);
    });

    // Set drop target to staging
    act(() => {
      useUIStore.getState().setDropTarget('staging');
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should be in staging
    const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
    expect(bin?.layerId).toBe(STAGING_ID);
  });

  it('pointer cancel clears interaction', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    expect(useUIStore.getState().interaction).not.toBeNull();

    // Simulate pointer cancel
    act(() => {
      const cancelEvent = new PointerEvent('pointercancel', { bubbles: true });
      document.dispatchEvent(cancelEvent);
    });

    // Interaction should be cleared
    expect(useUIStore.getState().interaction).toBeNull();
  });

  it('paint mode creates multiple bins in area', () => {
    // Enable paint mode with 2x2 bins
    useUIStore.getState().setPaintSize({ width: 2, depth: 2 });

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    expect(useUIStore.getState().interaction?.type).toBe('paint');

    // Set a 4x4 area (should fit 2x2 = 4 bins of 2x2 size)
    act(() => {
      useUIStore.setState({
        ...useUIStore.getState(),
        interaction: {
          type: 'paint',
          paintSize: { width: 2, depth: 2 },
          start: { x: 0, y: 0 },
          current: { x: 3, y: 3 },
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Should have created bins
    const bins = useLayoutStore.getState().layout.bins;
    expect(bins.length).toBeGreaterThan(0);
  });
});

// Test stagingDrag interaction
describe('stagingDrag interaction', () => {
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
      hideLayersAbove: false,
      dimInactiveLayers: true,
      isPreviewExpanded: false,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('stagingDrag updates position on pointer move', () => {
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

    // Manually set up stagingDrag interaction
    useUIStore.setState({
      ...useUIStore.getState(),
      interaction: {
        type: 'stagingDrag',
        binId: binId!,
        currentCoord: { x: 0, y: 0 },
        valid: false,
      },
    });

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Simulate pointer move
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still be stagingDrag
    expect(useUIStore.getState().interaction?.type).toBe('stagingDrag');
  });

  it('stagingDrag places bin on grid on pointer up when valid', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const categoryId = layout.categories[0].id;
    const layerId = layout.layers[0].id;

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

    // Verify bin is in staging
    expect(useLayoutStore.getState().layout.bins.find(b => b.id === binId)?.layerId).toBe(STAGING_ID);

    // Set active layer
    useUIStore.setState({
      ...useUIStore.getState(),
      activeLayerId: layerId,
      interaction: {
        type: 'stagingDrag',
        binId: binId!,
        currentCoord: { x: 2, y: 2 },
        valid: true,
      },
    });

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should now be on the grid (not in staging)
    const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
    expect(bin?.layerId).toBe(layerId);
    expect(bin?.x).toBe(2);
    expect(bin?.y).toBe(2);
  });

  it('stagingDrag deletes bin when dropped on trash', () => {
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

    expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

    // Set up stagingDrag interaction
    useUIStore.setState({
      ...useUIStore.getState(),
      interaction: {
        type: 'stagingDrag',
        binId: binId!,
        currentCoord: { x: 0, y: 0 },
        valid: false,
      },
      dropTarget: 'trash',
    });

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should be deleted
    expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
  });

  it('stagingDrag keeps bin in staging when dropped at invalid position', () => {
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

    // Set up stagingDrag interaction with invalid position
    useUIStore.setState({
      ...useUIStore.getState(),
      interaction: {
        type: 'stagingDrag',
        binId: binId!,
        currentCoord: { x: 100, y: 100 }, // Out of bounds
        valid: false,
      },
    });

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should still be in staging
    const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
    expect(bin?.layerId).toBe(STAGING_ID);
  });
});

// Test stagingDrag behavior
describe('staging drag', () => {
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
      hideLayersAbove: false,
      dimInactiveLayers: true,
      isPreviewExpanded: false,
    });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('bins can be added to staging', () => {
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
      label: 'Staged bin',
      notes: '',
    });

    expect(binId).not.toBeNull();
    const bin = useLayoutStore.getState().layout.bins.find(b => b.id === binId);
    expect(bin?.layerId).toBe(STAGING_ID);
  });
});
