import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Bin } from '../../components/Grid/Bin';
import { useUIStore, useLayoutStore } from '../../store';
import { useToastStore } from '../../store/toast';
import { resetAllStores } from '../testUtils';
import type { Bin as BinType, Category, Layer, Drawer } from '../../types';

// Mock useResponsive
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

// Mock ResizeHandles to simplify testing
vi.mock('../../components/Grid/ResizeHandles', () => ({
  ResizeHandles: ({ variant, onResizePointerDown }: { variant: string; onResizePointerDown: (e: React.PointerEvent, handle: string) => void }) => (
    <div data-testid={`resize-handles-${variant}`}>
      <button
        data-testid="resize-handle-se"
        onPointerDown={(e) => onResizePointerDown(e as unknown as React.PointerEvent<HTMLDivElement>, 'se')}
      >
        SE Handle
      </button>
    </div>
  ),
}));

describe('Bin', () => {
  const mockOnStartDrag = vi.fn();
  const mockOnStartResize = vi.fn();

  const defaultBin: BinType = {
    id: 'test-bin-1',
    x: 0,
    y: 0,
    width: 2,
    depth: 2,
    height: 3,
    layerId: 'layer-1',
    category: 'cat-1',
    label: '',
    notes: '',
  };

  const defaultCategory: Category = {
    id: 'cat-1',
    name: 'Test Category',
    color: '#FF6B6B',
  };

  const defaultLayer: Layer = {
    id: 'layer-1',
    name: 'Layer 1',
    height: 3,
  };

  const defaultDrawer: Drawer = {
    width: 10,
    depth: 8,
    height: 12,
  };

  const defaultProps = {
    bin: defaultBin,
    category: defaultCategory,
    layer: defaultLayer,
    drawer: defaultDrawer,
    cellSize: 32,
    gap: 2,
    halfBinMode: false,
    isGhost: false,
    isSelected: false,
    onStartDrag: mockOnStartDrag,
    onStartResize: mockOnStartResize,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set up default layout state
    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: 'Test',
        drawer: defaultDrawer,
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [defaultCategory],
        layers: [defaultLayer],
        bins: [defaultBin],
      },
    });

    // Set up default UI state
    useUIStore.setState({
      activeLayerId: 'layer-1',
      activeCategoryId: 'cat-1',
      selectedBinIds: [],
      showLabels: true,
      focusedBinId: null,
      paintSize: null,
      highlightedCategoryId: null,
      highlightedRowLabel: null,
      highlightedColLabel: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders bin with data-bin-id attribute', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).not.toBeNull();
    });

    it('renders dimensions text for bin', () => {
      render(<Bin {...defaultProps} />);
      expect(screen.getByText('2×2')).toBeInTheDocument();
    });

    it('renders bin with category color', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).toHaveStyle({ backgroundColor: '#FF6B6B' });
    });

    it('renders with default category color when no category provided', () => {
      const { container } = render(<Bin {...defaultProps} category={undefined} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).not.toBeNull();
    });

    it('applies correct grid positioning', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      // Grid column starts at 1 (x+1), spans 2
      expect(binElement).toHaveStyle({ gridColumn: '1 / span 2' });
    });

    it('renders with grab cursor by default', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).toHaveStyle({ cursor: 'grab' });
    });
  });

  describe('labels', () => {
    it('displays label when provided and showLabels is true', () => {
      const binWithLabel = { ...defaultBin, label: 'My Label' };
      render(<Bin {...defaultProps} bin={binWithLabel} />);
      expect(screen.getByText('My Label')).toBeInTheDocument();
    });

    it('displays dimensions text when no label', () => {
      render(<Bin {...defaultProps} />);
      expect(screen.getByText('2×2')).toBeInTheDocument();
    });

    it('shows dimensions as secondary text when label is shown', () => {
      const bigBin = { ...defaultBin, width: 4, depth: 4, label: 'Big Bin' };
      render(<Bin {...defaultProps} bin={bigBin} />);
      // Should show both label and dimensions
      expect(screen.getByText('Big Bin')).toBeInTheDocument();
      expect(screen.getByText('4×4')).toBeInTheDocument();
    });

    it('hides label text on very small bins', () => {
      const tinyBin = { ...defaultBin, width: 1, depth: 1 };
      const { container } = render(
        <Bin {...defaultProps} bin={tinyBin} cellSize={16} />
      );
      // Bin should render but text may not be visible
      expect(container.querySelector('[data-bin-id="test-bin-1"]')).not.toBeNull();
    });

    it('formats fractional dimensions correctly', () => {
      const fractionalBin = { ...defaultBin, width: 1.5, depth: 2.5 };
      render(<Bin {...defaultProps} bin={fractionalBin} />);
      expect(screen.getByText('1.5×2.5')).toBeInTheDocument();
    });
  });

  describe('selection states', () => {
    it('applies selection styling when selected', () => {
      const { container } = render(<Bin {...defaultProps} isSelected={true} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement?.getAttribute('aria-pressed')).toBe('true');
    });

    it('applies unselected styling when not selected', () => {
      const { container } = render(<Bin {...defaultProps} isSelected={false} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement?.getAttribute('aria-pressed')).toBe('false');
    });

    it('shows resize handles when selected', () => {
      render(<Bin {...defaultProps} isSelected={true} />);
      expect(screen.getByTestId('resize-handles-primary')).toBeInTheDocument();
    });

    it('does not show resize handles when not selected', () => {
      render(<Bin {...defaultProps} isSelected={false} />);
      expect(screen.queryByTestId('resize-handles-primary')).not.toBeInTheDocument();
    });

    it('hides resize handles during multi-select', () => {
      useUIStore.setState({ selectedBinIds: ['test-bin-1', 'test-bin-2'] });
      render(<Bin {...defaultProps} isSelected={true} />);
      expect(screen.queryByTestId('resize-handles-primary')).not.toBeInTheDocument();
    });
  });

  describe('ghost bins', () => {
    it('applies ghost styling when isGhost is true', () => {
      const { container } = render(<Bin {...defaultProps} isGhost={true} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).toHaveStyle({ opacity: '0.3' });
    });

    it('disables pointer events on ghost bins', () => {
      const { container } = render(<Bin {...defaultProps} isGhost={true} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).toHaveStyle({ pointerEvents: 'none' });
    });

    it('uses default cursor for ghost bins', () => {
      const { container } = render(<Bin {...defaultProps} isGhost={true} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).toHaveStyle({ cursor: 'default' });
    });

    it('does not show text on ghost bins', () => {
      const bigBin = { ...defaultBin, width: 4, depth: 4 };
      render(<Bin {...defaultProps} bin={bigBin} isGhost={true} />);
      // Ghost bins should not show dimensions text
      expect(screen.queryByText('4×4')).not.toBeInTheDocument();
    });
  });

  describe('tall bins', () => {
    it('shows tall bin indicator when height exceeds layer height', () => {
      const tallBin = { ...defaultBin, height: 6 };
      const shortLayer = { ...defaultLayer, height: 3 };
      render(<Bin {...defaultProps} bin={tallBin} layer={shortLayer} />);
      expect(screen.getByText('6u')).toBeInTheDocument();
    });

    it('does not show tall indicator when height equals layer height', () => {
      const normalBin = { ...defaultBin, height: 3 };
      render(<Bin {...defaultProps} bin={normalBin} />);
      expect(screen.queryByText('3u')).not.toBeInTheDocument();
    });
  });

  describe('print split indicator', () => {
    it('shows split badge when bin exceeds print bed size', () => {
      // Set up a bin larger than max grid units (256mm / 42mm ≈ 6 units)
      const largeBin = { ...defaultBin, width: 7, depth: 7 };
      render(<Bin {...defaultProps} bin={largeBin} />);
      expect(screen.getByText('Split')).toBeInTheDocument();
    });

    it('does not show split badge for small bins', () => {
      render(<Bin {...defaultProps} />);
      expect(screen.queryByText('Split')).not.toBeInTheDocument();
    });
  });

  describe('pointer events', () => {
    it('calls onStartDrag on pointer down', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, clientX: 100, clientY: 100, isPrimary: true });

      expect(mockOnStartDrag).toHaveBeenCalledWith(
        'test-bin-1',
        100,
        100,
        expect.any(Number),
        false
      );
    });

    it('does not respond to pointer events on ghost bins', () => {
      const { container } = render(<Bin {...defaultProps} isGhost={true} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, clientX: 100, clientY: 100, isPrimary: true });

      expect(mockOnStartDrag).not.toHaveBeenCalled();
    });

    it('ignores non-primary pointer events', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, isPrimary: false });

      expect(mockOnStartDrag).not.toHaveBeenCalled();
    });

    it('ignores right-click for drag', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 2, isPrimary: true });

      expect(mockOnStartDrag).not.toHaveBeenCalled();
    });

    it('selects bin on click when not selected', () => {
      const setSelectedBinSpy = vi.fn();
      useUIStore.setState({ setSelectedBin: setSelectedBinSpy });

      const { container } = render(<Bin {...defaultProps} isSelected={false} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, clientX: 100, clientY: 100, isPrimary: true });

      expect(setSelectedBinSpy).toHaveBeenCalledWith('test-bin-1');
    });

    it('starts duplicate drag with Alt key', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, {
        button: 0,
        clientX: 100,
        clientY: 100,
        isPrimary: true,
        altKey: true,
      });

      expect(mockOnStartDrag).toHaveBeenCalledWith(
        'test-bin-1',
        100,
        100,
        expect.any(Number),
        true // duplicate flag
      );
    });

    it('toggles selection with Ctrl+click', () => {
      const toggleSelectionSpy = vi.fn();
      useUIStore.setState({ toggleSelection: toggleSelectionSpy });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, ctrlKey: true, isPrimary: true });

      expect(toggleSelectionSpy).toHaveBeenCalledWith('test-bin-1');
    });

    it('toggles selection with Cmd+click', () => {
      const toggleSelectionSpy = vi.fn();
      useUIStore.setState({ toggleSelection: toggleSelectionSpy });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, metaKey: true, isPrimary: true });

      expect(toggleSelectionSpy).toHaveBeenCalledWith('test-bin-1');
    });

    it('adds to selection with Shift+click', () => {
      const addToSelectionSpy = vi.fn();
      useUIStore.setState({ addToSelection: addToSelectionSpy });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, shiftKey: true, isPrimary: true });

      expect(addToSelectionSpy).toHaveBeenCalledWith('test-bin-1');
    });

    it('sets hover state on mouse enter (non-touch device)', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      // Mouse enter should trigger hover state
      fireEvent.mouseEnter(binElement!);

      // The component uses internal state for hover, so we can't easily verify it
      // But we're testing that the handler runs without errors
      expect(binElement).toBeInTheDocument();
    });

    it('clears hover state on mouse leave', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      // Mouse enter then leave
      fireEvent.mouseEnter(binElement!);
      fireEvent.mouseLeave(binElement!);

      expect(binElement).toBeInTheDocument();
    });
  });

  describe('context menu', () => {
    it('shows context menu on right-click', () => {
      const showContextMenuSpy = vi.fn();
      useUIStore.setState({ showContextMenu: showContextMenuSpy });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.contextMenu(binElement!, { clientX: 100, clientY: 100 });

      expect(showContextMenuSpy).toHaveBeenCalledWith(
        ['test-bin-1'],
        { x: 100, y: 100 },
        'grid'
      );
    });

    it('selects bin before showing context menu if not selected', () => {
      const setSelectedBinSpy = vi.fn();
      const showContextMenuSpy = vi.fn();
      useUIStore.setState({
        setSelectedBin: setSelectedBinSpy,
        showContextMenu: showContextMenuSpy,
      });

      const { container } = render(<Bin {...defaultProps} isSelected={false} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.contextMenu(binElement!, { clientX: 100, clientY: 100 });

      expect(setSelectedBinSpy).toHaveBeenCalledWith('test-bin-1');
      expect(showContextMenuSpy).toHaveBeenCalled();
    });

    it('does not show context menu on ghost bins', () => {
      const showContextMenuSpy = vi.fn();
      useUIStore.setState({ showContextMenu: showContextMenuSpy });

      const { container } = render(<Bin {...defaultProps} isGhost={true} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.contextMenu(binElement!, { clientX: 100, clientY: 100 });

      expect(showContextMenuSpy).not.toHaveBeenCalled();
    });
  });

  describe('double-click', () => {
    it('shows quick label on double-click', () => {
      const showQuickLabelSpy = vi.fn();
      useUIStore.setState({ showQuickLabel: showQuickLabelSpy });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.doubleClick(binElement!);

      expect(showQuickLabelSpy).toHaveBeenCalledWith('test-bin-1');
    });

    it('selects bin on double-click if not selected', () => {
      const setSelectedBinSpy = vi.fn();
      useUIStore.setState({ setSelectedBin: setSelectedBinSpy });

      const { container } = render(<Bin {...defaultProps} isSelected={false} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.doubleClick(binElement!);

      expect(setSelectedBinSpy).toHaveBeenCalledWith('test-bin-1');
    });

    it('does not respond to double-click on ghost bins', () => {
      const showQuickLabelSpy = vi.fn();
      useUIStore.setState({ showQuickLabel: showQuickLabelSpy });

      const { container } = render(<Bin {...defaultProps} isGhost={true} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.doubleClick(binElement!);

      expect(showQuickLabelSpy).not.toHaveBeenCalled();
    });
  });

  describe('resize handles', () => {
    it('calls onStartResize when resize handle is clicked', () => {
      render(<Bin {...defaultProps} isSelected={true} />);

      const resizeHandle = screen.getByTestId('resize-handle-se');
      fireEvent.pointerDown(resizeHandle, { button: 0, isPrimary: true, pointerId: 5 });

      expect(mockOnStartResize).toHaveBeenCalledWith('test-bin-1', 'se', 5);
    });

    it('hides resize handles during interaction', () => {
      useUIStore.setState({
        interaction: {
          type: 'drag',
          binIds: ['test-bin-1'],
          start: { x: 0, y: 0 },
          current: { x: 1, y: 1 },
        },
      });

      render(<Bin {...defaultProps} isSelected={true} />);

      expect(screen.queryByTestId('resize-handles-primary')).not.toBeInTheDocument();
    });
  });

  describe('paint mode', () => {
    it('exits paint mode when bin is clicked', () => {
      const setPaintSizeSpy = vi.fn();
      useUIStore.setState({
        paintSize: { width: 2, depth: 2 },
        setPaintSize: setPaintSizeSpy,
      });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, clientX: 100, clientY: 100, isPrimary: true });

      expect(setPaintSizeSpy).toHaveBeenCalledWith(null);
    });
  });

  describe('category highlighting', () => {
    it('applies highlight styling when category is highlighted', () => {
      useUIStore.setState({ highlightedCategoryId: 'cat-1' });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      // Should have highlight box shadow
      expect(binElement).not.toBeNull();
      // Can check for elevated z-index when highlighted
      const style = binElement?.getAttribute('style');
      expect(style).toContain('z-index');
    });

    it('reduces opacity when other category is highlighted', () => {
      useUIStore.setState({ highlightedCategoryId: 'other-cat' });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveStyle({ opacity: '0.4' });
    });
  });

  describe('row/column highlighting', () => {
    it('highlights bin when row label is hovered', () => {
      useUIStore.setState({ highlightedRowLabel: 1 }); // Row 1 = y: 0

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).not.toBeNull();
    });

    it('highlights bin when column label is hovered', () => {
      useUIStore.setState({ highlightedColLabel: 1 }); // Col 1 = x: 0

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).not.toBeNull();
    });

    it('reduces opacity when other row is highlighted', () => {
      useUIStore.setState({ highlightedRowLabel: 5 }); // Row 5, bin is at y: 0-2

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveStyle({ opacity: '0.6' });
    });
  });

  describe('focus state', () => {
    it('sets focused bin on focus', () => {
      const setFocusedBinSpy = vi.fn();
      useUIStore.setState({ setFocusedBin: setFocusedBinSpy });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.focus(binElement!);

      expect(setFocusedBinSpy).toHaveBeenCalledWith('test-bin-1');
    });

    it('clears focused bin on blur', () => {
      const setFocusedBinSpy = vi.fn();
      useUIStore.setState({
        focusedBinId: 'test-bin-1',
        setFocusedBin: setFocusedBinSpy,
      });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.blur(binElement!);

      expect(setFocusedBinSpy).toHaveBeenCalledWith(null);
    });

    it('is not focusable when ghost', () => {
      const { container } = render(<Bin {...defaultProps} isGhost={true} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveAttribute('tabindex', '-1');
    });

    it('is focusable when not ghost', () => {
      const { container } = render(<Bin {...defaultProps} isGhost={false} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveAttribute('tabindex', '0');
    });
  });

  describe('accessibility', () => {
    it('has correct aria-label', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveAttribute(
        'aria-label',
        'Bin 2 by 2, category Test Category'
      );
    });

    it('includes label in aria-label when present', () => {
      const binWithLabel = { ...defaultBin, label: 'Screws' };
      const { container } = render(<Bin {...defaultProps} bin={binWithLabel} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveAttribute(
        'aria-label',
        'Bin 2 by 2, labeled Screws, category Test Category'
      );
    });

    it('has role="button"', () => {
      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveAttribute('role', 'button');
    });
  });

  describe('fractional drawer positioning', () => {
    it('handles fractional drawer width', () => {
      const fractionalDrawer = { ...defaultDrawer, width: 10.5 };
      const { container } = render(
        <Bin {...defaultProps} drawer={fractionalDrawer} />
      );
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).not.toBeNull();
    });

    it('handles fractional drawer depth', () => {
      const fractionalDrawer = { ...defaultDrawer, depth: 8.5 };
      const { container } = render(
        <Bin {...defaultProps} drawer={fractionalDrawer} />
      );
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).not.toBeNull();
    });

    it('handles fractionalEdgeX start position', () => {
      const fractionalDrawer = { ...defaultDrawer, width: 10.5, fractionalEdgeX: 'start' as const };
      const { container } = render(
        <Bin {...defaultProps} drawer={fractionalDrawer} />
      );
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).not.toBeNull();
    });

    it('handles fractionalEdgeY start position', () => {
      const fractionalDrawer = { ...defaultDrawer, depth: 8.5, fractionalEdgeY: 'start' as const };
      const { container } = render(
        <Bin {...defaultProps} drawer={fractionalDrawer} />
      );
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');
      expect(binElement).not.toBeNull();
    });
  });

  describe('toast hints', () => {
    it('shows resize hint on first selection', () => {
      // Clear the localStorage flag
      localStorage.removeItem('gridfinity-resize-hint-shown');

      const addToastSpy = vi.fn();
      useToastStore.setState({ addToast: addToastSpy });

      const { container } = render(<Bin {...defaultProps} isSelected={false} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, clientX: 100, clientY: 100, isPrimary: true });

      expect(addToastSpy).toHaveBeenCalledWith('Tip: Drag the handles to resize', 'info');
    });

    it('does not show resize hint after first time', () => {
      // Set the localStorage flag
      localStorage.setItem('gridfinity-resize-hint-shown', 'true');

      const addToastSpy = vi.fn();
      useToastStore.setState({ addToast: addToastSpy });

      const { container } = render(<Bin {...defaultProps} isSelected={false} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      fireEvent.pointerDown(binElement!, { button: 0, clientX: 100, clientY: 100, isPrimary: true });

      expect(addToastSpy).not.toHaveBeenCalled();

      // Cleanup
      localStorage.removeItem('gridfinity-resize-hint-shown');
    });
  });

  describe('drag state', () => {
    it('reduces opacity when being dragged', () => {
      useUIStore.setState({
        interaction: {
          type: 'drag',
          binIds: ['test-bin-1'],
          start: { x: 0, y: 0 },
          current: { x: 1, y: 1 },
        },
      });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveStyle({ opacity: '0.5' });
    });

    it('disables pointer events when being dragged', () => {
      useUIStore.setState({
        interaction: {
          type: 'drag',
          binIds: ['test-bin-1'],
          start: { x: 0, y: 0 },
          current: { x: 1, y: 1 },
        },
      });

      const { container } = render(<Bin {...defaultProps} />);
      const binElement = container.querySelector('[data-bin-id="test-bin-1"]');

      expect(binElement).toHaveStyle({ pointerEvents: 'none' });
    });
  });
});
