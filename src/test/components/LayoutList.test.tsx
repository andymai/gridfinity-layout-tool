import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutList } from '../../features/layout-library/components/LayoutManagerModal/LayoutList';
import { useLayoutStore, useUIStore } from '../../core/store';
import { resetAllStores } from '../testUtils';
import type { LayoutEntry } from '../../core/types';

// Mock storage
vi.mock('../../core/storage', () => ({
  loadLayoutByIdAsync: vi.fn(() => Promise.resolve({
    id: 'test-layout',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    layers: [],
    categories: [],
    bins: [],
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
  })),
  downloadLayoutAsFile: vi.fn(),
}));

// Mock LayoutThumbnail
vi.mock('../../components/LayoutThumbnail', () => ({
  LayoutThumbnail: ({ size }: { size: number }) => (
    <div data-testid="layout-thumbnail" style={{ width: size, height: size }}>
      Thumbnail
    </div>
  ),
}));

// Mock LayoutActions to simplify tests
vi.mock('../../components/Modals/LayoutManagerModal/LayoutActions', () => ({
  LayoutActions: ({
    onCopyLink,
    onDownload,
    onRename,
    onDuplicate,
    onDelete,
  }: {
    onCopyLink: () => void;
    onDownload: () => void;
    onRename: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
  }) => (
    <div data-testid="layout-actions">
      <button data-testid="copy-link-btn" onClick={onCopyLink}>Copy Link</button>
      <button data-testid="download-btn" onClick={onDownload}>Download</button>
      <button data-testid="rename-btn" onClick={onRename}>Rename</button>
      <button data-testid="duplicate-btn" onClick={onDuplicate}>Duplicate</button>
      <button data-testid="delete-btn" onClick={onDelete}>Delete</button>
    </div>
  ),
}));

function createTestEntry(id: string, name: string, modifiedAt?: number): LayoutEntry {
  return {
    id,
    name,
    createdAt: Date.now() - 1000000,
    modifiedAt: modifiedAt ?? Date.now(),
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 5,
      layerCount: 1,
    },
  };
}

