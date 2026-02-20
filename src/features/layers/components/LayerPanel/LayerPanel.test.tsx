import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayerPanel } from '@/features/layers/components/LayerPanel';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { resetAllStores } from '@/test/testUtils';
import type { Layer } from '@/core/types';

// Mock CollapsibleSection to simplify testing
vi.mock('@/shared/components/CollapsibleSection', () => ({
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

// Mock HeightCrossSectionDiagram — the diagram is the primary layer UI
vi.mock('./HeightCrossSectionDiagram', () => ({
  HeightCrossSectionDiagram: () => <div data-testid="cross-section-diagram" />,
}));

// Mock ConfirmDialog
vi.mock('@/shared/components/ConfirmDialog', () => ({
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
      useSelectionStore.setState({ activeLayerId: defaultLayerId });
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

    it('renders cross-section diagram as primary layer UI', () => {
      render(<LayerPanel />);

      const sections = screen.getAllByTestId('collapsible-section');
      expect(sections).toHaveLength(1);
      expect(screen.getByTestId('cross-section-diagram')).toBeInTheDocument();
    });

    it('renders active layer controls panel', () => {
      render(<LayerPanel />);

      expect(screen.getByTestId('layer-controls')).toBeInTheDocument();
      expect(screen.getByText('Layer 1')).toBeInTheDocument();
    });

    it('shows coverage stats in aggregate row', () => {
      render(<LayerPanel />);

      expect(screen.getByText(/% filled/)).toBeInTheDocument();
    });

    it('shows bin count in aggregate stats', () => {
      render(<LayerPanel />);

      expect(screen.getByText(/0 bins/)).toBeInTheDocument();
    });

    it('shows height total in aggregate stats', () => {
      render(<LayerPanel />);

      expect(screen.getByText(/\d+\/\d+u/)).toBeInTheDocument();
    });

    it('returns null when no active layer', () => {
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: { ...layout, layers: [] },
      });
      useSelectionStore.setState({ activeLayerId: null });

      const { container } = render(<LayerPanel />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('controls panel', () => {
    it('shows active layer name in controls', () => {
      render(<LayerPanel />);

      const controls = screen.getByTestId('layer-controls');
      expect(controls).toHaveTextContent('Layer 1');
    });

    it('shows active layer height in controls', () => {
      render(<LayerPanel />);

      const controls = screen.getByTestId('layer-controls');
      expect(controls).toHaveTextContent(/\du/);
    });

    it('shows height stepper in controls', () => {
      render(<LayerPanel />);

      expect(screen.getByLabelText('Increase Layer 1 height')).toBeInTheDocument();
      expect(screen.getByLabelText('Decrease Layer 1 height')).toBeInTheDocument();
    });

    it('shows active layer height value', () => {
      render(<LayerPanel />);

      const controls = screen.getByTestId('layer-controls');
      const heightDisplay = controls.querySelector('[title]');
      expect(heightDisplay).toBeTruthy();
    });
  });

  describe('layer name editing', () => {
    it('shows input when clicking active layer name', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByText('Layer 1'));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('updates layer name on change', () => {
      render(<LayerPanel />);

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

  describe('adding layers', () => {
    it('adds a new layer when add button clicked', () => {
      render(<LayerPanel />);

      fireEvent.click(screen.getByLabelText('Add new layer'));

      const layers = useLayoutStore.getState().layout.layers;
      expect(layers).toHaveLength(2);
    });

    it('disables add button when max layers reached', () => {
      const layout = useLayoutStore.getState().layout;
      const layers: Layer[] = [];
      for (let i = 0; i < 10; i++) {
        layers.push({ id: `layer-${i}`, name: `Layer ${i + 1}`, height: 1 });
      }
      useLayoutStore.setState({
        layout: { ...layout, layers },
      });
      useSelectionStore.setState({ activeLayerId: 'layer-0' });

      render(<LayerPanel />);

      expect(screen.getByLabelText('Add new layer')).toBeDisabled();
    });

    it('disables add button when drawer height is full', () => {
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          drawer: { ...layout.drawer, height: 3 },
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
        },
      });
      useSelectionStore.setState({ activeLayerId: 'layer-1' });

      render(<LayerPanel />);

      expect(screen.getByLabelText('Add new layer')).toBeDisabled();
    });

    it('sets new layer as active', () => {
      render(<LayerPanel />);

      const initialActiveId = useSelectionStore.getState().activeLayerId;
      fireEvent.click(screen.getByLabelText('Add new layer'));

      expect(useSelectionStore.getState().activeLayerId).not.toBe(initialActiveId);
    });
  });

  describe('deleting layers', () => {
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
      useSelectionStore.setState({ activeLayerId: 'layer-2' });
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

      expect(useSelectionStore.getState().activeLayerId).toBe('layer-1');
    });

    it('does not show delete button for single layer', () => {
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
        },
      });
      useSelectionStore.setState({ activeLayerId: 'layer-1' });

      render(<LayerPanel />);

      expect(screen.queryByLabelText(/Delete.*layer/)).not.toBeInTheDocument();
    });
  });

  describe('layer height', () => {
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
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 5 }],
        },
      });
      useSelectionStore.setState({ activeLayerId: 'layer-1' });

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
      useSelectionStore.setState({ activeLayerId: 'layer-1' });

      render(<LayerPanel />);

      expect(screen.getByLabelText('Decrease Layer 1 height')).toBeDisabled();
    });
  });

  describe('multiple layers', () => {
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
      useSelectionStore.setState({ activeLayerId: 'layer-1' });
    });

    it('shows height total in aggregate stats', () => {
      render(<LayerPanel />);

      expect(screen.getByText(/\d+\/\d+u/)).toBeInTheDocument();
    });

    it('shows total stats for multiple layers', () => {
      render(<LayerPanel />);

      expect(screen.getByText(/bins total/)).toBeInTheDocument();
    });

    it('shows delete button in controls for active layer', () => {
      render(<LayerPanel />);

      expect(screen.getByLabelText('Delete Layer 1 layer')).toBeInTheDocument();
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
});
