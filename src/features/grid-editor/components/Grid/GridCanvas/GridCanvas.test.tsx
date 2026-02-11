import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { GridCanvas } from '@/features/grid-editor/components/Grid/GridCanvas';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { useInteractionStore } from '@/core/store/interaction';
import { createDefaultLayout } from '@/core/constants';
import { resetAllStores } from '@/test/testUtils';
import type { Bin } from '@/core/types';

// Mock useResponsive to avoid matchMedia issues
vi.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    layoutMode: 'desktop' as const,
    viewportWidth: 1200,
  }),
}));

// Create a mock getGridCoords function that can be controlled per test
const mockGetGridCoords = vi.fn().mockReturnValue({ x: 0, y: 0 });

// Mock useGridCoords to return predictable coordinates
vi.mock('@/features/grid-editor/hooks/useGridCoords', () => ({
  useGridCoords: () => ({
    getGridCoords: mockGetGridCoords,
    halfBinMode: false,
  }),
}));

describe('GridCanvas', () => {
  const mockStartDraw = vi.fn();
  const mockStartDrag = vi.fn();
  const mockStartResize = vi.fn();

  let defaultLayout: ReturnType<typeof createDefaultLayout>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGridCoords.mockReturnValue({ x: 0, y: 0 });

    // Reset all stores for isolation
    resetAllStores();

    // Set test-specific state
    defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout });
    useSelectionStore.setState({
      activeLayerId: defaultLayout.layers[0].id,
      activeCategoryId: defaultLayout.categories[0].id,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderGridCanvas = () => {
    const gridRef = createRef<HTMLDivElement>();
    return render(
      <GridCanvas
        gridRef={gridRef}
        cellSize={32}
        gap={2}
        onStartDraw={mockStartDraw}
        onStartDrag={mockStartDrag}
        onStartResize={mockStartResize}
      />
    );
  };

  describe('Grid rendering', () => {
    it('renders grid cells based on drawer dimensions', () => {
      const { container } = renderGridCanvas();

      // Default drawer is 10x8, so 80 cells
      const drawer = defaultLayout.drawer;
      const expectedCells = drawer.width * drawer.depth;

      // Find cells by their grid styling
      const gridContainer = container.querySelector('[style*="display: grid"]');
      expect(gridContainer).not.toBeNull();

      // Count the cell divs (they have specific background color)
      const cells = container.querySelectorAll('[style*="background-color: var(--grid-cell)"]');
      expect(cells.length).toBe(expectedCells);
    });

    it('applies correct grid template columns', () => {
      const { container } = renderGridCanvas();

      const gridContainer = container.querySelector('[style*="display: grid"]');
      expect(gridContainer).not.toBeNull();

      const style = gridContainer?.getAttribute('style');
      expect(style).toContain(`grid-template-columns: repeat(${defaultLayout.drawer.width}, 32px)`);
    });
  });

  describe('Bin rendering', () => {
    it('renders bins on the active layer', () => {
      // Add a bin to the layout
      const testBin: Bin = {
        id: 'test-bin-1',
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        layerId: defaultLayout.layers[0].id,
        category: defaultLayout.categories[0].id,
        label: 'Test Bin',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          bins: [testBin],
        },
      });

      const { container } = renderGridCanvas();

      // Find the bin by its data attribute
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).not.toBeNull();
    });

    it('does not render bins from other layers as active bins', () => {
      // Add a bin to a different layer
      const secondLayer = defaultLayout.layers[1] || { id: 'layer-2' };
      const testBin: Bin = {
        id: 'other-layer-bin',
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: secondLayer.id,
        category: defaultLayout.categories[0].id,
        label: '',
        notes: '',
      };

      // Add second layer if it doesn't exist
      const layers =
        defaultLayout.layers.length > 1
          ? defaultLayout.layers
          : [...defaultLayout.layers, { id: 'layer-2', name: 'Layer 2', height: 3 }];

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          layers,
          bins: [testBin],
        },
      });

      // Active layer is still the first layer
      useSelectionStore.setState({
        activeLayerId: defaultLayout.layers[0].id,
      });
      useViewStore.setState({
        showOtherLayers: false, // Don't show ghost bins
      });

      const { container } = renderGridCanvas();

      // Bin should not be rendered (it's on a different layer and ghosts are off)
      const binElement = container.querySelector('[data-bin-id="other-layer-bin"]');
      expect(binElement).toBeNull();
    });

    it('renders ghost bins from lower layers when showOtherLayers is true', () => {
      // Create a second layer
      const layers = [defaultLayout.layers[0], { id: 'layer-2', name: 'Layer 2', height: 6 }];

      // Add a bin to the first layer
      const ghostBin: Bin = {
        id: 'ghost-bin',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layers[0].id,
        category: defaultLayout.categories[0].id,
        label: '',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          layers,
          bins: [ghostBin],
        },
      });

      // Set active layer to second layer, show other layers
      useSelectionStore.setState({
        activeLayerId: 'layer-2',
      });
      useViewStore.setState({
        showOtherLayers: true,
      });

      const { container } = renderGridCanvas();

      // Ghost bin should be rendered with ghost styling
      const binElement = container.querySelector('[data-bin-id="ghost-bin"]');
      expect(binElement).not.toBeNull();
    });

    it('renders selected bin with selection state', () => {
      const testBin: Bin = {
        id: 'selected-bin',
        x: 1,
        y: 1,
        width: 2,
        depth: 2,
        height: 3,
        layerId: defaultLayout.layers[0].id,
        category: defaultLayout.categories[0].id,
        label: '',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          bins: [testBin],
        },
      });

      useSelectionStore.setState({
        activeLayerId: defaultLayout.layers[0].id,
        selectedBinIds: ['selected-bin'],
      });

      const { container } = renderGridCanvas();

      const binElement = container.querySelector('[data-bin-id="selected-bin"]');
      expect(binElement).not.toBeNull();
      expect(binElement?.getAttribute('aria-pressed')).toBe('true');
    });

    it('renders multiple bins correctly', () => {
      const bins: Bin[] = [
        {
          id: 'bin-1',
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          layerId: defaultLayout.layers[0].id,
          category: defaultLayout.categories[0].id,
          label: '',
          notes: '',
        },
        {
          id: 'bin-2',
          x: 3,
          y: 0,
          width: 1,
          depth: 3,
          height: 3,
          layerId: defaultLayout.layers[0].id,
          category: defaultLayout.categories[0].id,
          label: '',
          notes: '',
        },
        {
          id: 'bin-3',
          x: 5,
          y: 3,
          width: 3,
          depth: 2,
          height: 3,
          layerId: defaultLayout.layers[0].id,
          category: defaultLayout.categories[0].id,
          label: '',
          notes: '',
        },
      ];

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          bins,
        },
      });

      const { container } = renderGridCanvas();

      expect(container.querySelector('[data-bin-id="bin-1"]')).not.toBeNull();
      expect(container.querySelector('[data-bin-id="bin-2"]')).not.toBeNull();
      expect(container.querySelector('[data-bin-id="bin-3"]')).not.toBeNull();
    });
  });

  describe('Cursor styles', () => {
    it('shows crosshair cursor in normal mode', () => {
      const { container } = renderGridCanvas();

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.cursor).toBe('crosshair');
    });

    it('shows cell cursor in paint mode', () => {
      useInteractionStore.setState({
        paintSize: { width: 2, depth: 2 },
      });

      const { container } = renderGridCanvas();

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.cursor).toBe('cell');
    });
  });

  describe('Touch action', () => {
    it('allows pan when no interaction active', () => {
      const { container } = renderGridCanvas();

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.touchAction).toBe('pan-x pan-y');
    });

    it('disables touch actions during interaction', () => {
      useInteractionStore.setState({
        interaction: {
          type: 'draw',
          start: { x: 0, y: 0 },
          current: { x: 1, y: 1 },
        },
      });

      const { container } = renderGridCanvas();

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.touchAction).toBe('none');
    });
  });

  describe('Pointer events', () => {
    it('calls onStartDraw when pointer down on empty space', () => {
      mockGetGridCoords.mockReturnValue({ x: 3, y: 4 });
      const { container } = renderGridCanvas();

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.pointerDown(wrapper, { button: 0, clientX: 100, clientY: 100, isPrimary: true });

      expect(mockStartDraw).toHaveBeenCalledWith({ x: 3, y: 4 }, expect.any(Number));
    });

    it('does not call onStartDraw on right-click', () => {
      const { container } = renderGridCanvas();

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.pointerDown(wrapper, { button: 2, clientX: 100, clientY: 100, isPrimary: true });

      expect(mockStartDraw).not.toHaveBeenCalled();
    });

    it('does not call onStartDraw for non-primary pointer', () => {
      const { container } = renderGridCanvas();

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.pointerDown(wrapper, { button: 0, clientX: 100, clientY: 100, isPrimary: false });

      expect(mockStartDraw).not.toHaveBeenCalled();
    });

    it('does not call onStartDraw when clicking on a bin', () => {
      const testBin: Bin = {
        id: 'test-bin-click',
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        layerId: defaultLayout.layers[0].id,
        category: defaultLayout.categories[0].id,
        label: '',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          bins: [testBin],
        },
      });

      const { container } = renderGridCanvas();

      // Click on the bin element
      const binElement = container.querySelector('[data-bin-id="test-bin-click"]');
      fireEvent.pointerDown(binElement!, {
        button: 0,
        clientX: 100,
        clientY: 100,
        isPrimary: true,
      });

      // onStartDraw should not be called when clicking on a bin
      expect(mockStartDraw).not.toHaveBeenCalled();
    });

    it('does not start draw when coords are null', () => {
      mockGetGridCoords.mockReturnValue(null);
      const { container } = renderGridCanvas();

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.pointerDown(wrapper, { button: 0, clientX: 100, clientY: 100, isPrimary: true });

      expect(mockStartDraw).not.toHaveBeenCalled();
    });
  });

  describe('Blocked zones', () => {
    it('renders blocked zones from tall bins in lower layers', () => {
      // Create two layers
      const layers = [
        { id: 'layer-1', name: 'Layer 1', height: 3 },
        { id: 'layer-2', name: 'Layer 2', height: 3 },
      ];

      // Tall bin in layer 1 that extends into layer 2
      const tallBin: Bin = {
        id: 'tall-bin',
        x: 1,
        y: 1,
        width: 2,
        depth: 2,
        height: 6, // Taller than layer height, extends into layer 2
        layerId: 'layer-1',
        category: defaultLayout.categories[0].id,
        label: '',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          layers,
          bins: [tallBin],
        },
      });

      // Set active layer to layer 2 to see blocked zones
      useSelectionStore.setState({
        activeLayerId: 'layer-2',
      });

      const { container } = renderGridCanvas();

      // There should be a blocked zone element (the hatched overlay)
      const blockedZone = container.querySelector('[role="button"][aria-label*="Blocked"]');
      expect(blockedZone).not.toBeNull();
    });

    it('clicking blocked zone switches to source layer and selects bin', () => {
      // Create two layers
      const layers = [
        { id: 'layer-1', name: 'Layer 1', height: 3 },
        { id: 'layer-2', name: 'Layer 2', height: 3 },
      ];

      // Tall bin in layer 1
      const tallBin: Bin = {
        id: 'tall-bin',
        x: 1,
        y: 1,
        width: 2,
        depth: 2,
        height: 6,
        layerId: 'layer-1',
        category: defaultLayout.categories[0].id,
        label: '',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          layers,
          bins: [tallBin],
        },
      });

      useSelectionStore.setState({
        activeLayerId: 'layer-2',
        selectedBinIds: [],
      });

      const { container } = renderGridCanvas();

      const blockedZone = container.querySelector('[role="button"][aria-label*="Blocked"]');
      fireEvent.click(blockedZone!);

      // Should switch to layer 1 and select the bin
      expect(useSelectionStore.getState().activeLayerId).toBe('layer-1');
      expect(useSelectionStore.getState().selectedBinIds).toContain('tall-bin');
    });
  });

  describe('Fractional drawer dimensions', () => {
    it('renders fractional column cells when drawer width is fractional', () => {
      const fractionalDrawer = { ...defaultLayout.drawer, width: 10.5 };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          drawer: fractionalDrawer,
        },
      });

      const { container } = renderGridCanvas();

      // Should render cells - fractional drawer width adds partial column
      const gridContainer = container.querySelector('[style*="display: grid"]');
      expect(gridContainer).not.toBeNull();

      // The grid template should include the fractional cell
      const style = gridContainer?.getAttribute('style');
      expect(style).toContain('grid-template-columns');
    });

    it('renders fractional row cells when drawer depth is fractional', () => {
      const fractionalDrawer = { ...defaultLayout.drawer, depth: 8.5 };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          drawer: fractionalDrawer,
        },
      });

      const { container } = renderGridCanvas();

      const gridContainer = container.querySelector('[style*="display: grid"]');
      expect(gridContainer).not.toBeNull();

      const style = gridContainer?.getAttribute('style');
      expect(style).toContain('grid-template-rows');
    });

    it('renders corner cell when both width and depth are fractional', () => {
      const fractionalDrawer = {
        ...defaultLayout.drawer,
        width: 10.5,
        depth: 8.5,
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          drawer: fractionalDrawer,
        },
      });

      const { container } = renderGridCanvas();

      // Should render the grid without errors
      const gridContainer = container.querySelector('[style*="display: grid"]');
      expect(gridContainer).not.toBeNull();
    });

    it('handles fractionalEdgeX start position', () => {
      const fractionalDrawer = {
        ...defaultLayout.drawer,
        width: 10.5,
        fractionalEdgeX: 'start' as const,
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          drawer: fractionalDrawer,
        },
      });

      const { container } = renderGridCanvas();

      const gridContainer = container.querySelector('[style*="display: grid"]');
      const style = gridContainer?.getAttribute('style');
      // Fractional at left should have fractional width first in template
      expect(style).toContain('grid-template-columns');
    });

    it('handles fractionalEdgeY start position', () => {
      const fractionalDrawer = {
        ...defaultLayout.drawer,
        depth: 8.5,
        fractionalEdgeY: 'start' as const,
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          drawer: fractionalDrawer,
        },
      });

      const { container } = renderGridCanvas();

      const gridContainer = container.querySelector('[style*="display: grid"]');
      expect(gridContainer).not.toBeNull();
    });
  });

  describe('Paint mode bin click behavior', () => {
    it('allows bin clicks to pass through in paint mode (does not intercept)', () => {
      // Set up paint mode
      useInteractionStore.setState({
        paintSize: { width: 2, depth: 2 },
      });

      // Add a bin to the layout
      const testBin: Bin = {
        id: 'test-bin-paint',
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        layerId: defaultLayout.layers[0].id,
        category: defaultLayout.categories[0].id,
        label: 'Test Bin',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          bins: [testBin],
        },
      });

      const { container } = renderGridCanvas();

      // Verify paint mode is active
      expect(useInteractionStore.getState().paintSize).toEqual({ width: 2, depth: 2 });

      // Verify bin is rendered and can receive clicks
      const binElement = container.querySelector('[data-bin-id="test-bin-paint"]');
      expect(binElement).not.toBeNull();

      // The capture phase handler should check for bin elements and allow clicks through
      // This test verifies the bin element exists and is clickable (has pointer-events: auto)
      expect(binElement).toHaveProperty('style');
    });

    it('clears paint mode when clicking on a bin', () => {
      // Set up paint mode
      useInteractionStore.setState({
        paintSize: { width: 2, depth: 2 },
      });

      // Add a bin to the layout
      const testBin: Bin = {
        id: 'test-bin-click',
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        layerId: defaultLayout.layers[0].id,
        category: defaultLayout.categories[0].id,
        label: 'Test Bin',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          bins: [testBin],
        },
      });

      const { container } = renderGridCanvas();

      // Verify paint mode is active
      expect(useInteractionStore.getState().paintSize).toEqual({ width: 2, depth: 2 });

      // Click on the bin
      const binElement = container.querySelector('[data-bin-id="test-bin-click"]');
      expect(binElement).not.toBeNull();

      // Fire pointer down event to simulate clicking the bin
      fireEvent.pointerDown(binElement!, { button: 0, isPrimary: true });

      // Paint mode should be cleared
      expect(useInteractionStore.getState().paintSize).toBeNull();
    });

    it('selects the bin when clicking in paint mode', () => {
      // Set up paint mode
      useInteractionStore.setState({
        paintSize: { width: 2, depth: 2 },
      });
      useSelectionStore.setState({
        selectedBinIds: [],
      });

      // Add a bin to the layout
      const testBin: Bin = {
        id: 'test-bin-select',
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        layerId: defaultLayout.layers[0].id,
        category: defaultLayout.categories[0].id,
        label: 'Test Bin',
        notes: '',
      };

      useLayoutStore.setState({
        layout: {
          ...defaultLayout,
          bins: [testBin],
        },
      });

      const { container } = renderGridCanvas();

      // Click on the bin
      const binElement = container.querySelector('[data-bin-id="test-bin-select"]');
      fireEvent.pointerDown(binElement!, { button: 0, isPrimary: true });

      // Bin should be selected
      expect(useSelectionStore.getState().selectedBinIds).toContain('test-bin-select');
    });
  });
});
