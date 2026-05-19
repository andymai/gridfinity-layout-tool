import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveLayerPanel } from '@/features/layers/components/ActiveLayerPanel';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { resetAllStores } from '@/test/testUtils';

// Mock ConfirmDialog
vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    onCancel,
    message,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    message: string;
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{message}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

// Mock Popover to render children inline (avoids portal issues in tests)
vi.mock('@/design-system', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Popover: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
      isOpen ? <div data-testid="size-popover">{children}</div> : null,
  };
});

describe('ActiveLayerPanel', () => {
  beforeEach(() => {
    resetAllStores();

    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: 'Test',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: 'coral', name: 'Coral', color: '#FF6B6B' }],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [],
      },
    });

    useSelectionStore.setState({
      activeLayerId: 'layer1',
      activeCategoryId: 'coral',
    });
    useInteractionStore.setState({
      paintSize: null,
    });
    useHalfGridModeStore.setState({
      halfGridMode: false,
    });
  });

  describe('rendering', () => {
    it('renders size selector button', () => {
      render(<ActiveLayerPanel />);

      expect(screen.getByText('Bin Palette')).toBeInTheDocument();
    });

    it('renders fill gaps button with count', () => {
      render(<ActiveLayerPanel />);

      // 10 * 8 = 80 empty cells
      expect(screen.getByText('Fill 80 gaps')).toBeInTheDocument();
    });

    it('renders clear button', () => {
      render(<ActiveLayerPanel />);

      expect(screen.getByText('No bins')).toBeInTheDocument();
    });

    it('returns null when no active layer', () => {
      useSelectionStore.setState({ activeLayerId: '' });
      const { container } = render(<ActiveLayerPanel />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('size selector popover', () => {
    it('opens popover when size button clicked', () => {
      render(<ActiveLayerPanel />);

      fireEvent.click(screen.getByText('Bin Palette'));

      expect(screen.getByTestId('size-popover')).toBeInTheDocument();
    });

    it('displays sizes in popover', () => {
      render(<ActiveLayerPanel />);

      fireEvent.click(screen.getByText('Bin Palette'));

      expect(screen.getByText('1×1')).toBeInTheDocument();
      expect(screen.getByText('2×2')).toBeInTheDocument();
      expect(screen.getByText('6×6')).toBeInTheDocument();
      expect(screen.getByText('1×2')).toBeInTheDocument();
      expect(screen.getByText('2×3')).toBeInTheDocument();
    });

    it('displays squares and rectangles sections in popover', () => {
      render(<ActiveLayerPanel />);

      fireEvent.click(screen.getByText('Bin Palette'));

      expect(screen.getByText('Squares')).toBeInTheDocument();
      expect(screen.getByText('Rectangles')).toBeInTheDocument();
    });
  });

  describe('paint mode', () => {
    it('toggles paint size when clicking size button in popover', () => {
      render(<ActiveLayerPanel />);

      // Open popover
      fireEvent.click(screen.getByText('Bin Palette'));
      // Click a size
      fireEvent.click(screen.getByText('2×2'));

      expect(useInteractionStore.getState().paintSize).toEqual({ width: 2, depth: 2 });
    });

    it('shows selected size in toolbar button', () => {
      useInteractionStore.setState({ paintSize: { width: 2, depth: 2 } });

      render(<ActiveLayerPanel />);

      expect(screen.getByText('2×2')).toBeInTheDocument();
    });

    it('shows fill with size when paint size selected', () => {
      useInteractionStore.setState({ paintSize: { width: 2, depth: 2 } });

      render(<ActiveLayerPanel />);

      expect(screen.getByText('Fill with 2×2')).toBeInTheDocument();
    });

    it('shows fill gaps when no paint size selected', () => {
      render(<ActiveLayerPanel />);

      expect(screen.getByText('Fill 80 gaps')).toBeInTheDocument();
      expect(screen.queryByText(/Fill with/)).not.toBeInTheDocument();
    });
  });

  describe('fill operations', () => {
    it('fills layer with selected size', () => {
      useInteractionStore.setState({ paintSize: { width: 2, depth: 2 } });

      render(<ActiveLayerPanel />);
      fireEvent.click(screen.getByText('Fill with 2×2'));

      // Should have added bins (10x8 = 80 cells, 2x2 bins = 20 bins)
      expect(useLayoutStore.getState().layout.bins.length).toBeGreaterThan(0);
    });

    it('clears paint size after filling', () => {
      useInteractionStore.setState({ paintSize: { width: 2, depth: 2 } });

      render(<ActiveLayerPanel />);
      fireEvent.click(screen.getByText('Fill with 2×2'));

      expect(useInteractionStore.getState().paintSize).toBeNull();
    });
  });

  describe('fill gaps', () => {
    it('shows gap count in button', () => {
      render(<ActiveLayerPanel />);

      // 10 * 8 = 80 empty cells
      expect(screen.getByText('Fill 80 gaps')).toBeInTheDocument();
    });

    it('disables fill gaps when no empty cells', () => {
      // Fill the layer completely
      useLayoutStore.getState().fillLayer('layer1', 2, 2, 'coral', false);

      render(<ActiveLayerPanel />);

      expect(screen.getByText('No gaps')).toBeInTheDocument();
      expect(screen.getByText('No gaps').closest('button')).toBeDisabled();
    });

    it('fills gaps when button clicked', () => {
      // Add one bin to leave gaps
      useLayoutStore.getState().addBin({
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });

      render(<ActiveLayerPanel />);
      fireEvent.click(screen.getByText(/Fill.*gaps/));

      // Should have added more bins
      expect(useLayoutStore.getState().layout.bins.length).toBeGreaterThan(1);
    });
  });

  describe('clear layer', () => {
    it('shows clear button with bin count', () => {
      // Add some bins
      useLayoutStore.getState().addBin({
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });
      useLayoutStore.getState().addBin({
        layerId: 'layer1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });

      render(<ActiveLayerPanel />);

      expect(screen.getByText('Clear 2 bins')).toBeInTheDocument();
    });

    it('shows disabled when no bins', () => {
      render(<ActiveLayerPanel />);

      expect(screen.getByText('No bins')).toBeInTheDocument();
      expect(screen.getByText('No bins').closest('button')).toBeDisabled();
    });

    it('shows confirmation dialog on clear click', () => {
      useLayoutStore.getState().addBin({
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });

      render(<ActiveLayerPanel />);
      fireEvent.click(screen.getByText('Clear 1 bins'));

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    it('clears bins on confirm', () => {
      useLayoutStore.getState().addBin({
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'coral',
        label: '',
        notes: '',
      });

      render(<ActiveLayerPanel />);
      fireEvent.click(screen.getByText('Clear 1 bins'));
      fireEvent.click(screen.getByText('Confirm'));

      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });
  });

  describe('rotation toggle', () => {
    it('shows wide/tall toggle in popover', () => {
      render(<ActiveLayerPanel />);

      // Open popover
      fireEvent.click(screen.getByText('Bin Palette'));

      expect(screen.getByText('Wide')).toBeInTheDocument();
    });

    it('toggles rectangle orientation', () => {
      render(<ActiveLayerPanel />);

      // Open popover
      fireEvent.click(screen.getByText('Bin Palette'));

      // Click to rotate
      fireEvent.click(screen.getByText('Wide'));

      expect(screen.getByText('Tall')).toBeInTheDocument();
    });
  });

  describe('shift+click to stash', () => {
    it('adds bin to stash on shift+click in popover', () => {
      render(<ActiveLayerPanel />);

      // Open popover
      fireEvent.click(screen.getByText('Bin Palette'));

      // Shift+click on 2×2
      const button = screen.getByText('2×2').closest('button')!;
      fireEvent.click(button, { shiftKey: true });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins).toHaveLength(1);
      expect(bins[0].layerId).toBe('__staging__');
      expect(bins[0].width).toBe(2);
      expect(bins[0].depth).toBe(2);
    });
  });
});