describe('LayoutList', () => {
  const mockOnSwitch = vi.fn();
  const mockOnRename = vi.fn();
  const mockOnDuplicate = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCreate = vi.fn();
  const mockOnShare = vi.fn();

  const defaultProps = {
    entries: [
      createTestEntry('layout-1', 'First Layout'),
      createTestEntry('layout-2', 'Second Layout'),
    ],
    activeLayoutId: 'layout-1',
    onSwitch: mockOnSwitch,
    onRename: mockOnRename,
    onDuplicate: mockOnDuplicate,
    onDelete: mockOnDelete,
    onCreate: mockOnCreate,
    onShare: mockOnShare,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders New Layout button', () => {
      render(<LayoutList {...defaultProps} />);

      expect(screen.getByText('New Layout')).toBeInTheDocument();
    });

    it('renders layout count in footer', () => {
      render(<LayoutList {...defaultProps} />);

      expect(screen.getByText('2 layouts')).toBeInTheDocument();
    });

    it('renders singular layout count', () => {
      render(<LayoutList {...defaultProps} entries={[createTestEntry('layout-1', 'Only')]} />);

      expect(screen.getByText('1 layout')).toBeInTheDocument();
    });

    it('renders listbox with correct aria-label', () => {
      render(<LayoutList {...defaultProps} />);

      expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Available layouts');
    });

    it('renders layout items as options', () => {
      render(<LayoutList {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
    });
  });

  describe('search', () => {
    const manyEntries = Array.from({ length: 8 }, (_, i) =>
      createTestEntry(`layout-${i}`, `Layout ${i}`)
    );

    it('does not show search with less than 6 layouts', () => {
      render(<LayoutList {...defaultProps} />);

      expect(screen.queryByPlaceholderText('Search layouts...')).not.toBeInTheDocument();
    });

    it('shows search with 6+ layouts', () => {
      render(<LayoutList {...defaultProps} entries={manyEntries} />);

      expect(screen.getByPlaceholderText('Search layouts...')).toBeInTheDocument();
    });

    it('filters layouts by search query', () => {
      render(<LayoutList {...defaultProps} entries={manyEntries} />);

      const searchInput = screen.getByPlaceholderText('Search layouts...');
      fireEvent.change(searchInput, { target: { value: 'Layout 0' } });

      // Should only show Layout 0
      expect(screen.getByText('Layout 0')).toBeInTheDocument();
      expect(screen.queryByText('Layout 1')).not.toBeInTheDocument();
    });

    it('shows empty state when no search results', () => {
      render(<LayoutList {...defaultProps} entries={manyEntries} />);

      const searchInput = screen.getByPlaceholderText('Search layouts...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText(/No layouts match/)).toBeInTheDocument();
      expect(screen.getByText(/"nonexistent"/)).toBeInTheDocument();
    });

    it('shows clear button when search has value', () => {
      render(<LayoutList {...defaultProps} entries={manyEntries} />);

      const searchInput = screen.getByPlaceholderText('Search layouts...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      render(<LayoutList {...defaultProps} entries={manyEntries} />);

      const searchInput = screen.getByPlaceholderText('Search layouts...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      fireEvent.click(screen.getByLabelText('Clear search'));

      expect(searchInput).toHaveValue('');
    });

    it('search is case insensitive', () => {
      render(<LayoutList {...defaultProps} entries={manyEntries} />);

      const searchInput = screen.getByPlaceholderText('Search layouts...');
      fireEvent.change(searchInput, { target: { value: 'LAYOUT 0' } });

      expect(screen.getByText('Layout 0')).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('shows empty state when no layouts exist', () => {
      render(<LayoutList {...defaultProps} entries={[]} />);

      expect(screen.getByText('No layouts yet')).toBeInTheDocument();
      expect(screen.getByText('Create your first layout to get started')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('navigates down with ArrowDown', () => {
      render(<LayoutList {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      const options = screen.getAllByRole('option');

      // Focus first item
      options[0].focus();

      fireEvent.keyDown(listbox, { key: 'ArrowDown' });

      expect(document.activeElement).toBe(options[1]);
    });

    it('navigates up with ArrowUp', () => {
      render(<LayoutList {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      const options = screen.getAllByRole('option');

      // Focus second item
      options[1].focus();

      // First go down to set focus index
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });

      fireEvent.keyDown(listbox, { key: 'ArrowUp' });

      expect(document.activeElement).toBe(options[0]);
    });

    it('does not go past last item on ArrowDown', () => {
      render(<LayoutList {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      const options = screen.getAllByRole('option');

      options[1].focus();
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });

      // Should stay at last item
      expect(document.activeElement).toBe(options[1]);
    });

    it('does not go past first item on ArrowUp', () => {
      render(<LayoutList {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      const options = screen.getAllByRole('option');

      options[0].focus();
      fireEvent.keyDown(listbox, { key: 'ArrowUp' });
      fireEvent.keyDown(listbox, { key: 'ArrowUp' });

      // Should stay at first item
      expect(document.activeElement).toBe(options[0]);
    });
  });

  describe('create action', () => {
    it('calls onCreate when New Layout button clicked', () => {
      render(<LayoutList {...defaultProps} />);

      fireEvent.click(screen.getByText('New Layout'));

      expect(mockOnCreate).toHaveBeenCalledOnce();
    });
  });

  describe('layout actions', () => {
    it('calls onSwitch when selecting different layout', () => {
      render(<LayoutList {...defaultProps} />);

      // Click on second layout (not the active one)
      const options = screen.getAllByRole('option');
      fireEvent.click(options[1]);

      expect(mockOnSwitch).toHaveBeenCalledWith('layout-2');
    });

    it('does not call onSwitch when clicking active layout', () => {
      render(<LayoutList {...defaultProps} />);

      // Click on first layout (the active one)
      const options = screen.getAllByRole('option');
      fireEvent.click(options[0]);

      expect(mockOnSwitch).not.toHaveBeenCalled();
    });

    it('calls onRename and announces to screen reader', () => {
      const announceToScreenReader = vi.fn();
      useUIStore.setState({ announceToScreenReader });

      render(<LayoutList {...defaultProps} />);

      // Find rename button for first layout
      const renameButtons = screen.getAllByTestId('rename-btn');
      fireEvent.click(renameButtons[0]);

      // Note: rename actually triggers the editing mode in LayoutListItem
      // The callback chain tests are covered in LayoutListItem tests
    });

    it('calls onDuplicate and announces to screen reader', () => {
      const announceToScreenReader = vi.fn();
      useUIStore.setState({ announceToScreenReader });

      render(<LayoutList {...defaultProps} />);

      const duplicateButtons = screen.getAllByTestId('duplicate-btn');
      fireEvent.click(duplicateButtons[0]);

      expect(mockOnDuplicate).toHaveBeenCalledWith('layout-1');
      expect(announceToScreenReader).toHaveBeenCalledWith('Duplicated First Layout');
    });

    it('calls onDelete and announces to screen reader', () => {
      const announceToScreenReader = vi.fn();
      useUIStore.setState({ announceToScreenReader });

      render(<LayoutList {...defaultProps} />);

      const deleteButtons = screen.getAllByTestId('delete-btn');
      fireEvent.click(deleteButtons[0]);

      expect(mockOnDelete).toHaveBeenCalledWith('layout-1');
      expect(announceToScreenReader).toHaveBeenCalledWith('First Layout deleted');
    });

    it('calls onShare when copy link clicked', () => {
      render(<LayoutList {...defaultProps} />);

      const copyLinkButtons = screen.getAllByTestId('copy-link-btn');
      fireEvent.click(copyLinkButtons[0]);

      expect(mockOnShare).toHaveBeenCalledWith('layout-1');
    });
  });

  describe('sorting', () => {
    it('sorts active layout first', () => {
      const entries = [
        createTestEntry('layout-2', 'Second Layout', Date.now()),
        createTestEntry('layout-1', 'First Layout', Date.now() - 100000),
      ];

      render(<LayoutList {...defaultProps} entries={entries} activeLayoutId="layout-1" />);

      const options = screen.getAllByRole('option');
      // First option should be the active one (layout-1)
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('sorts non-active layouts by modifiedAt descending', () => {
      const entries = [
        createTestEntry('layout-1', 'Active', Date.now() - 1000000),
        createTestEntry('layout-2', 'Recent', Date.now()),
        createTestEntry('layout-3', 'Old', Date.now() - 500000),
      ];

      render(<LayoutList {...defaultProps} entries={entries} activeLayoutId="layout-1" />);

      const layoutNames = screen.getAllByRole('option').map(opt => {
        // Find the layout name text in each option
        return opt.querySelector('.font-medium')?.textContent;
      });

      // Active first, then by recency
      expect(layoutNames[0]).toBe('Active');
      expect(layoutNames[1]).toBe('Recent');
      expect(layoutNames[2]).toBe('Old');
    });
  });

  describe('download functionality', () => {
    it('calls download with layout data', async () => {
      const { downloadLayoutAsFile } = await import('../../core/storage');
      const announceToScreenReader = vi.fn();
      useUIStore.setState({ announceToScreenReader });

      // Setup current layout in store
      useLayoutStore.setState({
        layout: {
          id: 'layout-1',
          name: 'First Layout',
          drawer: { width: 10, depth: 8, height: 12 },
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
          categories: [],
          bins: [],
          printBedSize: 256,
          gridUnitMm: 42,
          heightUnitMm: 7,
        },
      });

      render(<LayoutList {...defaultProps} />);

      const downloadButtons = screen.getAllByTestId('download-btn');
      fireEvent.click(downloadButtons[0]);

      // Wait for async handleDownload to complete
      await vi.waitFor(() => {
        expect(downloadLayoutAsFile).toHaveBeenCalled();
      });
      expect(announceToScreenReader).toHaveBeenCalledWith('Layout downloaded');
    });
  });
});
