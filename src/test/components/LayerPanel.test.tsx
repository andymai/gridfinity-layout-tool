import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayerPanel } from '@/features/layers/components/LayerPanel';
import { useLayoutStore, useUIStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import type { Layer } from '@/core/types';

// Mock CollapsibleSection to simplify testing
vi.mock('../../shared/components/CollapsibleSection', () => ({
  CollapsibleSection: ({
    children,
    title,
    actions,
  }: {
    children: React.ReactNode;
    title: string;
    actions?: React.ReactNode;
  }) => (
    <div data-testid="collapsible-section">
      <div data-testid="section-header">
        <span>{title}</span>
        {actions}
      </div>
      <div data-testid="section-content">{children}</div>
    </div>
  ),
}));

// Mock ConfirmDialog
vi.mock('../../shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    onCancel,
    message,
    title,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    message: string;
    title: string;
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span data-testid="dialog-title">{title}</span>
        <span data-testid="confirm-message">{message}</span>
        <button data-testid="confirm-button" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

describe('LayerPanel', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    // Set activeLayerId to match the default layer
    const defaultLayerId = useLayoutStore.getState().layout.layers[0]?.id;
    if (defaultLayerId) {
      useUIStore.setState({ activeLayerId: defaultLayerId });
    }
  });

  describe('rendering', () => {
    it('renders Layers title', () => {
      render(<LayerPanel />);

      expect(screen.getByText('Layers')).toBeInTheDocument();
    });

    it('renders add layer button', () => {
      render(<LayerPanel />);

      expect(screen.getByLabelText('Add new layer')).toBeInTheDocument();
    });

    it('renders active layer', () => {
      render(<LayerPanel />);

      // Default has one layer called "Layer 1"
      expect(screen.getByText('Layer 1')).toBeInTheDocument();
    });

    it('shows coverage stats', () => {
      render(<LayerPanel />);

      // Should show coverage percentage
      expect(screen.getByText(/% filled/)).toBeInTheDocument();
    });

    it('shows bin count in stats', () => {
      render(<LayerPanel />);

      // Should show bin count (0 bins initially)
      expect(screen.getByText(/0 bins/)).toBeInTheDocument();
    });

    it('returns null when no active layer', () => {
      // Clear all layers (edge case)
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: { ...layout, layers: [] },
      });
      useUIStore.setState({ activeLayerId: null });

      const { container } = render(<LayerPanel />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('adding layers', () => {
    it('adds a new layer when add button clicked', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByLabelText('Add new layer'));

      const layers = useLayoutStore.getState().layout.layers;
      expect(layers).toHaveLength(2);
    });

    it('disables add button when max layers reached', () => {
      // Add layers until we hit the max (10)
      const layout = useLayoutStore.getState().layout;
      const layers: Layer[] = [];
      for (let i = 0; i < 10; i++) {
        layers.push({ id: `layer-${i}`, name: `Layer ${i + 1}`, height: 1 });
      }
      useLayoutStore.setState({
        layout: { ...layout, layers },
      });
      useUIStore.setState({ activeLayerId: 'layer-0' });

      render(<LayerPanel />);

      expect(screen.getByLabelText('Add new layer')).toBeDisabled();
    });

    it('disables add button when drawer height is full', () => {
      // Set up layers that use all drawer height
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          drawer: { ...layout.drawer, height: 3 },
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
        },
      });
      useUIStore.setState({ activeLayerId: 'layer-1' });

      render(<LayerPanel />);

      expect(screen.getByLabelText('Add new layer')).toBeDisabled();
    });

    it('sets new layer as active', () => {
      render(<LayerPanel />);

      const initialActiveId = useUIStore.getState().activeLayerId;
      fireEvent.click(screen.getByLabelText('Add new layer'));

      expect(useUIStore.getState().activeLayerId).not.toBe(initialActiveId);
    });
  });

  describe('deleting layers', () => {
    beforeEach(() => {
      // Set up two layers for delete tests
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [
            { id: 'layer-1', name: 'Layer 1', height: 3 },
            { id: 'layer-2', name: 'Layer 2', height: 3 },
          ],
        },
      });
      useUIStore.setState({ activeLayerId: 'layer-2' });
    });

    it('shows delete button for active layer when multiple layers exist', () => {
      render(<LayerPanel />);

      expect(screen.getByLabelText('Delete Layer 2 layer')).toBeInTheDocument();
    });

    it('shows confirm dialog when delete button clicked', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByLabelText('Delete Layer 2 layer'));

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    it('shows layer name in confirm dialog', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByLabelText('Delete Layer 2 layer'));

      expect(screen.getByTestId('confirm-message')).toHaveTextContent('Layer 2');
    });

    it('deletes layer when confirmed', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByLabelText('Delete Layer 2 layer'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      const layers = useLayoutStore.getState().layout.layers;
      expect(layers).toHaveLength(1);
      expect(layers[0].id).toBe('layer-1');
    });

    it('closes dialog when cancelled', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByLabelText('Delete Layer 2 layer'));
      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('switches to remaining layer after delete', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByLabelText('Delete Layer 2 layer'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      expect(useUIStore.getState().activeLayerId).toBe('layer-1');
    });

    it('does not show delete button for single layer', () => {
      // Reset to single layer
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
        },
      });
      useUIStore.setState({ activeLayerId: 'layer-1' });

      render(<LayerPanel />);

      expect(screen.queryByLabelText(/Delete.*layer/)).not.toBeInTheDocument();
    });
  });

  describe('layer selection', () => {
    beforeEach(() => {
      // Set up two layers
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [
            { id: 'layer-1', name: 'Layer 1', height: 3 },
            { id: 'layer-2', name: 'Layer 2', height: 3 },
          ],
        },
      });
      useUIStore.setState({ activeLayerId: 'layer-1' });
    });

    it('clicking layer name sets it as active', () => {
      render(<LayerPanel />);

      // Click on the layer button for Layer 2
      const layer2Button = screen.getByRole('button', { name: /Layer 2.*height units/ });
      fireEvent.click(layer2Button);

      expect(useUIStore.getState().activeLayerId).toBe('layer-2');
    });
  });

  describe('layer name editing', () => {
    it('shows input when clicking active layer name', () => {
      render(<LayerPanel />);

      // Click on the active layer's name button to start editing
      const nameButton = screen.getByText('Layer 1');
      fireEvent.click(nameButton);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('updates layer name on change', () => {
      render(<LayerPanel />);

      // Start editing
      fireEvent.click(screen.getByText('Layer 1'));

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Name' } });

      expect(useLayoutStore.getState().layout.layers[0].name).toBe('New Name');
    });

    it('exits edit mode on blur', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByText('Layer 1'));
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('exits edit mode on Enter', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByText('Layer 1'));
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('layer height', () => {
    it('shows layer height', () => {
      render(<LayerPanel />);

      // Default layer height is shown
      expect(screen.getByText(/\du/)).toBeInTheDocument();
    });

    it('shows height controls for active layer', () => {
      render(<LayerPanel />);

      expect(screen.getByLabelText('Increase Layer 1 height')).toBeInTheDocument();
      expect(screen.getByLabelText('Decrease Layer 1 height')).toBeInTheDocument();
    });

    it('increases height when plus clicked', () => {
      render(<LayerPanel />);

      const initialHeight = useLayoutStore.getState().layout.layers[0].height;
      fireEvent.click(screen.getByLabelText('Increase Layer 1 height'));

      expect(useLayoutStore.getState().layout.layers[0].height).toBe(initialHeight + 1);
    });

    it('decreases height when minus clicked', () => {
      // Set initial height > 1
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 5 }],
        },
      });
      useUIStore.setState({ activeLayerId: 'layer-1' });

      render(<LayerPanel />);

      fireEvent.click(screen.getByLabelText('Decrease Layer 1 height'));

      expect(useLayoutStore.getState().layout.layers[0].height).toBe(4);
    });

    it('disables decrease button when height is 1', () => {
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 1 }],
        },
      });
      useUIStore.setState({ activeLayerId: 'layer-1' });

      render(<LayerPanel />);

      expect(screen.getByLabelText('Decrease Layer 1 height')).toBeDisabled();
    });
  });

  describe('multiple layers UI', () => {
    beforeEach(() => {
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [
            { id: 'layer-1', name: 'Layer 1', height: 3 },
            { id: 'layer-2', name: 'Layer 2', height: 3 },
          ],
        },
      });
      useUIStore.setState({ activeLayerId: 'layer-1' });
    });

    it('shows height capacity indicator for multiple layers', () => {
      render(<LayerPanel />);

      // Should show total height like "6/12u"
      expect(screen.getByText(/\d+\/\d+u/)).toBeInTheDocument();
    });

    it('shows coverage percentage for each layer', () => {
      render(<LayerPanel />);

      // Multiple "%" elements should exist for layer coverages
      const percentages = screen.getAllByText(/%/);
      expect(percentages.length).toBeGreaterThanOrEqual(1);
    });

    it('shows total stats for multiple layers', () => {
      render(<LayerPanel />);

      expect(screen.getByText(/total/)).toBeInTheDocument();
    });
  });

  describe('drag and drop reordering', () => {
    beforeEach(() => {
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [
            { id: 'layer-1', name: 'Layer 1', height: 3 },
            { id: 'layer-2', name: 'Layer 2', height: 3 },
          ],
        },
      });
      useUIStore.setState({ activeLayerId: 'layer-1' });
    });

    it('layers are draggable when multiple exist', () => {
      render(<LayerPanel />);

      // Find layer items by their parent div structure
      const layerItems = document.querySelectorAll('[draggable="true"]');
      expect(layerItems.length).toBe(2);
    });

    it('handles drag start', () => {
      render(<LayerPanel />);

      const layerItem = document.querySelector('[draggable="true"]');
      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
      };

      fireEvent.dragStart(layerItem!, { dataTransfer });

      expect(dataTransfer.effectAllowed).toBe('move');
      expect(dataTransfer.setData).toHaveBeenCalled();
    });

    it('handles drag over', () => {
      render(<LayerPanel />);

      const layerItems = document.querySelectorAll('[draggable="true"]');
      const dataTransfer = { dropEffect: '' };

      fireEvent.dragOver(layerItems[1], { dataTransfer });

      expect(dataTransfer.dropEffect).toBe('move');
    });

    it('handles drag leave', () => {
      render(<LayerPanel />);

      const layerItem = document.querySelector('[draggable="true"]');
      fireEvent.dragLeave(layerItem!);

      // Should not throw
    });

    it('handles drop', () => {
      render(<LayerPanel />);

      const layerItems = document.querySelectorAll('[draggable="true"]');

      // Start drag from first item
      fireEvent.dragStart(layerItems[0], {
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      });

      // Drop on second item
      fireEvent.drop(layerItems[1], { dataTransfer: {} });

      // Layers should be reordered (or error shown if constraints prevent it)
    });

    it('handles drag end', () => {
      render(<LayerPanel />);

      const layerItem = document.querySelector('[draggable="true"]');

      fireEvent.dragStart(layerItem!, {
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      });
      fireEvent.dragEnd(layerItem!);

      // Should clean up drag state (no visual indication of dragging)
    });
  });

  describe('coverage calculations', () => {
    it('shows 0% coverage with no bins', () => {
      render(<LayerPanel />);

      expect(screen.getByText(/0% filled/)).toBeInTheDocument();
    });

    it('calculates coverage based on bin area', () => {
      const layout = useLayoutStore.getState().layout;
      const layerId = layout.layers[0].id;

      // Add bins that cover half the drawer
      useLayoutStore.setState({
        layout: {
          ...layout,
          bins: [
            {
              id: 'bin-1',
              x: 0,
              y: 0,
              width: 5,
              depth: 4,
              height: 3,
              layerId,
              category: layout.categories[0].id,
              label: '',
              notes: '',
            },
          ],
        },
      });

      render(<LayerPanel />);

      // 5×4 = 20 cells out of 10×8 = 80 cells = 25%
      expect(screen.getByText(/25% filled/)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('layers have aria-pressed attribute', () => {
      render(<LayerPanel />);

      const layerButton = screen.getByRole('button', { name: /Layer 1.*height units/ });
      expect(layerButton).toHaveAttribute('aria-pressed');
    });

    it('active layer has aria-pressed true', () => {
      render(<LayerPanel />);

      const layerButton = screen.getByRole('button', { name: /Layer 1.*active/ });
      expect(layerButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('height controls have aria-labels', () => {
      render(<LayerPanel />);

      expect(screen.getByLabelText('Increase Layer 1 height')).toBeInTheDocument();
      expect(screen.getByLabelText('Decrease Layer 1 height')).toBeInTheDocument();
    });
  });
});
