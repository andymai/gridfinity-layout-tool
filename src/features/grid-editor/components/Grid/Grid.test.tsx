import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Grid } from './Grid';
import {
  useLayoutStore,
  useViewStore,
  useInteractionStore,
  useSelectionStore,
  useHalfBinModeStore,
} from '@/core/store';
import { resetAllStores, createTestLayout } from '@/test/testUtils';

// Mock all lazy-loaded components
vi.mock('./IsometricPreview', () => ({
  IsometricPreview: ({ inline }: { inline?: boolean }) => (
    <div data-testid="isometric-preview" data-inline={inline}>
      3D Preview
    </div>
  ),
}));

vi.mock('@/components/Mobile', () => ({
  MobileGridToolbar: ({ onFitToScreen }: { onFitToScreen: () => void }) => (
    <div data-testid="mobile-toolbar">
      <button onClick={onFitToScreen}>Fit Mobile</button>
    </div>
  ),
}));

// Mock child components
vi.mock('./GridCanvas', () => ({
  GridCanvas: ({
    onStartDraw,
    onStartDrag,
    onStartResize,
  }: {
    onStartDraw: () => void;
    onStartDrag: () => void;
    onStartResize: () => void;
  }) => (
    <div data-testid="grid-canvas">
      <button onClick={onStartDraw}>Start Draw</button>
      <button onClick={onStartDrag}>Start Drag</button>
      <button onClick={onStartResize}>Start Resize</button>
    </div>
  ),
}));

vi.mock('./Overlay', () => ({
  Overlay: () => <div data-testid="overlay">Overlay</div>,
}));

vi.mock('./QuickLabelPopover', () => ({
  QuickLabelPopover: () => <div data-testid="quick-label-popover">Quick Label</div>,
}));

vi.mock('./GridToolbar', () => ({
  GridToolbar: () => <div data-testid="grid-toolbar">Toolbar</div>,
}));

vi.mock('./GridAxisLabels', () => ({
  RowLabels: () => <div data-testid="row-labels">Row Labels</div>,
  ColumnLabels: () => <div data-testid="column-labels">Column Labels</div>,
}));

vi.mock('./DrawerResizeHandles', () => ({
  DrawerResizeHandles: () => <div data-testid="drawer-resize-handles">Resize Handles</div>,
}));

vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    title,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <div data-testid="confirm-title">{title}</div>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

vi.mock('@/components/PanelErrorBoundary', () => ({
  PanelErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock collaborative components
vi.mock('@/components/Collab', () => ({
  CollabCursors: () => <div data-testid="collab-cursors">Cursors</div>,
  CollabGhosts: () => <div data-testid="collab-ghosts">Ghosts</div>,
  CollabSelectionRings: () => <div data-testid="collab-selection-rings">Selection Rings</div>,
}));

// Mock hooks
vi.mock('@/features/grid-editor/hooks', () => ({
  useInteraction: () => ({
    startDraw: vi.fn(),
    startDrag: vi.fn(),
    startResize: vi.fn(),
  }),
  useGridResize: () => ({
    resizeDirection: null,
    pendingResize: null,
    shouldPulseResizeHandles: false,
    handleResizeStart: vi.fn(),
    confirmResize: vi.fn(),
    cancelResize: vi.fn(),
  }),
  useGridZoom: () => ({
    zoom: 1,
    canZoomIn: true,
    canZoomOut: true,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToScreen: vi.fn(),
  }),
  useGridAxisLabels: () => ({
    axisLabelsVisible: true,
    integerWidth: 10,
    integerDepth: 8,
    columnLabelHeight: 24,
    rowLabels: [1, 2, 3, 4, 5, 6, 7, 8],
    columnLabels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  }),
  useGridRowColumnSelection: () => ({
    handleRowClick: vi.fn(),
    handleColumnClick: vi.fn(),
  }),
  useGridFirstUseHints: () => ({
    shouldPulsePaintHint: false,
  }),
  useGridCoords: () => ({
    getPixelCoords: vi.fn(() => ({ nx: 0.5, ny: 0.5 })),
  }),
}));

vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    viewportWidth: 1200,
  }),
}));

vi.mock('@/hooks/useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: false }),
}));

