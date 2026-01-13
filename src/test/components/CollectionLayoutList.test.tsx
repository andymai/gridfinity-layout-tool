import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { CollectionLayoutList } from '../../components/modals/LayoutManagerModal/CollectionLayoutList';
import { useCollectionStore } from '../../store/collection';
import { useLayoutStore } from '../../store/layout';
import { useToastStore } from '../../store/toast';
import { useUIStore } from '../../store/ui';
import type { CollectionLayoutRef } from '../../types';

// Mock the collection API
vi.mock('../../api/collection', () => ({
  addLayout: vi.fn(),
  deleteLayout: vi.fn(),
}));

const mockLayouts: CollectionLayoutRef[] = [
  {
    id: 'layout-1',
    name: 'Test Layout 1',
    modifiedAt: Date.now(),
    preview: { drawerWidth: 10, drawerDepth: 8, binCount: 5, layerCount: 1 },
  },
  {
    id: 'layout-2',
    name: 'Test Layout 2',
    modifiedAt: Date.now() - 86400000, // 1 day ago
    preview: { drawerWidth: 8, drawerDepth: 6, binCount: 3, layerCount: 2 },
  },
];

describe('CollectionLayoutList', () => {
  const mockOnSwitch = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores
    useCollectionStore.setState({
      activeCollection: {
        id: 'collection-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        layoutCount: 2,
      },
      activeCollectionLayouts: mockLayouts,
      loadingState: 'idle',
    });

    useLayoutStore.setState({
      activeLayoutId: 'layout-1',
      layout: {
        version: '1.0',
        name: 'Test Layout',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: 'cat1', name: 'Default', color: '#3b82f6' }],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [],
      },
    });

    useToastStore.setState({ toasts: [] });
    useUIStore.setState({ liveMessage: null });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders layout list with correct count', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      expect(screen.getByText('Test Layout 1')).toBeInTheDocument();
      expect(screen.getByText('Test Layout 2')).toBeInTheDocument();
      expect(screen.getByText('2 layouts in collection')).toBeInTheDocument();
    });

    it('shows active badge for current layout', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows empty state when no layouts', () => {
      useCollectionStore.setState({ activeCollectionLayouts: [] });

      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      expect(screen.getByText('No layouts in collection')).toBeInTheDocument();
    });

    it('shows singular "layout" when count is 1', () => {
      useCollectionStore.setState({
        activeCollectionLayouts: [mockLayouts[0]],
      });

      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      expect(screen.getByText('1 layout in collection')).toBeInTheDocument();
    });

    it('displays layout preview info', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      // Preview shows dimensions and bin count
      expect(screen.getByText('10×8')).toBeInTheDocument();
      expect(screen.getByText('5 bins')).toBeInTheDocument();
    });
  });

  describe('layout switching', () => {
    it('calls onSwitch when clicking a non-active layout', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      // Click on layout-2 (not active)
      const layout2 = screen.getByText('Test Layout 2').closest('[role="option"]');
      fireEvent.click(layout2!);

      expect(mockOnSwitch).toHaveBeenCalledWith('layout-2');
    });

    it('does not call onSwitch when clicking active layout', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      // Click on layout-1 (active)
      const layout1 = screen.getByText('Test Layout 1').closest('[role="option"]');
      fireEvent.click(layout1!);

      expect(mockOnSwitch).not.toHaveBeenCalled();
    });
  });

  describe('add layout', () => {
    it('shows add layout button', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      expect(screen.getByText('Add Current Layout')).toBeInTheDocument();
    });

    it('calls addLayoutToCollection when clicking add button', async () => {
      const mockAddLayout = vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'new-layout', name: 'New Layout', modifiedAt: Date.now(), preview: {} },
      });
      useCollectionStore.setState({ addLayoutToCollection: mockAddLayout });

      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Current Layout'));
      });

      expect(mockAddLayout).toHaveBeenCalled();
    });

    it('shows loading state when adding', async () => {
      // Mock a slow add operation
      const mockAddLayout = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: {} }), 100))
      );
      useCollectionStore.setState({ addLayoutToCollection: mockAddLayout });

      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Current Layout'));
      });

      expect(screen.getByText('Adding...')).toBeInTheDocument();
    });
  });

  describe('delete layout', () => {
    it('shows delete button on hover (visible in DOM)', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      // Delete button exists but may be opacity-0 until hover
      const deleteButtons = screen.getAllByLabelText(/Remove .* from collection/);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('shows confirmation dialog when clicking delete', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      const deleteButton = screen.getByLabelText('Remove Test Layout 2 from collection');
      fireEvent.click(deleteButton);

      expect(screen.getByText('Remove from collection?')).toBeInTheDocument();
    });

    it('closes confirmation dialog when clicking cancel', async () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      const deleteButton = screen.getByLabelText('Remove Test Layout 2 from collection');
      fireEvent.click(deleteButton);

      expect(screen.getByText('Remove from collection?')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Remove from collection?')).not.toBeInTheDocument();
      });
    });

    it('disables delete button when only one layout', () => {
      useCollectionStore.setState({
        activeCollectionLayouts: [mockLayouts[0]],
      });

      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      const deleteButton = screen.getByLabelText('Remove Test Layout 1 from collection');
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('has listbox role for layout list', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('has option role for each layout item', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
    });

    it('marks active layout as selected', () => {
      render(<CollectionLayoutList onSwitch={mockOnSwitch} onClose={mockOnClose} />);

      const options = screen.getAllByRole('option');
      const activeOption = options.find((opt) => opt.getAttribute('aria-selected') === 'true');
      expect(activeOption).toContainElement(screen.getByText('Test Layout 1'));
    });
  });
});
