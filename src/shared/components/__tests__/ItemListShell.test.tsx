import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemListShell } from '../ItemListShell';
import type { SortOption } from '../ItemListShell/types';

interface TestItem {
  id: string;
  name: string;
}

const mockItems: TestItem[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Charlie' },
];

const sortOptions: SortOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'recent', label: 'Recent' },
];

const defaultProps = {
  items: mockItems,
  searchQuery: '',
  onSearchChange: vi.fn(),
  searchFilter: (item: TestItem, query: string) => item.name.toLowerCase().includes(query),
  searchThreshold: 3,
  searchPlaceholder: 'Search items...',
  searchAriaLabel: 'Search',
  clearSearchAriaLabel: 'Clear search',
  sortOptions,
  sortValue: 'name',
  onSortChange: vi.fn(),
  sortAriaLabel: 'Sort by',
  viewMode: 'list' as const,
  onViewModeChange: vi.fn(),
  viewModeLabels: {
    ariaLabel: 'View mode',
    listLabel: 'List view',
    gridLabel: 'Grid view',
  },
  renderGrid: (items: TestItem[]) => (
    <div data-testid="grid-view">{items.map((i) => <div key={i.id}>{i.name}</div>)}</div>
  ),
  renderList: (items: TestItem[]) => (
    <div data-testid="list-view">{items.map((i) => <div key={i.id}>{i.name}</div>)}</div>
  ),
};

describe('ItemListShell', () => {
  it('renders sort dropdown', () => {
    render(<ItemListShell {...defaultProps} />);

    const sortDropdown = screen.getByRole('combobox', { name: 'Sort by' });
    expect(sortDropdown).toBeInTheDocument();
    expect(sortDropdown).toHaveValue('name');
  });

  it('calls onSortChange when sort dropdown changes', () => {
    const onSortChange = vi.fn();
    render(<ItemListShell {...defaultProps} onSortChange={onSortChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'recent' },
    });

    expect(onSortChange).toHaveBeenCalledWith('recent');
  });

  it('renders view mode toggle', () => {
    render(<ItemListShell {...defaultProps} />);

    expect(screen.getByRole('radiogroup', { name: 'View mode' })).toBeInTheDocument();
  });

  it('hides view mode toggle when showViewToggle is false', () => {
    render(<ItemListShell {...defaultProps} showViewToggle={false} />);

    expect(screen.queryByRole('radiogroup', { name: 'View mode' })).not.toBeInTheDocument();
  });

  it('renders search input when items meet threshold', () => {
    render(<ItemListShell {...defaultProps} searchThreshold={3} />);

    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('hides search input when items below threshold', () => {
    render(
      <ItemListShell
        {...defaultProps}
        items={mockItems.slice(0, 2)}
        searchThreshold={3}
      />
    );

    expect(screen.queryByRole('textbox', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('calls onSearchChange when search input changes', () => {
    const onSearchChange = vi.fn();
    render(<ItemListShell {...defaultProps} onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'test' },
    });

    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('shows clear button when search has value', () => {
    render(<ItemListShell {...defaultProps} searchQuery="test" />);

    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('clears search when clear button clicked', () => {
    const onSearchChange = vi.fn();
    render(<ItemListShell {...defaultProps} searchQuery="test" onSearchChange={onSearchChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('renders list view when viewMode is list', () => {
    render(<ItemListShell {...defaultProps} viewMode="list" />);

    expect(screen.getByTestId('list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('grid-view')).not.toBeInTheDocument();
  });

  it('renders grid view when viewMode is grid', () => {
    render(<ItemListShell {...defaultProps} viewMode="grid" />);

    expect(screen.getByTestId('grid-view')).toBeInTheDocument();
    expect(screen.queryByTestId('list-view')).not.toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    render(
      <ItemListShell
        {...defaultProps}
        items={[]}
        emptyState={<div data-testid="empty-state">No items</div>}
      />
    );

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders no results state when search has no matches', () => {
    render(
      <ItemListShell
        {...defaultProps}
        searchQuery="xyz"
        noResultsState={<div data-testid="no-results">No results found</div>}
      />
    );

    expect(screen.getByTestId('no-results')).toBeInTheDocument();
  });

  it('filters items based on search query', () => {
    render(<ItemListShell {...defaultProps} searchQuery="alpha" />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(<ItemListShell {...defaultProps} footer="3 items" />);

    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('renders header content when provided', () => {
    render(
      <ItemListShell
        {...defaultProps}
        headerContent={<button>Create new</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Create new' })).toBeInTheDocument();
  });

  it('calls onKeyboardNav when keyboard event occurs', () => {
    const onKeyboardNav = vi.fn();
    render(<ItemListShell {...defaultProps} onKeyboardNav={onKeyboardNav} />);

    // The keyboard handler is on the content area
    const listView = screen.getByTestId('list-view').parentElement;
    if (listView) {
      fireEvent.keyDown(listView, { key: 'ArrowDown' });
      expect(onKeyboardNav).toHaveBeenCalled();
    }
  });
});
