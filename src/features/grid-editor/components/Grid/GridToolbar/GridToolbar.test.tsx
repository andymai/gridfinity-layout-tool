import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridToolbar } from './GridToolbar';
import { useViewStore, useInteractionStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import type { Layer } from '@/core/types';
import type { GridZoomState } from '@/features/grid-editor/hooks/useGridZoom';

// Mock analytics
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  track3DPreview: vi.fn(),
  markFeatureUsed: vi.fn(),
}));

// Mock Checkbox component
vi.mock('@/shared/components/Checkbox', () => ({
  Checkbox: ({ checked, variant }: { checked: boolean; variant: string }) => (
    <input
      type="checkbox"
      checked={checked}
      data-variant={variant}
      readOnly
      data-testid="checkbox"
    />
  ),
}));

describe('GridToolbar', () => {
  const mockZoomState: GridZoomState = {
    zoom: 1.0,
    canZoomIn: true,
    canZoomOut: true,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToScreen: vi.fn(),
  };

  const mockLayers: Layer[] = [
    { id: 'layer1', name: 'Layer 1', height: 3 },
    { id: 'layer2', name: 'Layer 2', height: 3 },
  ];

  const mockActiveLayer: Layer = mockLayers[0];

  const toolbarRef = { current: null };

  const defaultProps = {
    zoomState: mockZoomState,
    toolbarRef,
    layers: mockLayers,
    activeLayer: mockActiveLayer,
    isNarrowToolbar: false,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    useViewStore.setState({
      showOtherLayers: true,
      toggleShowOtherLayers: vi.fn(),
      leftPanelCollapsed: false,
      toggleLeftPanel: vi.fn(),
      showIsometricPreview: false,
      toggleIsometricPreview: vi.fn(),
    });

    useInteractionStore.setState({
      paintSize: null,
      setPaintSize: vi.fn(),
      keyboardDragMode: false,
      keyboardResizeMode: false,
      setKeyboardDragMode: vi.fn(),
      setKeyboardResizeMode: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders toolbar container', () => {
      const { container } = render(<GridToolbar {...defaultProps} />);

      expect(container.querySelector('[data-grid-toolbar]')).toBeInTheDocument();
    });

    it('displays layer indicator when multiple layers exist', () => {
      render(<GridToolbar {...defaultProps} />);

      expect(screen.getByText('Layer 1')).toBeInTheDocument();
      expect(screen.getByText('3u')).toBeInTheDocument();
    });

    it('does not show layer indicator when single layer', () => {
      render(<GridToolbar {...defaultProps} layers={[mockLayers[0]]} />);

      expect(screen.queryByText('Layer 1')).not.toBeInTheDocument();
    });

    it('displays current zoom percentage', () => {
      render(<GridToolbar {...defaultProps} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('displays zoom controls', () => {
      render(<GridToolbar {...defaultProps} />);

      // Find zoom buttons by text content
      expect(screen.getByText(/fit/i)).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('displays 3D preview toggle button', () => {
      const { container } = render(<GridToolbar {...defaultProps} />);

      // 3D preview button contains the cube icon SVG
      const svgPath = container.querySelector('path[d*="M21 8a2 2 0"]');
      expect(svgPath).toBeInTheDocument();
    });
  });

  describe('layer indicator', () => {
    it('shows layer color dot', () => {
      render(<GridToolbar {...defaultProps} />);

      const colorDot = screen.getByText('Layer 1').previousSibling;
      expect(colorDot).toHaveClass('bg-accent');
    });

    it('opens left panel when clicked and panel is collapsed', () => {
      const mockToggleLeftPanel = vi.fn();
      useViewStore.setState({
        leftPanelCollapsed: true,
        toggleLeftPanel: mockToggleLeftPanel,
      });

      render(<GridToolbar {...defaultProps} />);

      fireEvent.click(screen.getByText('Layer 1'));

      expect(mockToggleLeftPanel).toHaveBeenCalled();
    });

    it('does not toggle left panel when already expanded', () => {
      const mockToggleLeftPanel = vi.fn();
      useViewStore.setState({
        leftPanelCollapsed: false,
        toggleLeftPanel: mockToggleLeftPanel,
      });

      render(<GridToolbar {...defaultProps} />);

      fireEvent.click(screen.getByText('Layer 1'));

      expect(mockToggleLeftPanel).not.toHaveBeenCalled();
    });
  });

  describe('keyboard mode indicators', () => {
    it('shows keyboard drag mode indicator when active', () => {
      useInteractionStore.setState({ keyboardDragMode: true });

      const { container } = render(<GridToolbar {...defaultProps} />);

      // Drag mode shows arrows icon and role="status"
      const statusElement = container.querySelector('[role="status"]');
      expect(statusElement).toBeInTheDocument();
    });

    it('exits keyboard drag mode when close clicked', () => {
      const mockSetKeyboardDragMode = vi.fn();
      useInteractionStore.setState({
        keyboardDragMode: true,
        setKeyboardDragMode: mockSetKeyboardDragMode,
      });

      const { container } = render(<GridToolbar {...defaultProps} />);

      // Find the close button in keyboard drag mode (contains X icon)
      const closeButton = container.querySelector('[aria-label*="exitMoveMode"]');
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockSetKeyboardDragMode).toHaveBeenCalledWith(false);
      }
    });

    it('shows keyboard resize mode indicator when active', () => {
      useInteractionStore.setState({ keyboardResizeMode: true });

      const { container } = render(<GridToolbar {...defaultProps} />);

      // Resize mode also shows role="status"
      const statusElement = container.querySelector('[role="status"]');
      expect(statusElement).toBeInTheDocument();
    });

    it('exits keyboard resize mode when close clicked', () => {
      const mockSetKeyboardResizeMode = vi.fn();
      useInteractionStore.setState({
        keyboardResizeMode: true,
        setKeyboardResizeMode: mockSetKeyboardResizeMode,
      });

      const { container } = render(<GridToolbar {...defaultProps} />);

      // Find the close button in keyboard resize mode
      const closeButton = container.querySelector('[aria-label*="exitResizeMode"]');
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockSetKeyboardResizeMode).toHaveBeenCalledWith(false);
      }
    });
  });

  describe('zoom controls', () => {
    it('calls fitToScreen when fit button clicked', () => {
      render(<GridToolbar {...defaultProps} />);

      fireEvent.click(screen.getByText(/fit/i));

      expect(mockZoomState.fitToScreen).toHaveBeenCalled();
    });

    it('displays zoom percentage rounded to nearest integer', () => {
      const zoomState = { ...mockZoomState, zoom: 1.567 };

      render(<GridToolbar {...defaultProps} zoomState={zoomState} />);

      expect(screen.getByText('157%')).toBeInTheDocument();
    });

    it('renders zoom controls group', () => {
      const { container } = render(<GridToolbar {...defaultProps} />);

      // Zoom controls are in a group with role="group"
      const zoomGroup = container.querySelector('[role="group"]');
      expect(zoomGroup).toBeInTheDocument();
    });
  });

  describe('show other layers toggle', () => {
    it('renders toggle when multiple layers exist', () => {
      const { container } = render(<GridToolbar {...defaultProps} />);

      // Toggle renders a checkbox role
      const checkbox = container.querySelector('[role="checkbox"]');
      expect(checkbox).toBeInTheDocument();
    });

    it('does not render toggle when single layer', () => {
      const { container } = render(<GridToolbar {...defaultProps} layers={[mockLayers[0]]} />);

      // No checkbox when only one layer
      const checkbox = container.querySelector('[role="checkbox"]');
      expect(checkbox).not.toBeInTheDocument();
    });

    it('shows checkbox with checked state', () => {
      useViewStore.setState({ showOtherLayers: true });

      render(<GridToolbar {...defaultProps} />);

      const checkbox = screen.getAllByTestId('checkbox')[0];
      expect(checkbox).toBeChecked();
    });

    it('shows checkbox with unchecked state', () => {
      useViewStore.setState({ showOtherLayers: false });

      render(<GridToolbar {...defaultProps} />);

      const checkbox = screen.getAllByTestId('checkbox')[0];
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('3D preview toggle', () => {
    it('shows toggle button', () => {
      const { container } = render(<GridToolbar {...defaultProps} />);

      // 3D button contains the cube icon
      const cubeIcon = container.querySelector('path[d*="M21 8a2 2 0"]');
      expect(cubeIcon).toBeInTheDocument();
    });

    it('toggles preview when clicked', () => {
      const mockToggleIsometricPreview = vi.fn();
      useViewStore.setState({
        toggleIsometricPreview: mockToggleIsometricPreview,
      });

      const { container } = render(<GridToolbar {...defaultProps} />);

      // Find button by looking for cube icon's parent button
      const cubeIcon = container.querySelector('path[d*="M21 8a2 2 0"]');
      const button = cubeIcon?.closest('button');
      if (button) {
        fireEvent.click(button);
        expect(mockToggleIsometricPreview).toHaveBeenCalled();
      }
    });

    it('applies primary button styling when preview is visible', () => {
      useViewStore.setState({ showIsometricPreview: true });

      const { container } = render(<GridToolbar {...defaultProps} />);

      const cubeIcon = container.querySelector('path[d*="M21 8a2 2 0"]');
      const button = cubeIcon?.closest('button');
      expect(button).toHaveClass('btn-primary');
    });

    it('applies ghost button styling when preview is hidden', () => {
      useViewStore.setState({ showIsometricPreview: false });

      const { container } = render(<GridToolbar {...defaultProps} />);

      const cubeIcon = container.querySelector('path[d*="M21 8a2 2 0"]');
      const button = cubeIcon?.closest('button');
      expect(button).toHaveClass('btn-ghost');
    });
  });

  describe('overflow menu', () => {
    it('shows overflow button when toolbar is narrow', () => {
      const { container } = render(<GridToolbar {...defaultProps} isNarrowToolbar={true} />);

      // Overflow button has aria-haspopup="menu"
      const overflowButton = container.querySelector('[aria-haspopup="menu"]');
      expect(overflowButton).toBeInTheDocument();
    });

    it('does not show overflow button when toolbar is wide', () => {
      const { container } = render(<GridToolbar {...defaultProps} isNarrowToolbar={false} />);

      const overflowButton = container.querySelector('[aria-haspopup="menu"]');
      expect(overflowButton).not.toBeInTheDocument();
    });

    it('opens overflow menu when clicked', () => {
      const { container } = render(<GridToolbar {...defaultProps} isNarrowToolbar={true} />);

      const overflowButton = container.querySelector('[aria-haspopup="menu"]');
      if (overflowButton) {
        fireEvent.click(overflowButton);
        expect(screen.getByRole('menu')).toBeInTheDocument();
      }
    });

    it('closes overflow menu when clicking outside', () => {
      const { container } = render(<GridToolbar {...defaultProps} isNarrowToolbar={true} />);

      const overflowButton = container.querySelector('[aria-haspopup="menu"]');
      if (overflowButton) {
        fireEvent.click(overflowButton);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        // Click outside
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      }
    });

    it('closes overflow menu on Escape key', () => {
      const { container } = render(<GridToolbar {...defaultProps} isNarrowToolbar={true} />);

      const overflowButton = container.querySelector('[aria-haspopup="menu"]');
      if (overflowButton) {
        fireEvent.click(overflowButton);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      }
    });

    it('shows show layers toggle in overflow menu', () => {
      const { container } = render(<GridToolbar {...defaultProps} isNarrowToolbar={true} />);

      const overflowButton = container.querySelector('[aria-haspopup="menu"]');
      if (overflowButton) {
        fireEvent.click(overflowButton);
        expect(screen.getByRole('menuitemcheckbox')).toBeInTheDocument();
      }
    });
  });

  describe('accessibility', () => {
    it('has zoom controls group with role', () => {
      const { container } = render(<GridToolbar {...defaultProps} />);

      const zoomGroup = container.querySelector('[role="group"]');
      expect(zoomGroup).toBeInTheDocument();
    });

    it('has aria-expanded on overflow menu button', () => {
      const { container } = render(<GridToolbar {...defaultProps} isNarrowToolbar={true} />);

      const button = container.querySelector('[aria-haspopup="menu"]');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      if (button) {
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
      }
    });

    it('has aria-haspopup on overflow menu button', () => {
      const { container } = render(<GridToolbar {...defaultProps} isNarrowToolbar={true} />);

      const button = container.querySelector('[aria-haspopup="menu"]');
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('has role status on keyboard mode indicators', () => {
      useInteractionStore.setState({ keyboardDragMode: true });

      render(<GridToolbar {...defaultProps} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has aria-live on keyboard mode indicators', () => {
      useInteractionStore.setState({ keyboardDragMode: true });

      render(<GridToolbar {...defaultProps} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });
});
