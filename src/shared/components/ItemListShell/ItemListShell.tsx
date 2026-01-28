import { useMemo, useRef } from 'react';
import { ViewModeToggle } from '../ViewModeToggle';
import { ItemSearch } from './ItemSearch';
import { SortDropdown } from './SortDropdown';
import type { ItemListShellProps } from './types';

/** Default threshold for showing search bar */
const DEFAULT_SEARCH_THRESHOLD = 6;

/**
 * A generic container component for item lists with search, sort, and view mode controls.
 *
 * This shell provides:
 * - Search input (appears when items >= threshold)
 * - Sort dropdown
 * - Grid/List view toggle
 * - Empty and no-results states
 * - Footer area
 *
 * The actual rendering of items is delegated to the consumer via render props
 * (renderGrid and renderList), allowing full customization of item display.
 *
 * @example
 * ```tsx
 * <ItemListShell
 *   items={layouts}
 *   searchQuery={query}
 *   onSearchChange={setQuery}
 *   searchFilter={(layout, q) => layout.name.includes(q)}
 *   sortOptions={[{ value: 'recent', label: 'Recent' }]}
 *   sortValue={sortBy}
 *   onSortChange={setSortBy}
 *   viewMode={viewMode}
 *   onViewModeChange={setViewMode}
 *   renderGrid={(items) => <LayoutGrid items={items} />}
 *   renderList={(items) => <LayoutList items={items} />}
 * />
 * ```
 */
export function ItemListShell<T>({
  items,
  searchQuery,
  onSearchChange,
  searchFilter,
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
  searchPlaceholder,
  searchAriaLabel,
  clearSearchAriaLabel,
  sortOptions,
  sortValue,
  onSortChange,
  sortAriaLabel,
  viewMode,
  onViewModeChange,
  showViewToggle = true,
  viewModeLabels,
  renderGrid,
  renderList,
  emptyState,
  noResultsState,
  footer,
  headerContent,
  onKeyboardNav,
}: ItemListShellProps<T>) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => searchFilter(item, query));
  }, [items, searchQuery, searchFilter]);

  const showSearch = items.length >= searchThreshold;
  const hasNoResults = filteredItems.length === 0 && searchQuery.trim() !== '';
  const isEmpty = items.length === 0;

  // Handle search change - this resets focus in the parent
  const handleSearchChange = (value: string) => {
    onSearchChange(value);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Optional Header Content (e.g., Create Button) */}
      {headerContent && <div className="pb-3">{headerContent}</div>}

      {/* Search (appears with threshold+ items) */}
      {showSearch && (
        <div className="pb-3">
          <ItemSearch
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            ariaLabel={searchAriaLabel}
            clearAriaLabel={clearSearchAriaLabel}
            inputRef={searchRef}
          />
        </div>
      )}

      {/* Content Area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]"
        onKeyDown={onKeyboardNav}
      >
        {/* Empty State (no items at all) */}
        {isEmpty && !searchQuery && emptyState}

        {/* No Results State (search has no matches) */}
        {hasNoResults && noResultsState}

        {/* Items (either grid or list view) */}
        {!isEmpty && !hasNoResults && (
          <>{viewMode === 'grid' ? renderGrid(filteredItems) : renderList(filteredItems)}</>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 mt-3 border-t border-stroke text-sm text-content-tertiary flex items-center justify-between">
        <span>{footer}</span>
        <div className="flex items-center gap-2">
          <SortDropdown
            options={sortOptions}
            value={sortValue}
            onChange={onSortChange}
            ariaLabel={sortAriaLabel}
          />
          {showViewToggle && (
            <ViewModeToggle
              value={viewMode}
              onChange={onViewModeChange}
              ariaLabel={viewModeLabels.ariaLabel}
              listLabel={viewModeLabels.listLabel}
              gridLabel={viewModeLabels.gridLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
