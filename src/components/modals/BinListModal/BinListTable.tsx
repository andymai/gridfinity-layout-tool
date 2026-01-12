import { useState, useCallback } from 'react';
import { DEFAULT_CATEGORY_COLOR } from '../../../constants';
import { SplitPreview } from '../../PrintList';
import type { EnhancedPrintRow, Category, PrintListSortKey, PrintListSortOrder } from '../../../types';

interface BinListTableProps {
  rows: EnhancedPrintRow[];
  categories: Category[];
  selectedIndices: Set<number>;
  onToggleSelection: (index: number, shiftKey: boolean) => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
  sortKey: PrintListSortKey;
  sortOrder: PrintListSortOrder;
  onSort: (key: PrintListSortKey) => void;
  onRowClick: (row: EnhancedPrintRow) => void;
  hasAnySplits: boolean;
  /** Edit handlers for inline editing */
  onEditLabel?: (binIds: string[], label: string) => void;
  onEditNotes?: (binIds: string[], notes: string) => void;
}

interface EditingState {
  rowIndex: number;
  field: 'label' | 'notes';
  value: string;
}

interface SortHeaderProps {
  label: string;
  sortKeyValue: PrintListSortKey;
  sortKey: PrintListSortKey;
  sortOrder: PrintListSortOrder;
  onSort: (key: PrintListSortKey) => void;
  className?: string;
  title?: string;
}

/**
 * Sortable column header component.
 */
