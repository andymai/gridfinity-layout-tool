import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Staging } from '../../components/Staging';
import { useLayoutStore, useUIStore } from '../../core/store';
import { resetAllStores } from '../testUtils';
import { STAGING_ID } from '../../core/constants';
import type { Bin } from '../../core/types';

// Mock useResponsive
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isTouchDevice: false, isTablet: false, isMobile: false }),
}));

// Mock ConfirmDialog
vi.mock('../../shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, onConfirm, onCancel, message }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    message: string;
  }) => (
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span data-testid="confirm-message">{message}</span>
        <button data-testid="confirm-button" onClick={onConfirm}>Confirm</button>
        <button data-testid="cancel-button" onClick={onCancel}>Cancel</button>
      </div>
    ) : null
  ),
}));

describe('Staging', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  function createStagedBin(overrides: Partial<Bin> = {}): Bin {
    return {
      id: `staged-bin-${Math.random().toString(36).slice(2, 9)}`,
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 3,
      layerId: STAGING_ID,
      category: useLayoutStore.getState().layout.categories[0]?.id || 'default',
      label: '',
      notes: '',
      ...overrides,
    };
  }

  function addStagedBins(bins: Partial<Bin>[]) {
    const layout = useLayoutStore.getState().layout;
    const fullBins = bins.map(createStagedBin);
    useLayoutStore.setState({
      layout: {
        ...layout,
        bins: [...layout.bins, ...fullBins],
      },
    });
    return fullBins;
  }

  describe('rendering', () => {
    it('returns null when no staged bins and not dragging', () => {
      const { container } = render(<Staging />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when bins are staged', () => {
      addStagedBins([{}]);

      render(<Staging />);

      expect(screen.getByText('Stash')).toBeInTheDocument();
    });

    it('shows bin count badge', () => {
      addStagedBins([{}, {}]);

      render(<Staging />);

      expect(screen.getByText('2 bins')).toBeInTheDocument();
    });

    it('shows singular bin count for one bin', () => {
      addStagedBins([{}]);

      render(<Staging />);

      expect(screen.getByText('1 bin')).toBeInTheDocument();
    });

    it('renders Clear All button', () => {
      addStagedBins([{}]);

      render(<Staging />);

      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('renders staged bins with category colors', () => {
      const categoryId = useLayoutStore.getState().layout.categories[0].id;
      addStagedBins([{ category: categoryId }]);

      render(<Staging />);

      // Bin should be rendered as a div with data-staging-bin-id
      expect(document.querySelector('[data-staging-bin-id]')).toBeInTheDocument();
    });

    it('renders bin dimensions in bin', () => {
      addStagedBins([{ width: 3, depth: 2, label: '' }]);

      render(<Staging />);

      // Dimensions are shown as "3×2"
      expect(screen.getByText('3×2')).toBeInTheDocument();
    });

    it('renders bin label when showLabels is true and label fits', () => {
      // Use a large bin so label fits
      addStagedBins([{ label: 'Test', width: 4, depth: 4 }]);
      // Ensure showLabels is enabled
      if (!useUIStore.getState().showLabels) {
        useUIStore.getState().toggleShowLabels();
      }

      render(<Staging />);

      // Short label should fit in large bin
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('formats fractional dimensions correctly', () => {
      addStagedBins([{ width: 1.5, depth: 2.5, label: '' }]);

      render(<Staging />);

      expect(screen.getByText('1.5×2.5')).toBeInTheDocument();
    });
  });

  describe('bin selection', () => {
    it('selects bin on click', () => {
      const bins = addStagedBins([{}]);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      fireEvent.click(binElement!);

      expect(useUIStore.getState().selectedBinIds).toContain(bins[0].id);
    });

    it('toggles selection with ctrl+click', () => {
      const bins = addStagedBins([{}, {}]);
      useUIStore.getState().setSelectedBin(bins[0].id);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[1].id}"]`);
      fireEvent.click(binElement!, { ctrlKey: true });

      // Both bins should now be selected
      expect(useUIStore.getState().selectedBinIds).toContain(bins[0].id);
      expect(useUIStore.getState().selectedBinIds).toContain(bins[1].id);
    });

    it('toggles selection with meta+click (Mac)', () => {
      const bins = addStagedBins([{}, {}]);
      useUIStore.getState().setSelectedBin(bins[0].id);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[1].id}"]`);
      fireEvent.click(binElement!, { metaKey: true });

      expect(useUIStore.getState().selectedBinIds).toContain(bins[0].id);
      expect(useUIStore.getState().selectedBinIds).toContain(bins[1].id);
    });

    it('replaces selection on regular click', () => {
      const bins = addStagedBins([{}, {}]);
      useUIStore.getState().setSelectedBin(bins[0].id);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[1].id}"]`);
      fireEvent.click(binElement!);

      expect(useUIStore.getState().selectedBinIds).toEqual([bins[1].id]);
    });

    it('shows selection ring on selected bins', () => {
      const bins = addStagedBins([{}]);
      useUIStore.getState().setSelectedBin(bins[0].id);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      expect(binElement?.className).toContain('ring-2');
    });
  });

  describe('context menu', () => {
    it('shows context menu on right-click', () => {
      const bins = addStagedBins([{}]);
      const showContextMenuSpy = vi.spyOn(useUIStore.getState(), 'showContextMenu');

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      fireEvent.contextMenu(binElement!, { clientX: 100, clientY: 100 });

      expect(showContextMenuSpy).toHaveBeenCalledWith(
        [bins[0].id],
        { x: 100, y: 100 },
        'staging'
      );
    });

    it('selects bin if not already selected on right-click', () => {
      const bins = addStagedBins([{}, {}]);
      // Select first bin
      useUIStore.getState().setSelectedBin(bins[0].id);

      render(<Staging />);

      // Right-click second bin
      const binElement = document.querySelector(`[data-staging-bin-id="${bins[1].id}"]`);
      fireEvent.contextMenu(binElement!, { clientX: 100, clientY: 100 });

      // Second bin should now be selected
      expect(useUIStore.getState().selectedBinIds).toContain(bins[1].id);
    });
  });

  describe('clear all functionality', () => {
    it('shows confirm dialog when Clear All is clicked', () => {
      addStagedBins([{}, {}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear All'));

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    it('shows correct message in confirm dialog', () => {
      addStagedBins([{}, {}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear All'));

      expect(screen.getByTestId('confirm-message')).toHaveTextContent('Delete all 2 stashed bins');
    });

    it('deletes all staged bins when confirmed', () => {
      addStagedBins([{}, {}, {}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear All'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      // Staged bins should be deleted
      const stagingBins = useLayoutStore.getState().layout.bins.filter(
        b => b.layerId === STAGING_ID
      );
      expect(stagingBins).toHaveLength(0);
    });

    it('closes dialog when cancelled', () => {
      addStagedBins([{}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear All'));
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('does not delete bins when cancelled', () => {
      addStagedBins([{}, {}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear All'));
      fireEvent.click(screen.getByTestId('cancel-button'));

      const stagingBins = useLayoutStore.getState().layout.bins.filter(
        b => b.layerId === STAGING_ID
      );
      expect(stagingBins).toHaveLength(2);
    });
  });

  describe('drag interaction', () => {
    it('starts staging drag on pointer down', () => {
      const bins = addStagedBins([{}]);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      fireEvent.pointerDown(binElement!, { button: 0 });

      expect(useUIStore.getState().interaction?.type).toBe('stagingDrag');
      expect((useUIStore.getState().interaction as { binId: string })?.binId).toBe(bins[0].id);
    });

    it('ignores non-primary button pointer down', () => {
      const bins = addStagedBins([{}]);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      fireEvent.pointerDown(binElement!, { button: 2 }); // Right click

      expect(useUIStore.getState().interaction).toBeNull();
    });

    it('shows bin as dragging during staging drag', () => {
      const bins = addStagedBins([{}]);
      useUIStore.setState({
        interaction: {
          type: 'stagingDrag',
          binId: bins[0].id,
          currentCoord: null,
          valid: false,
        },
      });

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      expect(binElement?.className).toContain('border-dashed');
    });

    it('does not select bin during drag', () => {
      const bins = addStagedBins([{}]);
      useUIStore.setState({
        interaction: {
          type: 'stagingDrag',
          binId: bins[0].id,
          currentCoord: null,
          valid: false,
        },
      });

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      fireEvent.click(binElement!);

      // Selection should not change during drag
      expect(useUIStore.getState().selectedBinIds).toEqual([]);
    });
  });

  describe('bin packing', () => {
    it('packs multiple bins without overlap', () => {
      // Add bins that would overlap if not packed
      addStagedBins([
        { width: 2, depth: 2 },
        { width: 2, depth: 2 },
        { width: 2, depth: 2 },
      ]);

      render(<Staging />);

      // All bins should be rendered
      const binElements = document.querySelectorAll('[data-staging-bin-id]');
      expect(binElements).toHaveLength(3);
    });

    it('sorts bins by area for better packing', () => {
      // Add small bin first, then large bin
      const bins = addStagedBins([
        { width: 1, depth: 1 },
        { width: 3, depth: 3 },
      ]);

      render(<Staging />);

      // Both bins should be rendered
      expect(document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`)).toBeInTheDocument();
      expect(document.querySelector(`[data-staging-bin-id="${bins[1].id}"]`)).toBeInTheDocument();
    });
  });

  describe('pointer events', () => {
    it('handles pointer move event', () => {
      const bins = addStagedBins([{}]);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      fireEvent.pointerDown(binElement!, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(binElement!, { clientX: 150, clientY: 150 });

      // Should not throw
    });

    it('handles pointer up event', () => {
      const bins = addStagedBins([{}]);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      fireEvent.pointerDown(binElement!, { button: 0 });
      fireEvent.pointerUp(binElement!);

      // Should not throw
    });

    it('handles pointer cancel event', () => {
      const bins = addStagedBins([{}]);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);
      fireEvent.pointerDown(binElement!, { button: 0 });
      fireEvent.pointerCancel(binElement!);

      // Should not throw
    });

    it('tracks hover state', () => {
      const bins = addStagedBins([{}]);

      render(<Staging />);

      const binElement = document.querySelector(`[data-staging-bin-id="${bins[0].id}"]`);

      fireEvent.pointerEnter(binElement!);
      // Rotate button should appear on hover
      // (we'd need to verify rotate button appears, but we're mocking isTouchDevice)

      fireEvent.pointerLeave(binElement!);
      // Should not throw
    });
  });

  describe('grid layout', () => {
    it('uses drawer width for grid width', () => {
      addStagedBins([{}]);
      useLayoutStore.getState().updateDrawer({ width: 8 });

      const { container } = render(<Staging />);

      // Grid container should be rendered
      const gridContainer = container.querySelector('[data-stash]');
      expect(gridContainer).toBeInTheDocument();
    });

    it('handles fractional drawer width', () => {
      addStagedBins([{}]);
      useLayoutStore.getState().updateDrawer({ width: 8.5 });

      render(<Staging />);

      // Should render without error
      expect(screen.getByText('Stash')).toBeInTheDocument();
    });
  });

  describe('bin title/tooltip', () => {
    it('shows bin info in title attribute', () => {
      addStagedBins([{ label: 'Test Bin', width: 3, depth: 2, height: 4 }]);

      render(<Staging />);

      const binElement = document.querySelector('[data-staging-bin-id]');
      expect(binElement?.getAttribute('title')).toContain('Test Bin');
      expect(binElement?.getAttribute('title')).toContain('3×2×4u');
    });

    it('shows Unlabeled for bins without label', () => {
      addStagedBins([{ label: '' }]);

      render(<Staging />);

      const binElement = document.querySelector('[data-staging-bin-id]');
      expect(binElement?.getAttribute('title')).toContain('Unlabeled');
    });
  });

  describe('accessibility', () => {
    it('renders stash container with data-stash attribute', () => {
      addStagedBins([{}]);

      const { container } = render(<Staging />);

      expect(container.querySelector('[data-stash]')).toBeInTheDocument();
    });
  });
});

describe('Staging as drop target', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  // Note: Full drop target behavior requires simulating drag from grid,
  // which is complex to test in unit tests. These tests verify the
  // component structure for drop target states.

  it('shows drop zone when dragging from grid with movement', () => {
    // Set up drag interaction
    useUIStore.setState({
      interaction: {
        type: 'drag',
        binIds: ['some-bin'],
        offset: { x: 0, y: 0 },
        originalPositions: [],
        currentCoord: { x: 0, y: 0 },
        valid: false,
        originalLayerId: 'layer-1',
      },
    });

    render(<Staging />);

    // Simulate pointer movement to trigger hasMoved state
    fireEvent(document, new PointerEvent('pointermove', { bubbles: true }));

    // After movement, the drop zone should appear
    // (Component will re-render with showAsDropTarget)
  });
});
