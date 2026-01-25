import { useState, useCallback, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { useBinList } from '@/hooks/useBinList';
import { SplitPreview } from '@/components/Print/SplitPreview';
import type { EnhancedPrintRow, Category, PrintListSortKey } from '@/core/types';
import { useTranslation } from '@/i18n';

interface MobileBinListProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mobile-optimized bin list with card layout, bottom action bar, and bottom sheets.
 * Replaces the table-based BinListModal on mobile devices.
 */
export function MobileBinList({ isOpen, onClose }: MobileBinListProps) {
  if (!isOpen) return null;
  return <MobileBinListContent onClose={onClose} />;
}

type DropdownOpen = 'sort' | 'export' | 'stats' | null;

const SORT_OPTIONS: { key: PrintListSortKey; label: string }[] = [
  { key: 'default', label: 'Default Order' },
  { key: 'area', label: 'Size (Area)' },
  { key: 'height', label: 'Height' },
  { key: 'filament', label: 'Filament' },
];

function MobileBinListContent({ onClose }: { onClose: () => void }) {
  const t = useTranslation();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'label' | 'notes' | 'category' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [openDropdown, setOpenDropdown] = useState<DropdownOpen>(null);

  const {
    rows,
    unfilteredRows,
    categories,
    totalBins,
    totalPieces,
    totalFilament,
    totalCost,
    totalPrintTimeHours,
    spoolEstimate,
    spoolPercentage,
    hasAnySplits,
    categoryBreakdown,
    searchQuery,
    setSearchQuery,
    filters,
    setSort,
    toggleCategoryVisibility,
    toggleGroupByCategory,
    resetFilters,
    selectedIndices,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    isAllSelected,
    selectionCount,
    deleteBulkSelection,
    changeBulkCategory,
    updateBulkLabel,
    updateBulkNotes,
    selectBinsByRow,
    downloadExport,
    copyToClipboard,
  } = useBinList();

  const handleRowTap = useCallback(
    (row: EnhancedPrintRow, index: number) => {
      if (selectionCount > 0) {
        // In selection mode, toggle selection
        toggleRowSelection(index, false);
      } else {
        // Select bins on grid
        selectBinsByRow(row);
        // Toggle split preview if needed
        if (row.needsSplit) {
          setExpandedRow(expandedRow === index ? null : index);
        }
      }
    },
    [selectionCount, toggleRowSelection, selectBinsByRow, expandedRow, setExpandedRow]
  );

  const handleRowLongPress = useCallback(
    (index: number) => {
      // Start selection mode
      toggleRowSelection(index, false);
    },
    [toggleRowSelection]
  );

  const handleEditSubmit = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      setEditingField(null);
      return;
    }
    if (editingField === 'label') {
      updateBulkLabel(trimmedValue);
    } else if (editingField === 'notes') {
      updateBulkNotes(trimmedValue);
    }
    clearSelection();
    setEditValue('');
    setEditingField(null);
  }, [editingField, editValue, updateBulkLabel, updateBulkNotes, clearSelection]);

  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      changeBulkCategory(categoryId);
      clearSelection();
      setEditingField(null);
    },
    [changeBulkCategory, clearSelection]
  );

  const content = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-surface-secondary"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-bin-list-title"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-stroke bg-surface-elevated safe-area-top">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center -ml-2 text-content-secondary hover:text-content"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="flex flex-col justify-center">
            <h2
              id="mobile-bin-list-title"
              className="text-base font-semibold text-content leading-tight"
            >{t('binList.binList')}</h2>
            <p className="text-xs text-content-tertiary leading-tight">
              {t('binList.summaryStats', { bins: totalBins, filament: totalFilament })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Stats toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdown(openDropdown === 'stats' ? null : 'stats');
            }}
            className={`w-10 h-10 flex items-center justify-center ${openDropdown === 'stats' ? 'text-accent' : 'text-content-secondary hover:text-content'}`}
            aria-label={t('binList.toggleStats')}
            aria-pressed={openDropdown === 'stats'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </button>
          {/* Export dropdown trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdown(openDropdown === 'export' ? null : 'export');
            }}
            className={`w-10 h-10 flex items-center justify-center ${openDropdown === 'export' ? 'text-accent' : 'text-content-secondary hover:text-content'}`}
            aria-label={t('common.export')}
            aria-expanded={openDropdown === 'export'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Stats panel (collapsible) */}
      {openDropdown === 'stats' && (
        <div
          className="px-4 py-3 border-b border-stroke bg-surface"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-content-tertiary text-xs">{t('binList.binTypes')}</div>
              <div className="font-semibold text-content">{rows.length}</div>
            </div>
            <div>
              <div className="text-content-tertiary text-xs">{t('binList.totalBins')}</div>
              <div className="font-semibold text-content">{totalBins}</div>
            </div>
            {hasAnySplits && (
              <div>
                <div className="text-content-tertiary text-xs">{t('binList.printPieces')}</div>
                <div className="font-semibold text-content">{totalPieces}</div>
              </div>
            )}
            <div>
              <div className="text-content-tertiary text-xs">{t('binList.filament')}</div>
              <div className="font-semibold text-content">{totalFilament}m</div>
            </div>
            <div>
              <div className="text-content-tertiary text-xs">{t('binList.estCost')}</div>
              <div className="font-semibold text-content">{t('binList.costValue', { cost: totalCost.toFixed(2) })}</div>
            </div>
            <div>
              <div className="text-content-tertiary text-xs">{t('binList.printTime')}</div>
              <div className="font-semibold text-content">{totalPrintTimeHours.toFixed(1)}h</div>
            </div>
            <div className="col-span-2">
              <div className="text-content-tertiary text-xs mb-1">{t('binList.spoolUsage')}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-surface-secondary rounded overflow-hidden">
                  <div
                    className="h-full bg-accent rounded"
                    style={{ width: `${Math.min(spoolPercentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-content">
                  {t('binList.spoolUsage', { spools: spoolEstimate.toFixed(1), pct: spoolPercentage.toFixed(0) })}
                </span>
              </div>
            </div>
            {categoryBreakdown.length > 1 && (
              <div className="col-span-2 pt-2 border-t border-stroke-subtle">
                <div className="text-content-tertiary text-xs mb-2">{t('binList.byCategory')}</div>
                <div className="space-y-1.5">
                  {categoryBreakdown.map(
                    ({ categoryId, categoryName, categoryColor, binCount, percentage }) => (
                      <div key={categoryId} className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: categoryColor }}
                        />
                        <span className="flex-1 text-xs text-content truncate">{categoryName}</span>
                        <span className="text-xs text-content-tertiary">
                          {t('binList.categoryCount', { count: binCount, pct: percentage.toFixed(0) })}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export dropdown */}
      {openDropdown === 'export' && (
        <div
          className="px-4 py-3 border-b border-stroke bg-surface"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs text-content-tertiary mb-2">{t('common.download')}</div>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => {
                downloadExport('tsv');
                setOpenDropdown(null);
              }}
              className="flex-1 py-2 text-sm bg-surface-elevated border border-stroke rounded text-center"
            >
              TSV
            </button>
            <button
              onClick={() => {
                downloadExport('csv');
                setOpenDropdown(null);
              }}
              className="flex-1 py-2 text-sm bg-surface-elevated border border-stroke rounded text-center"
            >
              CSV
            </button>
            <button
              onClick={() => {
                downloadExport('json');
                setOpenDropdown(null);
              }}
              className="flex-1 py-2 text-sm bg-surface-elevated border border-stroke rounded text-center"
            >
              JSON
            </button>
          </div>
          <div className="text-xs text-content-tertiary mb-2">{t('mobile.copyToClipboard')}</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                copyToClipboard('tsv');
                setOpenDropdown(null);
              }}
              className="flex-1 py-2 text-sm bg-surface-elevated border border-stroke rounded text-center"
            >{t('binList.copyTsv')}</button>
            <button
              onClick={() => {
                copyToClipboard('csv');
                setOpenDropdown(null);
              }}
              className="flex-1 py-2 text-sm bg-surface-elevated border border-stroke rounded text-center"
            >{t('binList.copyCsv')}</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-3 border-b border-stroke">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('binList.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-surface border border-stroke rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
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
        </div>
      </div>

      {/* Filters bar */}
      <div className="px-4 py-2 border-b border-stroke">
        {/* Sort and filter controls */}
        <div className="flex items-center gap-2 mb-2">
          {/* Sort dropdown */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdown(openDropdown === 'sort' ? null : 'sort');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-surface-elevated border border-stroke rounded"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
              />
            </svg>
            {SORT_OPTIONS.find((o) => o.key === filters.sortKey)?.label || t('common.sort')}
            {filters.sortOrder === 'asc' && <span className="text-content-tertiary">↑</span>}
            {filters.sortOrder === 'desc' && filters.sortKey !== 'default' && (
              <span className="text-content-tertiary">↓</span>
            )}
          </button>

          {/* Group toggle */}
          <button
            onClick={toggleGroupByCategory}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all
              ${filters.groupByCategory ? 'bg-accent text-on-dark' : 'bg-surface-elevated text-content border border-stroke'}
            `}
          >{t('common.group')}</button>

          {/* Reset filters (only show if filters are active) */}
          {(filters.hiddenCategoryIds.size > 0 ||
            filters.sortKey !== 'default' ||
            searchQuery ||
            filters.groupByCategory) && (
            <button
              onClick={() => {
                resetFilters();
                setSearchQuery('');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-content-secondary hover:text-content"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>{t('common.reset')}</button>
          )}

          {/* Filter count */}
          {unfilteredRows.length !== rows.length && (
            <span className="text-xs text-content-tertiary ml-auto">
              {rows.length}/{unfilteredRows.length}
            </span>
          )}
        </div>

        {/* Sort dropdown content */}
        {openDropdown === 'sort' && (
          <div
            className="mb-2 p-2 bg-surface border border-stroke rounded"
            onClick={(e) => e.stopPropagation()}
          >
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => {
                  setSort(option.key);
                  setOpenDropdown(null);
                }}
                className={`
                  flex items-center justify-between w-full px-3 py-2 text-sm rounded
                  ${filters.sortKey === option.key ? 'bg-accent/10 text-accent' : 'text-content hover:bg-surface-hover'}
                `}
              >
                {option.label}
                {filters.sortKey === option.key && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Category filters - horizontal scroll */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex items-center gap-2">
            {categories.map((category) => {
              const isHidden = filters.hiddenCategoryIds.has(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => toggleCategoryVisibility(category.id)}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium flex-shrink-0 transition-all
                    ${isHidden ? 'bg-surface text-content-disabled opacity-60 border border-stroke' : 'bg-surface-elevated text-content'}
                  `}
                >
                  <span
                    className="w-2.5 h-2.5 rounded"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-content-tertiary">
            <svg
              className="w-12 h-12 mb-3 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <p className="text-sm">{t('binList.noBinsMatchYourFilters')}</p>
          </div>
        ) : (
          <div className="space-y-2 pb-20">
            {/* Select all row when in selection mode */}
            {selectionCount > 0 && (
              <button
                onClick={() => (isAllSelected ? clearSelection() : selectAllRows())}
                className="w-full p-3 rounded bg-accent/10 text-accent text-sm font-medium text-center border border-accent/30"
              >
                {isAllSelected ? t('binList.deselectAll') : t('binList.selectAllCount', { count: rows.length })}
              </button>
            )}

            {rows.map((row, index) => (
              <BinCard
                key={`${row.size}-${row.height}-${row.labels.join(',')}-${index}`}
                row={row}
                index={index}
                categories={categories}
                isSelected={selectedIndices.has(index)}
                isExpanded={expandedRow === index}
                selectionMode={selectionCount > 0}
                onTap={() => handleRowTap(row, index)}
                onLongPress={() => handleRowLongPress(index)}
                onToggleSelect={() => toggleRowSelection(index, false)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar when selection active */}
      {selectionCount > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pt-3 bg-surface-elevated border-t border-stroke"
          style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-content">{t('binList.nSelected', { count: selectionCount })}</span>
            <button onClick={clearSelection} className="text-sm text-content-secondary">{t('common.cancel')}</button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingField('category')}
              className="flex-1 py-2.5 rounded bg-surface text-sm font-medium text-content border border-stroke"
            >{t('common.category')}</button>
            <button
              onClick={() => setEditingField('label')}
              className="flex-1 py-2.5 rounded bg-surface text-sm font-medium text-content border border-stroke"
            >{t('common.label')}</button>
            <button
              onClick={() => setEditingField('notes')}
              className="flex-1 py-2.5 rounded bg-surface text-sm font-medium text-content border border-stroke"
            >{t('common.notes')}</button>
            <button
              onClick={deleteBulkSelection}
              className="px-4 py-2.5 rounded bg-error/10 text-sm font-medium text-error border border-error/20"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Category selection bottom sheet */}
      {editingField === 'category' && (
        <BottomSheet title={t('categories.selectCategory')} onClose={() => setEditingField(null)}>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-surface-hover active:bg-surface-hover"
              >
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-content">{category.name}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Label editing bottom sheet */}
      {editingField === 'label' && (
        <BottomSheet
          title={t('binList.setLabelForBins', { count: selectionCount })}
          onClose={() => setEditingField(null)}
        >
          <div className="space-y-3">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={t('binList.enterLabel')}
              className="w-full px-4 py-3 text-base bg-surface border border-stroke rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              maxLength={24}
              autoFocus
            />
            <button
              onClick={handleEditSubmit}
              disabled={!editValue.trim()}
              className="w-full py-3 rounded-lg bg-accent text-on-dark font-medium disabled:opacity-50"
            >
              {t('common.apply')}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Notes editing bottom sheet */}
      {editingField === 'notes' && (
        <BottomSheet
          title={t('binList.setNotesForBins', { count: selectionCount })}
          onClose={() => setEditingField(null)}
        >
          <div className="space-y-3">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={t('binList.enterNotes')}
              className="w-full px-4 py-3 text-base bg-surface border border-stroke rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              rows={3}
              maxLength={256}
              autoFocus
            />
            <button
              onClick={handleEditSubmit}
              disabled={!editValue.trim()}
              className="w-full py-3 rounded-lg bg-accent text-on-dark font-medium disabled:opacity-50"
            >
              {t('common.apply')}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

// Bin card component
interface BinCardProps {
  row: EnhancedPrintRow;
  index: number;
  categories: Category[];
  isSelected: boolean;
  isExpanded: boolean;
  selectionMode: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
}

function BinCard({
  row,
  categories,
  isSelected,
  isExpanded,
  selectionMode,
  onTap,
  onLongPress,
  onToggleSelect,
}: BinCardProps) {
  const t = useTranslation();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTriggeredRef = useRef(false);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = () => {
    touchTriggeredRef.current = true;
    longPressTimerRef.current = setTimeout(() => {
      onLongPress();
      longPressTimerRef.current = null;
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClick = () => {
    // Prevent click from firing after touch events
    if (touchTriggeredRef.current) {
      touchTriggeredRef.current = false;
      return;
    }
    onTap();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  };

  const [w, d] = row.size.split('×').map(Number);

  return (
    <div
      className={`
        p-3 rounded-lg transition-colors cursor-pointer
        ${isSelected ? 'bg-accent/20 ring-2 ring-accent' : 'bg-surface-elevated active:bg-surface-hover'}
        focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-secondary
      `}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="flex items-start gap-3">
        {/* Selection checkbox (visible in selection mode) */}
        {selectionMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
              ${isSelected ? 'bg-accent border-accent' : 'border-stroke bg-surface'}
            `}
          >
            {isSelected && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        )}

        {/* Category colors */}
        <div className="flex gap-1 pt-1 flex-shrink-0">
          {(row.categoryIds ?? []).slice(0, 3).map((catId) => {
            const cat = categories.find((c) => c.id === catId);
            return (
              <div
                key={catId}
                className="w-3.5 h-3.5 rounded"
                style={{ backgroundColor: cat?.color || DEFAULT_CATEGORY_COLOR }}
              />
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-content">{row.size}</span>
            <span className="text-sm text-content-tertiary">{row.height}u</span>
            {row.needsSplit && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-[var(--color-warning-muted)] text-[var(--color-warning)]">{t('binList.split')}<svg
                  className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
            )}
          </div>
          {((row.labels ?? [])[0] ||
            row.notes ||
            (row.customProperties && Object.keys(row.customProperties).length > 0)) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {(row.labels ?? [])[0] && (
                <span className="text-sm truncate text-content-tertiary">
                  {(row.labels ?? [])[0]}
                </span>
              )}
              {row.notes && (
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0 text-content-disabled"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-label={t('grid.hasNotesAriaLabel')}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              )}
              {row.customProperties && Object.keys(row.customProperties).length > 0 && (
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0 text-content-disabled"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-label={t('grid.hasCustomPropertiesAriaLabel')}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Count and filament */}
        <div className="text-right flex-shrink-0">
          <span className="font-semibold text-content">×{row.binCount}</span>
          {row.needsSplit && (
            <div className="text-xs text-content-tertiary">{t('binList.piecesCount', { count: row.totalPieces })}</div>
          )}
          <div className="text-xs text-content-disabled mt-0.5">~{row.filament}m</div>
        </div>
      </div>

      {/* Expanded split preview */}
      {isExpanded && row.needsSplit && (
        <div className="mt-3 pt-3 border-t border-stroke-subtle">
          <div className="flex items-start gap-4">
            <SplitPreview width={w} depth={d} pieces={row.pieces} cellSize={14} />
            <div className="text-xs text-content-secondary flex-1">
              <div className="font-medium mb-1">{t('binList.splitIntoPieces', { count: row.totalPieces })}</div>
              {row.pieces.map((piece) => (
                <div key={`${piece.width}x${piece.depth}`} className="text-content-tertiary">
                  {piece.count}× {piece.width}×{piece.depth}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple bottom sheet component
interface BottomSheetProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

function BottomSheet({ title, children, onClose }: BottomSheetProps) {
  const t = useTranslation();
  const sheetId = useId();

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby={sheetId}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-surface-secondary rounded-t-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stroke">
          <h3 id={sheetId} className="font-medium text-content">
            {title}
          </h3>
          <button onClick={onClose} className="p-2 -mr-2 text-content-secondary" aria-label={t('common.close')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
