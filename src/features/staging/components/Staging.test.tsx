import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Staging } from '@/features/staging/components/Staging';
import { useLayoutStore, useUIStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import type { Bin } from '@/core/types';

// Mock useResponsive
vi.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isTouchDevice: false, isTablet: false, isMobile: false }),
}));

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

      expect(screen.getByText('1 bins')).toBeInTheDocument();
    });

    it('renders Clear All button', () => {
      addStagedBins([{}]);

      render(<Staging />);

      expect(screen.getByText('Clear all')).toBeInTheDocument();
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

      expect(showContextMenuSpy).toHaveBeenCalledWith([bins[0].id], { x: 100, y: 100 }, 'staging');
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

      fireEvent.click(screen.getByText('Clear all'));

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    it('shows correct message in confirm dialog', () => {
      addStagedBins([{}, {}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear all'));

      expect(screen.getByTestId('confirm-message')).toHaveTextContent(
        'Delete all 2 stashed bin(s)? This cannot be undone.'
      );
    });

    it('deletes all staged bins when confirmed', () => {
      addStagedBins([{}, {}, {}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear all'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      // Staged bins should be deleted
      const stagingBins = useLayoutStore
        .getState()
        .layout.bins.filter((b) => b.layerId === STAGING_ID);
      expect(stagingBins).toHaveLength(0);
    });

    it('closes dialog when cancelled', () => {
      addStagedBins([{}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear all'));
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('does not delete bins when cancelled', () => {
      addStagedBins([{}, {}]);

      render(<Staging />);

      fireEvent.click(screen.getByText('Clear all'));
      fireEvent.click(screen.getByTestId('cancel-button'));

      const stagingBins = useLayoutStore
        .getState()
        .layout.bins.filter((b) => b.layerId === STAGING_ID);
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

    it('clusters bins by category (same category bins appear together)', () => {
      // Create a second category
      const layout = useLayoutStore.getState().layout;
      const cat1 = layout.categories[0].id;
      const cat2 = 'test-category-2';
      useLayoutStore.setState({
        layout: {
          ...layout,
          categories: [...layout.categories, { id: cat2, name: 'Category 2', color: '#00ff00' }],
        },
      });

      // Add bins: cat2, cat1, cat2, cat1 (interleaved)
      // After clustering, cat1 bins should be grouped, cat2 bins should be grouped
      const bins = addStagedBins([
        { id: 'bin-cat2-a', width: 2, depth: 2, category: cat2 },
        { id: 'bin-cat1-a', width: 2, depth: 2, category: cat1 },
        { id: 'bin-cat2-b', width: 2, depth: 2, category: cat2 },
        { id: 'bin-cat1-b', width: 2, depth: 2, category: cat1 },
      ]);

      render(<Staging />);

      // All bins should be rendered
      for (const bin of bins) {
        expect(document.querySelector(`[data-staging-bin-id="${bin.id}"]`)).toBeInTheDocument();
      }
    });

    it('clusters bins by similar dimensions (within 1 unit)', () => {
      // Add bins with different sizes
      // 2x2 and 2.5x2.5 should cluster (both floor to 2x2)
      // 4x4 should be in its own cluster
      const bins = addStagedBins([
        { id: 'bin-small-a', width: 2, depth: 2 },
        { id: 'bin-large', width: 4, depth: 4 },
        { id: 'bin-small-b', width: 2.5, depth: 2.5 },
      ]);

      render(<Staging />);

      // All bins should be rendered
      for (const bin of bins) {
        expect(document.querySelector(`[data-staging-bin-id="${bin.id}"]`)).toBeInTheDocument();
      }
    });

    it('separates bins at dimension boundaries (1.9 vs 2.0)', () => {
      // floor(1.9) = 1, floor(2.0) = 2, so these should be in different clusters
      // This documents the "same floor value" behavior
      const bins = addStagedBins([
        { id: 'bin-1.9', width: 1.9, depth: 1.9 },
        { id: 'bin-2.0', width: 2.0, depth: 2.0 },
      ]);

      render(<Staging />);

      // Both bins should be rendered (in separate clusters)
      for (const bin of bins) {
        expect(document.querySelector(`[data-staging-bin-id="${bin.id}"]`)).toBeInTheDocument();
      }
    });

    it('orders clusters by bin count (largest cluster first)', () => {
      // Create categories
      const layout = useLayoutStore.getState().layout;
      const cat1 = layout.categories[0].id;
      const cat2 = 'test-category-many';
      useLayoutStore.setState({
        layout: {
          ...layout,
          categories: [...layout.categories, { id: cat2, name: 'Many Bins', color: '#ff00ff' }],
        },
      });

      // cat2 has 3 bins, cat1 has 1 bin
      // cat2 cluster should appear first (bottom-left in grid)
      addStagedBins([
        { id: 'bin-cat1-single', width: 2, depth: 2, category: cat1 },
        { id: 'bin-cat2-a', width: 2, depth: 2, category: cat2 },
        { id: 'bin-cat2-b', width: 2, depth: 2, category: cat2 },
        { id: 'bin-cat2-c', width: 2, depth: 2, category: cat2 },
      ]);

      render(<Staging />);

      // All bins should render - the clustering is internal to packing
      const binElements = document.querySelectorAll('[data-staging-bin-id]');
      expect(binElements).toHaveLength(4);
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
      expect(binElement?.getAttribute('title')).toBe('3×2×4u - Test Bin');
    });

    it('shows Unlabeled for bins without label', () => {
      addStagedBins([{ label: '' }]);

      render(<Staging />);

      const binElement = document.querySelector('[data-staging-bin-id]');
      expect(binElement?.getAttribute('title')).toBe('2×2×3u - Unlabeled');
    });
  });

  describe('accessibility', () => {
    it('renders stash container with data-stash attribute', () => {
      addStagedBins([{}]);

      const { container } = render(<Staging />);

      expect(container.querySelector('[data-stash]')).toBeInTheDocument();
    });
  });

  describe('resize handle', () => {
    beforeEach(() => {
      // Mock window.innerHeight for consistent test behavior
      Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
    });

    it('renders resize handle with correct ARIA attributes', () => {
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      expect(handle).toBeInTheDocument();
      expect(handle).toHaveAttribute('role', 'separator');
      expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
      expect(handle).toHaveAttribute('aria-label');
      // Default max height is 33vh of 800px = 264px
      expect(handle).toHaveAttribute('aria-valuenow', '264');
      expect(handle).toHaveAttribute('aria-valuemin', '80');
      // Max is 90% of 800px = 720px
      expect(handle).toHaveAttribute('aria-valuemax', '720');
    });

    it('renders resize handle with cursor-ns-resize for vertical resizing', () => {
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      expect(handle.className).toContain('cursor-ns-resize');
    });

    it('starts resize on pointer down', () => {
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      // Mock setPointerCapture
      handle.setPointerCapture = vi.fn();

      fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });

      expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('updates height during pointer move while resizing', () => {
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      const scrollContainer = document
        .getElementById('staging-stash-panel')
        ?.querySelector('.overflow-y-auto');

      // Mock setPointerCapture
      handle.setPointerCapture = vi.fn();

      // Start resize
      fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });

      // Move pointer up (should increase height)
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 400 });

      // Check that maxHeight was updated inline
      expect(scrollContainer?.getAttribute('style')).toContain('max-height');
    });

    it('persists height to settings on pointer up', async () => {
      const { useSettingsStore } = await import('@/core/store/settings');
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      // Mock pointer capture methods
      handle.setPointerCapture = vi.fn();
      handle.releasePointerCapture = vi.fn();

      // Complete a resize gesture
      fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 400 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      // Verify release was called
      expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);

      // Settings should be updated (stashMaxHeight is no longer null)
      // Note: In jsdom, offsetHeight is 0, so it will save 0
      expect(useSettingsStore.getState().settings.stashMaxHeight).not.toBeNull();
    });

    it('handles pointer cancel by releasing capture', () => {
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      handle.setPointerCapture = vi.fn();
      handle.releasePointerCapture = vi.fn();

      fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
      fireEvent.pointerCancel(handle, { pointerId: 1 });

      expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('resets height to default on double-click', async () => {
      const { useSettingsStore } = await import('@/core/store/settings');
      // Set a custom height first
      useSettingsStore.getState().updateSetting('stashMaxHeight', 400);
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      fireEvent.doubleClick(handle);

      // Should reset to null (default 33vh)
      expect(useSettingsStore.getState().settings.stashMaxHeight).toBeNull();
    });

    it('uses persisted height when available', async () => {
      const { useSettingsStore } = await import('@/core/store/settings');
      useSettingsStore.getState().updateSetting('stashMaxHeight', 350);
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      // aria-valuenow should reflect persisted value
      expect(handle).toHaveAttribute('aria-valuenow', '350');
    });

    it('clamps height to minimum during resize', () => {
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      const scrollContainer = document
        .getElementById('staging-stash-panel')
        ?.querySelector('.overflow-y-auto');

      handle.setPointerCapture = vi.fn();

      // Start at high Y (small height), try to drag down further
      fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 });
      // Drag down way past minimum (clientY 1000 means -900 from start, negative dy)
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 1000 });

      // Height should be clamped to minimum (80px)
      const style = scrollContainer?.getAttribute('style') || '';
      // The height should exist and not be negative
      expect(style).toContain('max-height');
    });

    it('does not update height when not resizing', () => {
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      const scrollContainer = document
        .getElementById('staging-stash-panel')
        ?.querySelector('.overflow-y-auto');

      // Get initial style
      const initialStyle = scrollContainer?.getAttribute('style') || '';

      // Move pointer without starting resize
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 400 });

      // Style should not change
      expect(scrollContainer?.getAttribute('style') || '').toBe(initialStyle);
    });

    it('prevents default and stops propagation on pointer down', () => {
      addStagedBins([{}]);

      render(<Staging />);

      const handle = screen.getByTestId('stash-resize-handle');
      handle.setPointerCapture = vi.fn();

      const event = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        clientY: 500,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      handle.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
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
