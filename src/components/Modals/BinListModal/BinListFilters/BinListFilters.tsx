import { useCallback, useRef, useEffect } from 'react';
import { Checkbox } from '@/shared/components/Checkbox';
import type { Category, PrintListFilters } from '@/core/types';
import { useTranslation } from '@/i18n';

interface BinListFiltersProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Available categories */
  categories: Category[];
  /** Current filter state from usePrintList */
  filters: PrintListFilters;
  /** Toggle category visibility */
  onToggleCategoryVisibility: (categoryId: string) => void;
  /** Toggle group by category */
  onToggleGroupByCategory: () => void;
  /** Reset all filters */
  onResetFilters: () => void;
  /** Total visible count after filters */
  visibleCount: number;
  /** Total count before filters */
  totalCount: number;
  /** Auto-focus search on mount */
  autoFocus?: boolean;
}

/**
 * Filter controls for the expanded bin list modal.
 * Includes search input, category toggles, and group-by toggle.
 */
export function BinListFilters({
  searchQuery,
  onSearchChange,
  categories,
  filters,
  onToggleCategoryVisibility,
  onToggleGroupByCategory,
  onResetFilters,
  visibleCount,
  totalCount,
  autoFocus = true,
}: BinListFiltersProps) {
  const t = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on mount
  // Delay ensures modal open animation/transition completes before focusing
  const FOCUS_DELAY_MS = 100;
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, FOCUS_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleClearSearch = useCallback(() => {
    onSearchChange('');
    searchInputRef.current?.focus();
  }, [onSearchChange]);

  const hasActiveFilters =
    searchQuery.length > 0 || filters.hiddenCategoryIds.size > 0 || filters.groupByCategory;

  const hiddenCount = totalCount - visibleCount;

  return (
    <div className="flex flex-col gap-3">
      {/* Search and summary row */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('common.search')}
            className="w-full pl-9 pr-8 py-2 text-sm bg-surface border border-stroke rounded-lg"
            aria-label={t('common.search')}
          />
          {/* Search icon */}
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {/* Clear button */}
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-tertiary hover:text-content rounded-full hover:bg-surface-hover"
              aria-label={t('binList.clearSearch')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Result count */}
        <div className="text-sm text-content-secondary">
          {hiddenCount > 0 ? (
            <span>{t('binList.showingOf', { visible: visibleCount, total: totalCount })}</span>
          ) : (
            <span>{t('binList.totalBinTypes', { count: totalCount })}</span>
          )}
        </div>

        {/* Reset filters button */}
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="text-sm text-accent hover:text-accent-hover transition-colors"
          >
            {t('binList.resetFilters')}
          </button>
        )}
      </div>

      {/* Category filters and group toggle row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Category toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-content-tertiary">{t('common.categories')}</span>
          {categories.map((category) => {
            const isHidden = filters.hiddenCategoryIds.has(category.id);
            return (
              <button
                key={category.id}
                onClick={() => onToggleCategoryVisibility(category.id)}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all
                  ${
                    isHidden
                      ? 'bg-surface-hover text-content-disabled opacity-50'
                      : 'bg-surface-elevated text-content hover:bg-surface-hover'
                  }
                `}
                title={isHidden ? `Show ${category.name}` : `Hide ${category.name}`}
                aria-pressed={!isHidden}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isHidden ? 'opacity-50' : ''}`}
                  style={{ backgroundColor: category.color }}
                />
                {category.name}
                {isHidden && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-stroke-subtle" />

        {/* Group by category toggle */}
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={onToggleGroupByCategory}
          role="checkbox"
          aria-checked={filters.groupByCategory}
          aria-label={t('binList.groupByCategory')}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onToggleGroupByCategory();
            }
          }}
        >
          <span
            className={`text-sm ${filters.groupByCategory ? 'text-content' : 'text-content-secondary'}`}
          >
            {t('binList.groupByCategory')}
          </span>
          <Checkbox checked={filters.groupByCategory} variant="desktop" />
        </div>
      </div>
    </div>
  );
}