function SortHeader({
  label,
  sortKeyValue,
  sortKey,
  sortOrder,
  onSort,
  className = '',
  title,
}: SortHeaderProps) {
  const isActive = sortKey === sortKeyValue;
  return (
    <th
      className={`px-3 py-2 text-left font-medium sticky top-0 bg-surface-elevated cursor-pointer hover:bg-surface transition-colors select-none ${className}`}
      onClick={() => onSort(sortKeyValue)}
      title={title}
      role="columnheader"
      aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <svg
            className={`w-3 h-3 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
    </th>
  );
}

/**
 * Sortable table with checkbox selection for the expanded bin list.
 */
export function BinListTable({
  rows,
  categories,
  selectedIndices,
  onToggleSelection,
  onSelectAll,
  isAllSelected,
  sortKey,
  sortOrder,
  onSort,
  onRowClick,
  hasAnySplits,
  onEditLabel,
  onEditNotes,
}: BinListTableProps) {
  const [expandedSplitRow, setExpandedSplitRow] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const handleRowClick = useCallback(
    (row: EnhancedPrintRow, index: number, e: React.MouseEvent) => {
      // Don't trigger if clicking on checkbox or editable cell
      if ((e.target as HTMLElement).closest('input, button')) return;

      onRowClick(row);

      if (row.needsSplit) {
        setExpandedSplitRow(expandedSplitRow === index ? null : index);
      }
    },
    [onRowClick, expandedSplitRow]
  );

  const handleCheckboxClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleSelection(index, e.shiftKey);
    },
    [onToggleSelection]
  );

  const handleDoubleClick = useCallback(
    (rowIndex: number, field: 'label' | 'notes', currentValue: string) => {
      if (!onEditLabel && !onEditNotes) return;
      setEditing({ rowIndex, field, value: currentValue });
    },
    [onEditLabel, onEditNotes]
  );

  const handleEditSave = useCallback(() => {
    if (!editing) return;

    const row = rows[editing.rowIndex];
    if (!row) return;

    if (editing.field === 'label' && onEditLabel) {
      onEditLabel(row.binIds, editing.value);
    } else if (editing.field === 'notes' && onEditNotes) {
      onEditNotes(row.binIds, editing.value);
    }

    setEditing(null);
  }, [editing, rows, onEditLabel, onEditNotes]);

  const handleEditCancel = useCallback(() => {
    setEditing(null);
  }, []);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleEditSave();
      } else if (e.key === 'Escape') {
        handleEditCancel();
      }
    },
    [handleEditSave, handleEditCancel]
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-content-tertiary">
        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <p className="text-sm">No bins match your filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-full">
      <table className="w-full text-sm">
        <thead className="text-content-secondary">
          <tr>
            <th className="w-10 px-3 py-2 sticky top-0 bg-surface-elevated">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onSelectAll}
                className="rounded border-stroke focus:ring-accent"
                aria-label="Select all rows"
              />
            </th>
            <th className="w-8 px-2 py-2 sticky top-0 bg-surface-elevated" />
            <SortHeader label="Size" sortKeyValue="area" sortKey={sortKey} sortOrder={sortOrder} onSort={onSort} title="Sort by size (area)" />
            <SortHeader label="H" sortKeyValue="height" sortKey={sortKey} sortOrder={sortOrder} onSort={onSort} title="Sort by height" className="w-12" />
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-surface-elevated">Label</th>
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-surface-elevated">Notes</th>
            <th className="px-3 py-2 text-right font-medium sticky top-0 bg-surface-elevated w-16">Qty</th>
            {hasAnySplits && (
              <th className="px-3 py-2 text-right font-medium sticky top-0 bg-surface-elevated w-16">Pcs</th>
            )}
            <SortHeader
              label="~m"
              sortKeyValue="filament"
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={onSort}
              title="Sort by filament usage"
              className="text-right w-16"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isSelected = selectedIndices.has(index);
            const isExpanded = expandedSplitRow === index;

            return (
              <tr
                key={`${row.size}-${row.height}-${row.labels.join(',')}-${index}`}
                className={`
                  transition-colors cursor-pointer
                  ${isSelected ? 'bg-selection-bg' : 'hover:bg-surface-hover'}
                  ${isExpanded ? '' : 'border-b border-stroke-subtle'}
                `}
                onClick={(e) => handleRowClick(row, index, e)}
              >
                {/* Checkbox - onClick handles shift-click, readOnly keeps it controlled without onChange warning */}
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    onClick={(e) => handleCheckboxClick(index, e)}
                    className="rounded border-stroke focus:ring-accent cursor-pointer"
                    aria-label={`Select ${row.size} bin`}
                  />
                </td>

                {/* Category color dots */}
                <td className="px-2 py-2">
                  <div className="flex gap-0.5" title={row.categoryIds.map(catId => categories.find(c => c.id === catId)?.name || 'Unknown').join(', ')}>
                    {row.categoryIds.slice(0, 3).map((catId) => {
                      const cat = categories.find((c) => c.id === catId);
                      return (
                        <span
                          key={catId}
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat?.color || DEFAULT_CATEGORY_COLOR }}
                        />
                      );
                    })}
                    {row.categoryIds.length > 3 && (
                      <span className="text-[9px] text-content-disabled">+{row.categoryIds.length - 3}</span>
                    )}
                  </div>
                </td>

                {/* Size */}
                <td className="px-3 py-2 text-content">
                  <span className="inline-flex items-center gap-1.5">
                    {row.size}
                    {row.needsSplit && (
                      <svg
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-transform text-[var(--color-warning)] ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-label="Click to see split preview"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </span>
                </td>

                {/* Height */}
                <td className="px-3 py-2 text-content-tertiary">{row.height}u</td>

                {/* Label (editable) */}
                <td
                  className="px-3 py-2 text-content-secondary max-w-[150px]"
                  onDoubleClick={() => handleDoubleClick(index, 'label', row.labels[0] || '')}
                >
                  {editing?.rowIndex === index && editing.field === 'label' ? (
                    <input
                      type="text"
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      onBlur={handleEditSave}
                      onKeyDown={handleEditKeyDown}
                      className="w-full px-1 py-0.5 text-sm bg-surface border border-accent rounded focus:outline-none"
                      maxLength={24}
                      autoFocus
                    />
                  ) : (
                    <span className="truncate block" title={row.labels[0]}>
                      {row.labels[0] || <span className="text-content-disabled italic">—</span>}
                    </span>
                  )}
                </td>

                {/* Notes (editable) */}
                <td
                  className="px-3 py-2 text-content-tertiary max-w-[200px]"
                  onDoubleClick={() => handleDoubleClick(index, 'notes', row.notes || '')}
                >
                  {editing?.rowIndex === index && editing.field === 'notes' ? (
                    <input
                      type="text"
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      onBlur={handleEditSave}
                      onKeyDown={handleEditKeyDown}
                      className="w-full px-1 py-0.5 text-sm bg-surface border border-accent rounded focus:outline-none"
                      maxLength={256}
                      autoFocus
                    />
                  ) : (
                    <span className="truncate block" title={row.notes}>
                      {row.notes || <span className="text-content-disabled italic">—</span>}
                    </span>
                  )}
                </td>

                {/* Quantity */}
                <td className="px-3 py-2 text-right text-content tabular-nums">{row.binCount}</td>

                {/* Pieces (if any splits) */}
                {hasAnySplits && (
                  <td className="px-3 py-2 text-right text-content tabular-nums">{row.totalPieces}</td>
                )}

                {/* Filament */}
                <td className="px-3 py-2 text-right text-content-tertiary tabular-nums">{row.filament}</td>
              </tr>
            );
          })}

          {/* Expanded split preview row */}
          {expandedSplitRow !== null && rows[expandedSplitRow]?.needsSplit && (
            <tr className="bg-surface-elevated border-b border-stroke-subtle">
              <td colSpan={hasAnySplits ? 9 : 8} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  <SplitPreview
                    width={parseInt(rows[expandedSplitRow].size.split('×')[0])}
                    depth={parseInt(rows[expandedSplitRow].size.split('×')[1])}
                    pieces={rows[expandedSplitRow].pieces}
                  />
                  <div className="text-xs text-content-secondary">
                    <div className="font-medium mb-1">
                      Split into {rows[expandedSplitRow].totalPieces} pieces:
                    </div>
                    {rows[expandedSplitRow].pieces.map((piece) => (
                      <div key={`${piece.width}x${piece.depth}`} className="text-content-tertiary">
                        {piece.count}× {piece.width}×{piece.depth}
                      </div>
                    ))}
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
