import type { ReactNode } from 'react';

export interface SortOption {
  value: string;
  label: string;
}

export interface ItemListShellProps<T> {
  /** Array of items to display */
  items: T[];

  /** Current search query */
  searchQuery: string;
  /** Called when search query changes */
  onSearchChange: (query: string) => void;
  /** Filter function for search */
  searchFilter: (item: T, query: string) => boolean;
  /** Minimum items to show search (default: 6) */
  searchThreshold?: number;
  /** Placeholder text for search input */
  searchPlaceholder: string;
  /** Aria label for search input */
  searchAriaLabel: string;
  /** Aria label for clear search button */
  clearSearchAriaLabel: string;

  /** Available sort options */
  sortOptions: SortOption[];
  /** Current sort value */
  sortValue: string;
  /** Called when sort changes */
  onSortChange: (value: string) => void;
  /** Aria label for sort dropdown */
  sortAriaLabel: string;

  /** Current view mode */
  viewMode: 'grid' | 'list';
  /** Called when view mode changes */
  onViewModeChange: (mode: 'grid' | 'list') => void;
  /** Whether to show view toggle (default: true, typically false on mobile) */
  showViewToggle?: boolean;
  /** Labels for view mode toggle */
  viewModeLabels: {
    ariaLabel: string;
    listLabel: string;
    gridLabel: string;
  };

  /** Render grid view items */
  renderGrid: (items: T[]) => ReactNode;
  /** Render list view items */
  renderList: (items: T[]) => ReactNode;

  /** Content shown when no items exist */
  emptyState?: ReactNode;
  /** Content shown when search has no results */
  noResultsState?: ReactNode;

  /** Footer content (e.g., item count) */
  footer?: ReactNode;

  /** Additional header content (e.g., create button) */
  headerContent?: ReactNode;

  /** ID getter for items (for aria-activedescendant) */
  getItemId?: (item: T) => string;

  /** Callback when keyboard navigation happens */
  onKeyboardNav?: (e: React.KeyboardEvent) => void;
}
