import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { GridCanvas } from '../../components/Grid/GridCanvas';
import { useLayoutStore } from '../../store/layout';
import { useUIStore } from '../../store/ui';
import { createDefaultLayout } from '../../constants';
import type { Bin } from '../../types';

// Mock useResponsive to avoid matchMedia issues
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    layoutMode: 'desktop' as const,
    viewportWidth: 1200,
  }),
}));

// Mock useGridCoords to return predictable coordinates
vi.mock('../../hooks/useGridCoords', () => ({
  useGridCoords: () => ({
    getGridCoords: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  }),
}));

describe('GridCanvas', () => {
  const mockStartDraw = vi.fn();
  const mockStartDrag = vi.fn();
  const mockStartResize = vi.fn();

  let defaultLayout: ReturnType<typeof createDefaultLayout>;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultLayout = createDefaultLayout();

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
      const layers = defaultLayout.layers.length > 1
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
      useUIStore.setState({
        activeLayerId: defaultLayout.layers[0].id,
        showOtherLayers: false, // Don't show ghost bins
      });

      const { container } = renderGridCanvas();

      // Bin should not be rendered (it's on a different layer and ghosts are off)
      const binElement = container.querySelector('[data-bin-id="other-layer-bin"]');
      expect(binElement).toBeNull();
    });

    it('renders ghost bins from lower layers when showOtherLayers is true', () => {
      // Create a second layer
      const layers = [
        defaultLayout.layers[0],
        { id: 'layer-2', name: 'Layer 2', height: 6 },
      ];

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
      useUIStore.setState({
        activeLayerId: 'layer-2',
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

      useUIStore.setState({
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
      useUIStore.setState({
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
      useUIStore.setState({
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
});
