import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/Sidebar';
import { useLayoutStore, useUIStore, useSettingsStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { resetAllStores } from '@/test/testUtils';

// Mock child components to isolate Sidebar tests
vi.mock('../../features/layers/components/ActiveLayerPanel', () => ({
  ActiveLayerPanel: () => <div data-testid="active-layer-panel">ActiveLayerPanel</div>,
}));

vi.mock('../../features/layers/components/LayerPanel', () => ({
  LayerPanel: () => <div data-testid="layer-panel">LayerPanel</div>,
}));

vi.mock('../../features/categories/components/CategoriesPanel', () => ({
  CategoriesPanel: () => <div data-testid="categories-panel">CategoriesPanel</div>,
}));

vi.mock('../../shared/components/CollapsibleSection', () => ({
  CollapsibleSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid={`collapsible-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../../shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, onConfirm, onCancel, title, message }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
  }) => (
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span data-testid="dialog-title">{title}</span>
        <span data-testid="dialog-message">{message}</span>
        <button data-testid="confirm-btn" onClick={onConfirm}>Confirm</button>
        <button data-testid="cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    ) : null
  ),
}));

vi.mock('../../components/Modals/HalfBinModeBlockedModal', () => ({
  HalfBinModeBlockedModal: ({ isOpen, onClose, onRemediate }: {
    isOpen: boolean;
    onClose: () => void;
    onRemediate: () => void;
  }) => (
    isOpen ? (
      <div data-testid="half-bin-blocked-modal">
        <button data-testid="close-modal" onClick={onClose}>Close</button>
        <button data-testid="remediate-btn" onClick={onRemediate}>Remediate</button>
      </div>
    ) : null
  ),
}));

vi.mock('../../components/Modals/SettingsModal', () => ({
  SettingsModal: ({ isOpen, onClose }: {
    isOpen: boolean;
    onClose: () => void;
  }) => (
    isOpen ? (
      <div data-testid="settings-modal">
        <button data-testid="close-settings" onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isMobile: false, isTablet: false }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    // Set activeLayerId to match the default layer
    const defaultLayerId = useLayoutStore.getState().layout.layers[0]?.id;
    if (defaultLayerId) {
      useSelectionStore.setState({ activeLayerId: defaultLayerId });
    }
  });

  describe('collapsed state', () => {
    it('renders expanded by default', () => {
      render(<Sidebar />);

      expect(screen.getByText('Tools')).toBeInTheDocument();
    });

    it('shows collapse button when expanded', () => {
      render(<Sidebar />);

      expect(screen.getByLabelText('Collapse left panel')).toBeInTheDocument();
    });

    it('collapses when collapse button clicked', () => {
      render(<Sidebar />);

      fireEvent.click(screen.getByLabelText('Collapse left panel'));

      expect(useUIStore.getState().leftPanelCollapsed).toBe(true);
    });

    it('shows expand button when collapsed', () => {
      useViewStore.setState({ leftPanelCollapsed: true });

      render(<Sidebar />);

      expect(screen.getByLabelText('Expand left panel')).toBeInTheDocument();
    });

    it('expands when expand button clicked', () => {
      useViewStore.setState({ leftPanelCollapsed: true });

      render(<Sidebar />);

      fireEvent.click(screen.getByLabelText('Expand left panel'));

      expect(useUIStore.getState().leftPanelCollapsed).toBe(false);
    });

    it('hides content when collapsed', () => {
      useViewStore.setState({ leftPanelCollapsed: true });

      render(<Sidebar />);

      expect(screen.queryByText('Tools')).not.toBeInTheDocument();
    });
  });

  describe('nested panels', () => {
    it('renders ActiveLayerPanel', () => {
      render(<Sidebar />);

      expect(screen.getByTestId('active-layer-panel')).toBeInTheDocument();
    });

    it('renders LayerPanel', () => {
      render(<Sidebar />);

      expect(screen.getByTestId('layer-panel')).toBeInTheDocument();
    });

    it('renders CategoriesPanel', () => {
      render(<Sidebar />);

      expect(screen.getByTestId('categories-panel')).toBeInTheDocument();
    });
  });

  describe('grid size controls', () => {
    it('renders Grid Size section', () => {
      render(<Sidebar />);

      expect(screen.getByText('Grid Size')).toBeInTheDocument();
    });

    it('renders width controls', () => {
      render(<Sidebar />);

      expect(screen.getByLabelText('Decrease Drawer width in grid units')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase Drawer width in grid units')).toBeInTheDocument();
    });

    it('renders depth controls', () => {
      render(<Sidebar />);

      expect(screen.getByLabelText('Decrease Drawer depth in grid units')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase Drawer depth in grid units')).toBeInTheDocument();
    });

    it('renders height controls', () => {
      render(<Sidebar />);

      expect(screen.getByLabelText('Decrease Drawer height in units')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase Drawer height in units')).toBeInTheDocument();
    });

    it('increases width when plus clicked', () => {
      render(<Sidebar />);

      const initialWidth = useLayoutStore.getState().layout.drawer.width;
      fireEvent.click(screen.getByLabelText('Increase Drawer width in grid units'));

      expect(useLayoutStore.getState().layout.drawer.width).toBe(initialWidth + 1);
    });

    it('decreases width when minus clicked', () => {
      render(<Sidebar />);

      const initialWidth = useLayoutStore.getState().layout.drawer.width;
      fireEvent.click(screen.getByLabelText('Decrease Drawer width in grid units'));

      expect(useLayoutStore.getState().layout.drawer.width).toBe(initialWidth - 1);
    });

    it('increases depth when plus clicked', () => {
      render(<Sidebar />);

      const initialDepth = useLayoutStore.getState().layout.drawer.depth;
      fireEvent.click(screen.getByLabelText('Increase Drawer depth in grid units'));

      expect(useLayoutStore.getState().layout.drawer.depth).toBe(initialDepth + 1);
    });

    it('decreases depth when minus clicked', () => {
      render(<Sidebar />);

      const initialDepth = useLayoutStore.getState().layout.drawer.depth;
      fireEvent.click(screen.getByLabelText('Decrease Drawer depth in grid units'));

      expect(useLayoutStore.getState().layout.drawer.depth).toBe(initialDepth - 1);
    });

    it('increases height when plus clicked', () => {
      render(<Sidebar />);

      const initialHeight = useLayoutStore.getState().layout.drawer.height;
      fireEvent.click(screen.getByLabelText('Increase Drawer height in units'));

      expect(useLayoutStore.getState().layout.drawer.height).toBe(initialHeight + 1);
    });

    it('decreases height when minus clicked', () => {
      render(<Sidebar />);

      const initialHeight = useLayoutStore.getState().layout.drawer.height;
      fireEvent.click(screen.getByLabelText('Decrease Drawer height in units'));

      expect(useLayoutStore.getState().layout.drawer.height).toBe(initialHeight - 1);
    });

    it('disables decrease width at minimum', () => {
      useLayoutStore.getState().updateDrawer({ width: 0.5 });

      render(<Sidebar />);

      expect(screen.getByLabelText('Decrease Drawer width in grid units')).toBeDisabled();
    });

    it('disables decrease depth at minimum', () => {
      useLayoutStore.getState().updateDrawer({ depth: 0.5 });

      render(<Sidebar />);

      expect(screen.getByLabelText('Decrease Drawer depth in grid units')).toBeDisabled();
    });

    it('shows real-world dimensions in mm', () => {
      render(<Sidebar />);

      // Default: 10×8×12 units with 42mm grid unit and 7mm height unit
      // 420 × 336 × 84 mm
      expect(screen.getByText(/420.*×.*336.*×.*84.*mm/)).toBeInTheDocument();
    });
  });

  describe('half-bin mode', () => {
    it('renders half-bin mode toggle', () => {
      render(<Sidebar />);

      expect(screen.getByText('Half-bin mode')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle half-bin mode')).toBeInTheDocument();
    });

    it('half-bin checkbox reflects store state', () => {
      render(<Sidebar />);

      const checkbox = screen.getByLabelText('Toggle half-bin mode');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('toggles half-bin mode when clicked', () => {
      render(<Sidebar />);

      fireEvent.click(screen.getByLabelText('Toggle half-bin mode'));

      expect(useUIStore.getState().halfBinMode).toBe(true);
    });

    it('uses 0.5 step for width in half-bin mode', () => {
      useHalfBinModeStore.setState({ halfBinMode: true });

      render(<Sidebar />);

      const initialWidth = useLayoutStore.getState().layout.drawer.width;
      fireEvent.click(screen.getByLabelText('Increase Drawer width in grid units'));

      expect(useLayoutStore.getState().layout.drawer.width).toBe(initialWidth + 0.5);
    });

    it('uses 0.5 step for depth in half-bin mode', () => {
      useHalfBinModeStore.setState({ halfBinMode: true });

      render(<Sidebar />);

      const initialDepth = useLayoutStore.getState().layout.drawer.depth;
      fireEvent.click(screen.getByLabelText('Increase Drawer depth in grid units'));

      expect(useLayoutStore.getState().layout.drawer.depth).toBe(initialDepth + 0.5);
    });
  });

  describe('fractional edge controls', () => {
    it('does not show edge controls when dimensions are integers', () => {
      render(<Sidebar />);

      expect(screen.queryByText('Half-unit edge position')).not.toBeInTheDocument();
    });

    it('shows edge controls when width is fractional', () => {
      useLayoutStore.getState().updateDrawer({ width: 10.5 });

      render(<Sidebar />);

      expect(screen.getByText('Half-unit edge position')).toBeInTheDocument();
      expect(screen.getByText('Width (+.5)')).toBeInTheDocument();
    });

    it('shows edge controls when depth is fractional', () => {
      useLayoutStore.getState().updateDrawer({ depth: 8.5 });

      render(<Sidebar />);

      expect(screen.getByText('Half-unit edge position')).toBeInTheDocument();
      expect(screen.getByText('Depth (+.5)')).toBeInTheDocument();
    });

    it('shows Left/Right buttons for fractional width', () => {
      useLayoutStore.getState().updateDrawer({ width: 10.5 });

      render(<Sidebar />);

      expect(screen.getByText('Left')).toBeInTheDocument();
      expect(screen.getByText('Right')).toBeInTheDocument();
    });

    it('shows Bottom/Top buttons for fractional depth', () => {
      useLayoutStore.getState().updateDrawer({ depth: 8.5 });

      render(<Sidebar />);

      expect(screen.getByText('Bottom')).toBeInTheDocument();
      expect(screen.getByText('Top')).toBeInTheDocument();
    });

    it('changes fractional edge X position to start', () => {
      useLayoutStore.getState().updateDrawer({ width: 10.5 });

      render(<Sidebar />);

      fireEvent.click(screen.getByText('Left'));

      expect(useLayoutStore.getState().layout.drawer.fractionalEdgeX).toBe('start');
    });

    it('changes fractional edge Y position to start', () => {
      useLayoutStore.getState().updateDrawer({ depth: 8.5 });

      render(<Sidebar />);

      fireEvent.click(screen.getByText('Bottom'));

      expect(useLayoutStore.getState().layout.drawer.fractionalEdgeY).toBe('start');
    });
  });

  describe('physical units', () => {
    it('renders Physical Units section', () => {
      render(<Sidebar />);

      expect(screen.getByText('Physical Units')).toBeInTheDocument();
    });

    it('renders grid unit input', () => {
      render(<Sidebar />);

      expect(screen.getByLabelText('Grid unit')).toBeInTheDocument();
    });
  });

  describe('settings modal', () => {
    it('renders settings button in header', () => {
      render(<Sidebar />);

      expect(screen.getByLabelText('Open settings')).toBeInTheDocument();
    });

    it('opens settings modal when settings button clicked', () => {
      render(<Sidebar />);

      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });

    it('closes settings modal when close button clicked', () => {
      render(<Sidebar />);

      fireEvent.click(screen.getByLabelText('Open settings'));
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-settings'));

      expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
    });
  });

  describe('attribution', () => {
    it('renders Gridfinity attribution', () => {
      render(<Sidebar />);

      expect(screen.getByText(/Gridfinity by/)).toBeInTheDocument();
      expect(screen.getByText('Zack Freedman')).toBeInTheDocument();
    });

    it('renders tool attribution', () => {
      render(<Sidebar />);

      expect(screen.getByText(/Tool by/)).toBeInTheDocument();
      expect(screen.getByText('Andy Aragon')).toBeInTheDocument();
    });

    it('renders tip link', () => {
      render(<Sidebar />);

      expect(screen.getByText('Tip')).toBeInTheDocument();
    });
  });

  describe('scroll behavior', () => {
    it('handles scroll events', () => {
      render(<Sidebar />);

      const scrollContainer = document.querySelector('.overflow-y-auto');
      if (scrollContainer) {
        fireEvent.scroll(scrollContainer);
        // Should not throw
      }
    });
  });

  describe('accessibility', () => {
    it('sidebar has data-sidebar attribute', () => {
      render(<Sidebar />);

      expect(document.querySelector('[data-sidebar]')).toBeInTheDocument();
    });

    it('panel sections have data attributes', () => {
      render(<Sidebar />);

      expect(document.querySelector('[data-active-layer-panel]')).toBeInTheDocument();
      expect(document.querySelector('[data-layers-panel]')).toBeInTheDocument();
      expect(document.querySelector('[data-categories-panel]')).toBeInTheDocument();
      expect(document.querySelector('[data-grid-size-panel]')).toBeInTheDocument();
      expect(document.querySelector('[data-units-panel]')).toBeInTheDocument();
    });
  });
});
