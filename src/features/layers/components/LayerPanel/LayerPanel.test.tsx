import type * as DesignSystem from '@/design-system';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LayerPanel } from '@/features/layers/components/LayerPanel';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { resetAllStores } from '@/test/testUtils';
import type { Layer } from '@/core/types';

// Mock Collapsible to simplify testing
vi.mock('@/design-system', async () => ({
  ...(await vi.importActual<typeof DesignSystem>('@/design-system')),
  Collapsible: ({
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

// Capture props passed to diagram for testing callback wiring
let capturedProps: Record<string, unknown> = {};
vi.mock('./HeightCrossSectionDiagram', () => ({
  HeightCrossSectionDiagram: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid="cross-section-diagram" />;
  },
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
    capturedProps = {};
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

    it('passes editingLayerId to diagram', () => {
      render(<LayerPanel />);

      expect(capturedProps.editingLayerId).toBeNull();
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

    it('shows confirm dialog when onDeleteLayer callback is triggered', () => {
      render(<LayerPanel />);

      act(() => {
        (capturedProps.onDeleteLayer as (id: string) => void)('layer-2');
      });

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    it('shows layer name in confirm dialog', () => {
      render(<LayerPanel />);

      act(() => {
        (capturedProps.onDeleteLayer as (id: string) => void)('layer-2');
      });

      expect(screen.getByTestId('confirm-message')).toHaveTextContent('Layer 2');
    });

    it('deletes layer when confirmed', () => {
      render(<LayerPanel />);

      act(() => {
        (capturedProps.onDeleteLayer as (id: string) => void)('layer-2');
      });
      fireEvent.click(screen.getByTestId('confirm-button'));

      const layers = useLayoutStore.getState().layout.layers;
      expect(layers).toHaveLength(1);
      expect(layers[0].id).toBe('layer-1');
    });

    it('closes dialog when cancelled', () => {
      render(<LayerPanel />);

      act(() => {
        (capturedProps.onDeleteLayer as (id: string) => void)('layer-2');
      });
      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('switches to remaining layer after delete', () => {
      render(<LayerPanel />);

      act(() => {
        (capturedProps.onDeleteLayer as (id: string) => void)('layer-2');
      });
      fireEvent.click(screen.getByTestId('confirm-button'));

      expect(useSelectionStore.getState().activeLayerId).toBe('layer-1');
    });
  });

  describe('diagram callback wiring', () => {
    it('wires onNameChange to update layer name in store', () => {
      render(<LayerPanel />);

      const layerId = useLayoutStore.getState().layout.layers[0].id;
      act(() => {
        (capturedProps.onNameChange as (id: string, name: string) => void)(layerId, 'New Name');
      });

      expect(useLayoutStore.getState().layout.layers[0].name).toBe('New Name');
    });

    it('wires onHeightChange to update layer height in store', () => {
      render(<LayerPanel />);

      const layerId = useLayoutStore.getState().layout.layers[0].id;
      const initialHeight = useLayoutStore.getState().layout.layers[0].height;
      act(() => {
        (capturedProps.onHeightChange as (id: string, delta: number) => void)(layerId, 1);
      });

      expect(useLayoutStore.getState().layout.layers[0].height).toBe(initialHeight + 1);
    });

    it('wires onEditingStart to set activeLayer and editingLayerId', () => {
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

      render(<LayerPanel />);

      act(() => {
        (capturedProps.onEditingStart as (id: string) => void)('layer-2');
      });

      expect(useSelectionStore.getState().activeLayerId).toBe('layer-2');
    });

    it('wires onEditingEnd to clear editingLayerId', () => {
      render(<LayerPanel />);

      // Start editing
      const layerId = useLayoutStore.getState().layout.layers[0].id;
      act(() => {
        (capturedProps.onEditingStart as (id: string) => void)(layerId);
      });

      // End editing
      act(() => {
        (capturedProps.onEditingEnd as () => void)();
      });

      expect(capturedProps.editingLayerId).toBeNull();
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

    it('shows total stats for multiple layers', () => {
      render(<LayerPanel />);

      expect(screen.getByText(/bins total/)).toBeInTheDocument();
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