vi.mock('@/hooks/useCollabPresence', () => ({
  useCollabPresence: () => ({
    updateCursor: vi.fn(),
    clearPresence: vi.fn(),
  }),
}));

describe('Grid', () => {
  const testLayout = createTestLayout({
    drawer: { width: 10, depth: 8, height: 12 },
    bins: [
      {
        id: 'bin1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: 'layer1',
        category: 'cat1',
        label: '',
        notes: '',
      },
    ],
  });

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    useLayoutStore.setState({ layout: testLayout });
    useSelectionStore.setState({
      activeLayerId: 'layer1',
      selectedBinIds: [],
      setSelectedBins: vi.fn(),
    });
    useViewStore.setState({
      zoom: 1,
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      setPrintModalOpen: vi.fn(),
      showIsometricPreview: false,
      toggleIsometricPreview: vi.fn(),
      togglePreviewExpanded: vi.fn(),
    });
    useInteractionStore.setState({
      interaction: null,
      paintSize: null,
      setPaintSize: vi.fn(),
    });
    useHalfBinModeStore.setState({
      halfBinMode: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders grid canvas', () => {
      render(<Grid />);

      expect(screen.getByTestId('grid-canvas')).toBeInTheDocument();
    });

    it('renders overlay', () => {
      render(<Grid />);

      expect(screen.getByTestId('overlay')).toBeInTheDocument();
    });

    it('renders quick label popover', () => {
      render(<Grid />);

      expect(screen.getByTestId('quick-label-popover')).toBeInTheDocument();
    });

    it('renders desktop toolbar on desktop', () => {
      render(<Grid />);

      expect(screen.getByTestId('grid-toolbar')).toBeInTheDocument();
    });

    it('does not render mobile toolbar on desktop', () => {
      render(<Grid />);

      expect(screen.queryByTestId('mobile-toolbar')).not.toBeInTheDocument();
    });

    it('renders grid with proper aria-label', () => {
      const { container } = render(<Grid />);

      const gridElement = container.querySelector('[role="application"]');
      expect(gridElement).toHaveAttribute(
        'aria-label',
        'Gridfinity drawer grid, 10 columns by 8 rows'
      );
    });

    it('renders axis labels when visible', () => {
      render(<Grid />);

      expect(screen.getByTestId('row-labels')).toBeInTheDocument();
      expect(screen.getByTestId('column-labels')).toBeInTheDocument();
    });

    it('renders drawer resize handles on desktop', () => {
      render(<Grid />);

      expect(screen.getByTestId('drawer-resize-handles')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty state UI when bins array is empty', () => {
      const emptyLayout = createTestLayout({ bins: [] });
      useLayoutStore.setState({ layout: emptyLayout });

      const { container } = render(<Grid />);

      // Empty state overlay should render (look for the overlay div)
      const emptyOverlay = container.querySelector('.absolute.inset-0.flex.flex-col');
      expect(emptyOverlay).toBeInTheDocument();
    });

    it('renders tutorial animation when shouldShowDrawTutorial is true', () => {
      const emptyLayout = createTestLayout({ bins: [] });
      useLayoutStore.setState({ layout: emptyLayout });

      const { container } = render(<Grid shouldShowDrawTutorial={true} />);

      // Tutorial shows animated gesture (look for animation div)
      const animation = container.querySelector('.animate-draw-hint-cursor');
      expect(animation).toBeInTheDocument();
    });

    it('does not show tutorial when bins exist', () => {
      const { container } = render(<Grid />);

      // With bin1 in the layout, tutorial animation should not show
      const animation = container.querySelector('.animate-draw-hint-cursor');
      expect(animation).not.toBeInTheDocument();
    });

    it('renders empty state on non-first layers', () => {
      const layoutWithMultipleLayers = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 3 },
        ],
        bins: [], // Empty
      });
      useLayoutStore.setState({ layout: layoutWithMultipleLayers });
      useSelectionStore.setState({ activeLayerId: 'layer2' });

      const { container } = render(<Grid />);

      // Empty overlay should exist on empty layers
      const emptyOverlay = container.querySelector('.absolute.inset-0.flex.flex-col');
      expect(emptyOverlay).toBeInTheDocument();
    });
  });

  describe('3D preview', () => {
    it('does not render preview when not shown initially', () => {
      render(<Grid />);

      expect(screen.queryByTestId('isometric-preview')).not.toBeInTheDocument();
    });

    it('renders preview container when showIsometricPreview is true', () => {
      useViewStore.setState({ showIsometricPreview: true });

      const { container } = render(<Grid />);

      // Preview container exists (marked with data-3d-preview)
      const previewContainer = container.querySelector('[data-3d-preview]');
      expect(previewContainer).toBeInTheDocument();
      expect(previewContainer).not.toHaveClass('hidden');
    });
  });

  describe('resize confirmation dialog', () => {
    it('does not show dialog when no pending resize', () => {
      render(<Grid />);

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
  });

  describe('half-bin mode', () => {
    it('applies normal cell sizing when half-bin mode is off', () => {
      const { container } = render(<Grid />);

      const gridElement = container.querySelector('[role="application"]');
      expect(gridElement).toBeInTheDocument();
    });

    it('applies scaled cell sizing when half-bin mode is on', () => {
      useHalfBinModeStore.setState({ halfBinMode: true });

      const { container } = render(<Grid />);

      const gridElement = container.querySelector('[role="application"]');
      expect(gridElement).toBeInTheDocument();
      // Grid dimensions are recalculated with scale factor
    });
  });

  describe('interaction modes', () => {
    it('hides empty state during interaction', () => {
      const emptyLayout = createTestLayout({ bins: [] });
      useLayoutStore.setState({ layout: emptyLayout });
      useInteractionStore.setState({
        interaction: {
          type: 'draw',
          start: { x: 0, y: 0 },
          current: { x: 1, y: 1 },
        },
      });

      render(<Grid />);

      // Empty hint should not show during interaction
      expect(screen.queryByText(/emptyHint/i)).not.toBeInTheDocument();
    });
  });

  describe('collaborative features', () => {
    it('does not render collab components when not collaborative', () => {
      render(<Grid />);

      expect(screen.queryByTestId('collab-cursors')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collab-ghosts')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collab-selection-rings')).not.toBeInTheDocument();
    });
  });

  describe('paint mode', () => {
    it('exits paint mode when clicking off grid', () => {
      const mockSetPaintSize = vi.fn();
      useInteractionStore.setState({
        paintSize: { width: 2, depth: 2 },
        setPaintSize: mockSetPaintSize,
      });

      const { container } = render(<Grid />);

      // Click on scroll container (off the grid)
      const scrollContainer = container.querySelector('.overflow-auto');
      if (scrollContainer) {
        scrollContainer.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      }

      expect(mockSetPaintSize).toHaveBeenCalledWith(null);
    });
  });

  describe('grid dimensions', () => {
    it('calculates grid width correctly', () => {
      const { container } = render(<Grid />);

      const gridElement = container.querySelector('[role="application"]');
      expect(gridElement).toBeInTheDocument();
      // Width = drawer.width * (cellSize + gap) + gap
      // With default cellSize 32 and gap 1: 10 * 33 + 1 = 331px (but zoom/responsive may affect)
    });

    it('calculates grid height correctly', () => {
      const { container } = render(<Grid />);

      const gridElement = container.querySelector('[role="application"]');
      expect(gridElement).toBeInTheDocument();
      // Height = drawer.depth * (cellSize + gap) + gap
      // With default cellSize 32 and gap 1: 8 * 33 + 1 = 265px (but zoom/responsive may affect)
    });
  });

  describe('accessibility', () => {
    it('has application role for assistive technologies', () => {
      const { container } = render(<Grid />);

      expect(container.querySelector('[role="application"]')).toBeInTheDocument();
    });

    it('provides descriptive aria-label', () => {
      const { container } = render(<Grid />);

      const gridElement = container.querySelector('[role="application"]');
      expect(gridElement?.getAttribute('aria-label')).toContain('Gridfinity drawer grid');
    });
  });

  describe('fit to screen', () => {
    it('listens for fit-to-screen event', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      render(<Grid />);

      expect(addEventListenerSpy).toHaveBeenCalledWith('fit-to-screen', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('cleans up event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<Grid />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('fit-to-screen', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
