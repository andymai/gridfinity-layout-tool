import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BinListFilters } from '@/components/Modals/BinListModal/BinListFilters';
import type { Category, PrintListFilters } from '@/core/types';

describe('BinListFilters', () => {
  const mockCategories: Category[] = [
    { id: 'coral', name: 'Coral', color: '#FF6B6B' },
    { id: 'blue', name: 'Blue', color: '#4ECDC4' },
    { id: 'green', name: 'Green', color: '#95D5B2' },
  ];

  const mockOnSearchChange = vi.fn();
  const mockOnToggleCategoryVisibility = vi.fn();
  const mockOnToggleGroupByCategory = vi.fn();
  const mockOnResetFilters = vi.fn();

  const defaultFilters: PrintListFilters = {
    hiddenCategoryIds: new Set<string>(),
    groupByCategory: false,
    sortField: 'category',
    sortDirection: 'asc',
    searchQuery: '',
  };

  const defaultProps = {
    searchQuery: '',
    onSearchChange: mockOnSearchChange,
    categories: mockCategories,
    filters: defaultFilters,
    onToggleCategoryVisibility: mockOnToggleCategoryVisibility,
    onToggleGroupByCategory: mockOnToggleGroupByCategory,
    onResetFilters: mockOnResetFilters,
    visibleCount: 10,
    totalCount: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders search input', () => {
      render(<BinListFilters {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    });

    it('renders search input with aria-label', () => {
      render(<BinListFilters {...defaultProps} />);

      expect(screen.getByLabelText('Search')).toBeInTheDocument();
    });

    it('renders category toggles', () => {
      render(<BinListFilters {...defaultProps} />);

      expect(screen.getByText('Coral')).toBeInTheDocument();
      expect(screen.getByText('Blue')).toBeInTheDocument();
      expect(screen.getByText('Green')).toBeInTheDocument();
    });

    it('renders categories label', () => {
      render(<BinListFilters {...defaultProps} />);

      expect(screen.getByText('Categories')).toBeInTheDocument();
    });

    it('renders group by category checkbox', () => {
      render(<BinListFilters {...defaultProps} />);

      expect(screen.getByLabelText('Group by category')).toBeInTheDocument();
    });

    it('shows total count when no filters active', () => {
      render(<BinListFilters {...defaultProps} />);

      expect(screen.getByText('10 bin types')).toBeInTheDocument();
    });
  });

  describe('search input', () => {
    it('displays current search query', () => {
      render(<BinListFilters {...defaultProps} searchQuery="test" />);

      expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    });

    it('calls onSearchChange when typing', () => {
      render(<BinListFilters {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search');
      fireEvent.change(input, { target: { value: 'new query' } });

      expect(mockOnSearchChange).toHaveBeenCalledWith('new query');
    });

    it('shows clear button when search query exists', () => {
      render(<BinListFilters {...defaultProps} searchQuery="test" />);

      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('does not show clear button when search query is empty', () => {
      render(<BinListFilters {...defaultProps} />);

      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      render(<BinListFilters {...defaultProps} searchQuery="test" />);

      fireEvent.click(screen.getByLabelText('Clear search'));

      expect(mockOnSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('auto-focus behavior', () => {
    it('auto-focuses search input by default after delay', () => {
      render(<BinListFilters {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search');
      expect(document.activeElement).not.toBe(input);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(document.activeElement).toBe(input);
    });

    it('does not auto-focus when autoFocus is false', () => {
      render(<BinListFilters {...defaultProps} autoFocus={false} />);

      const input = screen.getByPlaceholderText('Search');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(document.activeElement).not.toBe(input);
    });
  });

  describe('result count display', () => {
    it('shows "Showing X of Y" when filters hide some items', () => {
      render(<BinListFilters {...defaultProps} visibleCount={7} totalCount={10} />);

      // Text is rendered as one string: "Showing 7 of 10"
      expect(screen.getByText('Showing 7 of 10')).toBeInTheDocument();
    });

    it('shows total only when all items visible', () => {
      render(<BinListFilters {...defaultProps} visibleCount={10} totalCount={10} />);

      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
      expect(screen.getByText('10 bin types')).toBeInTheDocument();
    });

    it('shows zero visible when all filtered out', () => {
      render(<BinListFilters {...defaultProps} visibleCount={0} totalCount={10} />);

      expect(screen.getByText('Showing 0 of 10')).toBeInTheDocument();
    });
  });

  describe('category toggles', () => {
    it('category buttons have aria-pressed true when visible', () => {
      render(<BinListFilters {...defaultProps} />);

      const coralButton = screen.getByText('Coral').closest('button');
      expect(coralButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('category buttons have aria-pressed false when hidden', () => {
      const filtersWithHidden: PrintListFilters = {
        ...defaultFilters,
        hiddenCategoryIds: new Set(['coral']),
      };

      render(<BinListFilters {...defaultProps} filters={filtersWithHidden} />);

      const coralButton = screen.getByText('Coral').closest('button');
      expect(coralButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onToggleCategoryVisibility when category clicked', () => {
      render(<BinListFilters {...defaultProps} />);

      fireEvent.click(screen.getByText('Blue').closest('button')!);

      expect(mockOnToggleCategoryVisibility).toHaveBeenCalledWith('blue');
    });

    it('shows title for visible category', () => {
      render(<BinListFilters {...defaultProps} />);

      const coralButton = screen.getByText('Coral').closest('button');
      expect(coralButton).toHaveAttribute('title', 'Hide Coral');
    });

    it('shows title for hidden category', () => {
      const filtersWithHidden: PrintListFilters = {
        ...defaultFilters,
        hiddenCategoryIds: new Set(['coral']),
      };

      render(<BinListFilters {...defaultProps} filters={filtersWithHidden} />);

      const coralButton = screen.getByText('Coral').closest('button');
      expect(coralButton).toHaveAttribute('title', 'Show Coral');
    });

    it('hidden categories have reduced opacity', () => {
      const filtersWithHidden: PrintListFilters = {
        ...defaultFilters,
        hiddenCategoryIds: new Set(['coral']),
      };

      render(<BinListFilters {...defaultProps} filters={filtersWithHidden} />);

      const coralButton = screen.getByText('Coral').closest('button');
      expect(coralButton?.className).toContain('opacity-50');
    });

    it('shows color dots for categories', () => {
      const { container } = render(<BinListFilters {...defaultProps} />);

      const colorDots = container.querySelectorAll('[style*="background-color"]');
      expect(colorDots.length).toBe(3);
    });
  });

  describe('group by category toggle', () => {
    it('checkbox is unchecked when groupByCategory is false', () => {
      render(<BinListFilters {...defaultProps} />);

      const checkbox = screen.getByLabelText('Group by category');
      expect(checkbox).not.toBeChecked();
    });

    it('checkbox is checked when groupByCategory is true', () => {
      const filtersWithGrouping: PrintListFilters = {
        ...defaultFilters,
        groupByCategory: true,
      };

      render(<BinListFilters {...defaultProps} filters={filtersWithGrouping} />);

      const checkbox = screen.getByLabelText('Group by category');
      expect(checkbox).toBeChecked();
    });

    it('calls onToggleGroupByCategory when checkbox clicked', () => {
      render(<BinListFilters {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Group by category'));

      expect(mockOnToggleGroupByCategory).toHaveBeenCalledOnce();
    });
  });

  describe('reset filters button', () => {
    it('does not show reset button when no filters active', () => {
      render(<BinListFilters {...defaultProps} />);

      expect(screen.queryByText('Reset filters')).not.toBeInTheDocument();
    });

    it('shows reset button when search query active', () => {
      render(<BinListFilters {...defaultProps} searchQuery="test" />);

      expect(screen.getByText('Reset filters')).toBeInTheDocument();
    });

    it('shows reset button when categories hidden', () => {
      const filtersWithHidden: PrintListFilters = {
        ...defaultFilters,
        hiddenCategoryIds: new Set(['coral']),
      };

      render(<BinListFilters {...defaultProps} filters={filtersWithHidden} />);

      expect(screen.getByText('Reset filters')).toBeInTheDocument();
    });

    it('shows reset button when groupByCategory enabled', () => {
      const filtersWithGrouping: PrintListFilters = {
        ...defaultFilters,
        groupByCategory: true,
      };

      render(<BinListFilters {...defaultProps} filters={filtersWithGrouping} />);

      expect(screen.getByText('Reset filters')).toBeInTheDocument();
    });

    it('calls onResetFilters when reset button clicked', () => {
      render(<BinListFilters {...defaultProps} searchQuery="test" />);

      fireEvent.click(screen.getByText('Reset filters'));

      expect(mockOnResetFilters).toHaveBeenCalledOnce();
    });
  });

  describe('multiple categories hidden', () => {
    it('shows eye-off icons for hidden categories', () => {
      const filtersWithHidden: PrintListFilters = {
        ...defaultFilters,
        hiddenCategoryIds: new Set(['coral', 'blue']),
      };

      render(<BinListFilters {...defaultProps} filters={filtersWithHidden} />);

      // Hidden categories show an eye-off icon SVG
      const coralButton = screen.getByText('Coral').closest('button');
      const blueButton = screen.getByText('Blue').closest('button');
      const greenButton = screen.getByText('Green').closest('button');

      // Hidden categories have SVG icon
      expect(coralButton?.querySelectorAll('svg').length).toBeGreaterThan(0);
      expect(blueButton?.querySelectorAll('svg').length).toBeGreaterThan(0);
      // Visible category - no extra icon inside button (only the color dot span)
      // The green button should not have opacity-50
      expect(greenButton?.className).not.toContain('opacity-50');
    });
  });

  describe('edge cases', () => {
    it('handles empty categories array', () => {
      render(<BinListFilters {...defaultProps} categories={[]} />);

      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
    });

    it('handles single category', () => {
      const singleCategory = [{ id: 'coral', name: 'Coral', color: '#FF6B6B' }];

      render(<BinListFilters {...defaultProps} categories={singleCategory} />);

      expect(screen.getByText('Coral')).toBeInTheDocument();
      expect(screen.queryByText('Blue')).not.toBeInTheDocument();
    });

    it('handles zero total count', () => {
      render(<BinListFilters {...defaultProps} visibleCount={0} totalCount={0} />);

      expect(screen.getByText('0 bin types')).toBeInTheDocument();
    });
  });
});
