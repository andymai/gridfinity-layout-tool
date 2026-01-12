import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_CATEGORY_COLOR } from '../../../constants';
import { useBinList } from '../../../hooks/useBinList';
import { SplitPreview } from '../../PrintList';
import type { EnhancedPrintRow, Category } from '../../../types';

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

function MobileBinListContent({ onClose }: { onClose: () => void }) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'label' | 'notes' | 'category' | null>(null);
  const [editValue, setEditValue] = useState('');

  const {
    rows,
    categories,
    totalBins,
    totalFilament,
    searchQuery,
    setSearchQuery,
    filters,
    toggleCategoryVisibility,
    toggleGroupByCategory,
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
  } = useBinList();

  const handleRowTap = useCallback((row: EnhancedPrintRow, index: number) => {
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
  }, [selectionCount, toggleRowSelection, selectBinsByRow, expandedRow]);

  const handleRowLongPress = useCallback((index: number) => {
    // Start selection mode
    toggleRowSelection(index, false);
  }, [toggleRowSelection]);

  const handleEditSubmit = useCallback(() => {
    if (!editValue.trim()) {
      setEditingField(null);
      return;
    }
    if (editingField === 'label') {
      updateBulkLabel(editValue.trim());
    } else if (editingField === 'notes') {
      updateBulkNotes(editValue.trim());
    }
    setEditValue('');
    setEditingField(null);
  }, [editingField, editValue, updateBulkLabel, updateBulkNotes]);

  const handleCategorySelect = useCallback((categoryId: string) => {
    changeBulkCategory(categoryId);
    setEditingField(null);
  }, [changeBulkCategory]);

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-secondary">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-stroke bg-surface-elevated safe-area-top">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-content-secondary hover:text-content"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-semibold text-content">Bin List</h2>
            <p className="text-xs text-content-tertiary">{totalBins} bins · {totalFilament}m</p>
          </div>
        </div>
        <button
          onClick={() => downloadExport('tsv')}
          className="p-2 text-content-secondary hover:text-content"
          aria-label="Export"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </header>

      {/* Search */}
      <div className="px-4 py-3 border-b border-stroke">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search label or notes..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-surface border border-stroke rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Category filters - horizontal scroll */}
      <div className="px-4 py-2 border-b border-stroke overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-tertiary flex-shrink-0">Filter:</span>
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
          <button
            onClick={toggleGroupByCategory}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium flex-shrink-0 transition-all
              ${filters.groupByCategory ? 'bg-accent text-white' : 'bg-surface-elevated text-content'}
            `}
          >
            Group
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-content-tertiary">
            <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm">No bins match your filters</p>
          </div>
        ) : (
          <div className="space-y-2 pb-20">
            {/* Select all row when in selection mode */}
            {selectionCount > 0 && (
              <button
                onClick={() => isAllSelected ? clearSelection() : selectAllRows()}
                className="w-full p-3 rounded bg-accent/10 text-accent text-sm font-medium text-center border border-accent/30"
              >
                {isAllSelected ? 'Deselect All' : `Select All (${rows.length})`}
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
            <span className="text-sm font-medium text-content">{selectionCount} selected</span>
            <button
              onClick={clearSelection}
              className="text-sm text-content-secondary"
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingField('category')}
              className="flex-1 py-2.5 rounded bg-surface text-sm font-medium text-content border border-stroke"
            >
              Category
            </button>
            <button
              onClick={() => setEditingField('label')}
              className="flex-1 py-2.5 rounded bg-surface text-sm font-medium text-content border border-stroke"
            >
              Label
            </button>
            <button
              onClick={() => setEditingField('notes')}
              className="flex-1 py-2.5 rounded bg-surface text-sm font-medium text-content border border-stroke"
            >
              Notes
            </button>
            <button
              onClick={deleteBulkSelection}
              className="px-4 py-2.5 rounded bg-error/10 text-sm font-medium text-error border border-error/20"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Category selection bottom sheet */}
      {editingField === 'category' && (
        <BottomSheet title="Select Category" onClose={() => setEditingField(null)}>
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
        <BottomSheet title={`Set Label for ${selectionCount} bin${selectionCount !== 1 ? 's' : ''}`} onClose={() => setEditingField(null)}>
          <div className="space-y-3">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Enter label..."
              className="w-full px-4 py-3 text-base bg-surface border border-stroke rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              maxLength={24}
              autoFocus
            />
            <button
              onClick={handleEditSubmit}
              disabled={!editValue.trim()}
              className="w-full py-3 rounded-lg bg-accent text-white font-medium disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Notes editing bottom sheet */}
      {editingField === 'notes' && (
        <BottomSheet title={`Set Notes for ${selectionCount} bin${selectionCount !== 1 ? 's' : ''}`} onClose={() => setEditingField(null)}>
          <div className="space-y-3">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Enter notes..."
              className="w-full px-4 py-3 text-base bg-surface border border-stroke rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              rows={3}
              maxLength={256}
              autoFocus
            />
            <button
              onClick={handleEditSubmit}
              disabled={!editValue.trim()}
              className="w-full py-3 rounded-lg bg-accent text-white font-medium disabled:opacity-50"
            >
              Apply
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
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      onLongPress();
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const [w, d] = row.size.split('×').map(Number);

  return (
    <div
      className={`
        p-3 rounded-lg transition-colors
        ${isSelected ? 'bg-accent/20 ring-2 ring-accent' : 'bg-surface-elevated active:bg-surface-hover'}
      `}
      onClick={onTap}
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
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* Category colors */}
        <div className="flex gap-1 pt-1 flex-shrink-0">
          {row.categoryIds.slice(0, 3).map((catId) => {
            const cat = categories.find(c => c.id === catId);
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
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-[var(--color-warning-muted)] text-[var(--color-warning)]">
                Split
                <svg
                  className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            )}
          </div>
          {(row.labels[0] || row.notes) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {row.labels[0] && (
                <span className="text-sm truncate text-content-tertiary">{row.labels[0]}</span>
              )}
              {row.notes && (
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-content-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Count and filament */}
        <div className="text-right flex-shrink-0">
          <span className="font-semibold text-content">×{row.binCount}</span>
          {row.needsSplit && (
            <div className="text-xs text-content-tertiary">{row.totalPieces} pcs</div>
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
              <div className="font-medium mb-1">Split into {row.totalPieces} pieces:</div>
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
  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-surface-secondary rounded-t-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stroke">
          <h3 className="font-medium text-content">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-content-secondary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
