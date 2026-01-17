import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BinListTable } from '../../components/modals/BinListModal/BinListTable';
import type { EnhancedPrintRow, Category, PrintListSortKey, PrintListSortOrder } from '../../types';

// Mock SplitPreview
vi.mock('../../components/Print', () => ({
  SplitPreview: ({ width, depth, pieces }: { width: number; depth: number; pieces: unknown[] }) => (
    <div data-testid="split-preview" data-width={width} data-depth={depth}>
      {pieces.length} pieces
    </div>
  ),
}));

describe('BinListTable', () => {
  const mockCategories: Category[] = [
    { id: 'coral', name: 'Coral', color: '#FF6B6B' },
    { id: 'blue', name: 'Blue', color: '#4ECDC4' },
    { id: 'green', name: 'Green', color: '#95D5B2' },
  ];

  const mockRows: EnhancedPrintRow[] = [
    {
      size: '2×2',
      height: 3,
      binCount: 5,
      totalPieces: 5,
      filament: 12.5,
      needsSplit: false,
      pieces: [],
      labels: ['Screws'],
      notes: 'Small hardware',
      binIds: ['bin1', 'bin2', 'bin3', 'bin4', 'bin5'],
      categoryIds: ['coral'],
      area: 4,
    },
    {
      size: '4×4',
      height: 6,
      binCount: 2,
      totalPieces: 8,
      filament: 25.0,
      needsSplit: true,
      pieces: [
        { width: 2, depth: 2, count: 4 },
      ],
      labels: ['Tools'],
      notes: 'Large items',
      binIds: ['bin6', 'bin7'],
      categoryIds: ['blue', 'green'],
      area: 16,
    },
    {
      size: '3×3',
      height: 3,
      binCount: 3,
      totalPieces: 3,
      filament: 15.0,
      needsSplit: false,
      pieces: [],
      labels: [],
      notes: '',
      binIds: ['bin8', 'bin9', 'bin10'],
      categoryIds: ['coral', 'blue', 'green', 'coral'],
      area: 9,
    },
  ];

  const mockOnToggleSelection = vi.fn();
  const mockOnSelectAll = vi.fn();
  const mockOnSort = vi.fn();
  const mockOnRowClick = vi.fn();
  const mockOnEditLabel = vi.fn();
  const mockOnEditNotes = vi.fn();

  const defaultProps = {
    rows: mockRows,
    categories: mockCategories,
    selectedIndices: new Set<number>(),
    onToggleSelection: mockOnToggleSelection,
    onSelectAll: mockOnSelectAll,
    isAllSelected: false,
    sortKey: 'area' as PrintListSortKey,
    sortOrder: 'desc' as PrintListSortOrder,
    onSort: mockOnSort,
    onRowClick: mockOnRowClick,
    hasAnySplits: true,
    onEditLabel: mockOnEditLabel,
    onEditNotes: mockOnEditNotes,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders table with headers', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('H')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Qty')).toBeInTheDocument();
    });

    it('renders Pcs column when hasAnySplits is true', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByText('Pcs')).toBeInTheDocument();
    });

    it('does not render Pcs column when hasAnySplits is false', () => {
      render(<BinListTable {...defaultProps} hasAnySplits={false} />);

      expect(screen.queryByText('Pcs')).not.toBeInTheDocument();
    });

    it('renders select all checkbox', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByLabelText('Select all rows')).toBeInTheDocument();
    });

    it('renders rows with data', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByText('2×2')).toBeInTheDocument();
      expect(screen.getByText('4×4')).toBeInTheDocument();
      expect(screen.getByText('3×3')).toBeInTheDocument();
    });

    it('renders labels', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByText('Screws')).toBeInTheDocument();
      expect(screen.getByText('Tools')).toBeInTheDocument();
    });

    it('renders notes', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByText('Small hardware')).toBeInTheDocument();
      expect(screen.getByText('Large items')).toBeInTheDocument();
    });

    it('renders height values', () => {
      render(<BinListTable {...defaultProps} />);

      // Height values with 'u' suffix - rows 1 and 3 have 3u
      const heightCells = screen.getAllByText('3u');
      expect(heightCells.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('6u')).toBeInTheDocument();
    });

    it('renders quantity values', () => {
      render(<BinListTable {...defaultProps} />);

      // Quantities may appear multiple times (Qty and Pcs columns)
      expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    });

    it('renders filament values', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByText('12.5')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty state when rows is empty', () => {
      render(<BinListTable {...defaultProps} rows={[]} />);

      expect(screen.getByText('No bins match your filters')).toBeInTheDocument();
    });

    it('does not render table when rows is empty', () => {
      render(<BinListTable {...defaultProps} rows={[]} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('row checkbox reflects selection state', () => {
      const selectedIndices = new Set([0]);
      render(<BinListTable {...defaultProps} selectedIndices={selectedIndices} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is select-all, next are row checkboxes
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
    });

    it('calls onToggleSelection when row checkbox clicked', () => {
      render(<BinListTable {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // First row checkbox

      expect(mockOnToggleSelection).toHaveBeenCalledWith(0, false);
    });

    it('passes shiftKey to onToggleSelection', () => {
      render(<BinListTable {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1], { shiftKey: true });

      expect(mockOnToggleSelection).toHaveBeenCalledWith(0, true);
    });

    it('calls onSelectAll when select-all checkbox changed', () => {
      render(<BinListTable {...defaultProps} />);

      const selectAllCheckbox = screen.getByLabelText('Select all rows');
      fireEvent.click(selectAllCheckbox);

      expect(mockOnSelectAll).toHaveBeenCalledOnce();
    });

    it('select-all checkbox is checked when isAllSelected is true', () => {
      render(<BinListTable {...defaultProps} isAllSelected={true} />);

      expect(screen.getByLabelText('Select all rows')).toBeChecked();
    });

    it('selected rows have selection background', () => {
      const selectedIndices = new Set([0]);
      const { container } = render(<BinListTable {...defaultProps} selectedIndices={selectedIndices} />);

      const rows = container.querySelectorAll('tbody tr');
      expect(rows[0].className).toContain('bg-selection-bg');
    });
  });

  describe('sorting', () => {
    it('calls onSort when sortable header clicked', () => {
      render(<BinListTable {...defaultProps} />);

      fireEvent.click(screen.getByText('Size'));

      expect(mockOnSort).toHaveBeenCalledWith('area');
    });

    it('calls onSort with height when H header clicked', () => {
      render(<BinListTable {...defaultProps} />);

      fireEvent.click(screen.getByText('H'));

      expect(mockOnSort).toHaveBeenCalledWith('height');
    });

    it('calls onSort with filament when ~m header clicked', () => {
      render(<BinListTable {...defaultProps} />);

      fireEvent.click(screen.getByText('~m'));

      expect(mockOnSort).toHaveBeenCalledWith('filament');
    });

    it('shows sort indicator on active column', () => {
      render(<BinListTable {...defaultProps} sortKey="area" sortOrder="desc" />);

      // The Size header should have the sort icon
      const sizeHeader = screen.getByText('Size').closest('th');
      expect(sizeHeader?.querySelector('svg')).toBeInTheDocument();
    });

    it('has correct aria-sort attribute', () => {
      render(<BinListTable {...defaultProps} sortKey="area" sortOrder="asc" />);

      const sizeHeader = screen.getByText('Size').closest('th');
      expect(sizeHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('has aria-sort descending when sortOrder is desc', () => {
      render(<BinListTable {...defaultProps} sortKey="area" sortOrder="desc" />);

      const sizeHeader = screen.getByText('Size').closest('th');
      expect(sizeHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('non-active columns have aria-sort none', () => {
      render(<BinListTable {...defaultProps} sortKey="area" />);

      const heightHeader = screen.getByText('H').closest('th');
      expect(heightHeader).toHaveAttribute('aria-sort', 'none');
    });
  });

  describe('row click', () => {
    it('calls onRowClick when row clicked', () => {
      render(<BinListTable {...defaultProps} />);

      const row = screen.getByText('2×2').closest('tr');
      fireEvent.click(row!);

      expect(mockOnRowClick).toHaveBeenCalledWith(mockRows[0]);
    });

    it('does not call onRowClick when checkbox clicked', () => {
      render(<BinListTable {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      // onToggleSelection should be called, not onRowClick
      expect(mockOnToggleSelection).toHaveBeenCalled();
    });
  });

  describe('split preview expansion', () => {
    it('expands split preview when row with needsSplit clicked', () => {
      render(<BinListTable {...defaultProps} />);

      // Click the row with needsSplit=true (4×4)
      const row = screen.getByText('4×4').closest('tr');
      fireEvent.click(row!);

      expect(screen.getByTestId('split-preview')).toBeInTheDocument();
    });

    it('collapses split preview when expanded row clicked again', () => {
      render(<BinListTable {...defaultProps} />);

      const row = screen.getByText('4×4').closest('tr');

      // Expand
      fireEvent.click(row!);
      expect(screen.getByTestId('split-preview')).toBeInTheDocument();

      // Collapse
      fireEvent.click(row!);
      expect(screen.queryByTestId('split-preview')).not.toBeInTheDocument();
    });

    it('shows split icon for rows needing split', () => {
      render(<BinListTable {...defaultProps} />);

      // The 4×4 row should have a split icon
      const row4x4 = screen.getByText('4×4').closest('tr');
      expect(row4x4?.querySelector('svg')).toBeInTheDocument();
    });

    it('does not expand for rows without needsSplit', () => {
      render(<BinListTable {...defaultProps} />);

      // Click row without needsSplit
      const row = screen.getByText('2×2').closest('tr');
      fireEvent.click(row!);

      expect(screen.queryByTestId('split-preview')).not.toBeInTheDocument();
    });
  });

  describe('inline editing', () => {
    it('enters edit mode on double-click label', () => {
      render(<BinListTable {...defaultProps} />);

      // Double-click on label cell
      const labelCell = screen.getByText('Screws');
      fireEvent.doubleClick(labelCell);

      expect(screen.getByDisplayValue('Screws')).toBeInTheDocument();
    });

    it('enters edit mode on double-click notes', () => {
      render(<BinListTable {...defaultProps} />);

      const notesCell = screen.getByText('Small hardware');
      fireEvent.doubleClick(notesCell);

      expect(screen.getByDisplayValue('Small hardware')).toBeInTheDocument();
    });

    it('calls onEditLabel when label edit saved', () => {
      render(<BinListTable {...defaultProps} />);

      // Enter edit mode
      const labelCell = screen.getByText('Screws');
      fireEvent.doubleClick(labelCell);

      // Change value
      const input = screen.getByDisplayValue('Screws');
      fireEvent.change(input, { target: { value: 'New Label' } });

      // Save by blur
      fireEvent.blur(input);

      expect(mockOnEditLabel).toHaveBeenCalledWith(['bin1', 'bin2', 'bin3', 'bin4', 'bin5'], 'New Label');
    });

    it('calls onEditNotes when notes edit saved', () => {
      render(<BinListTable {...defaultProps} />);

      // Enter edit mode
      const notesCell = screen.getByText('Small hardware');
      fireEvent.doubleClick(notesCell);

      // Change value
      const input = screen.getByDisplayValue('Small hardware');
      fireEvent.change(input, { target: { value: 'New Notes' } });

      // Save by blur
      fireEvent.blur(input);

      expect(mockOnEditNotes).toHaveBeenCalledWith(['bin1', 'bin2', 'bin3', 'bin4', 'bin5'], 'New Notes');
    });

    it('saves on Enter key', () => {
      render(<BinListTable {...defaultProps} />);

      const labelCell = screen.getByText('Screws');
      fireEvent.doubleClick(labelCell);

      const input = screen.getByDisplayValue('Screws');
      fireEvent.change(input, { target: { value: 'New Label' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnEditLabel).toHaveBeenCalled();
    });

    it('cancels on Escape key', () => {
      render(<BinListTable {...defaultProps} />);

      const labelCell = screen.getByText('Screws');
      fireEvent.doubleClick(labelCell);

      const input = screen.getByDisplayValue('Screws');
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should exit edit mode without saving
      expect(mockOnEditLabel).not.toHaveBeenCalled();
      expect(screen.queryByDisplayValue('Changed')).not.toBeInTheDocument();
    });

    it('does not enter edit mode when edit handlers not provided', () => {
      render(<BinListTable {...defaultProps} onEditLabel={undefined} onEditNotes={undefined} />);

      const labelCell = screen.getByText('Screws');
      fireEvent.doubleClick(labelCell);

      // Should not show input
      expect(screen.queryByDisplayValue('Screws')).not.toBeInTheDocument();
    });
  });

  describe('category color dots', () => {
    it('shows category color dots', () => {
      const { container } = render(<BinListTable {...defaultProps} />);

      const colorDots = container.querySelectorAll('[style*="background-color"]');
      expect(colorDots.length).toBeGreaterThan(0);
    });

    it('shows +N indicator for more than 3 categories', () => {
      render(<BinListTable {...defaultProps} />);

      // Row 3 has 4 categories, should show +1
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  describe('empty label/notes display', () => {
    it('shows dash for empty label', () => {
      render(<BinListTable {...defaultProps} />);

      // Row 3 has empty labels
      const emDashes = screen.getAllByText('—');
      expect(emDashes.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('has correct table structure', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('row checkboxes have aria-label', () => {
      render(<BinListTable {...defaultProps} />);

      expect(screen.getByLabelText('Select 2×2 bin')).toBeInTheDocument();
      expect(screen.getByLabelText('Select 4×4 bin')).toBeInTheDocument();
    });

    it('sortable headers have title attributes', () => {
      render(<BinListTable {...defaultProps} />);

      const sizeHeader = screen.getByText('Size').closest('th');
      expect(sizeHeader).toHaveAttribute('title', 'Sort by size (area)');
    });

    it('sortable headers have columnheader role', () => {
      render(<BinListTable {...defaultProps} />);

      const sizeHeader = screen.getByText('Size').closest('th');
      expect(sizeHeader).toHaveAttribute('role', 'columnheader');
    });
  });
});
