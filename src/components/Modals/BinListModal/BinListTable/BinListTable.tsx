import { useState, useCallback } from 'react';
import { DEFAULT_CATEGORY_COLOR } from '@/core/constants';

const LIST_SEPARATOR = ', ';
import { SplitPreview } from '@/components/Print/SplitPreview';
import { STLSearchDropdown } from '@/components/STLSearchDropdown';
import type {
  EnhancedPrintRow,
  Category,
  BinId,
  PrintListSortKey,
  PrintListSortOrder,
} from '@/core/types';
import { useTranslation } from '@/i18n';

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
  onEditLabel?: (binIds: BinId[], label: string) => void;
  onEditNotes?: (binIds: BinId[], notes: string) => void;
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
  const t = useTranslation();
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

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIndex: number, field: 'label' | 'notes', currentValue: string) => {
      // Start editing on Enter or F2
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        if (!onEditLabel && !onEditNotes) return;
        setEditing({ rowIndex, field, value: currentValue });
      }
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
                aria-label={t('binList.selectAllRows')}
              />
            </th>
            <th className="w-8 px-2 py-2 sticky top-0 bg-surface-elevated" />
            <SortHeader
              label="Size"
              sortKeyValue="area"
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={onSort}
              title={t('print.sort.sortBySize')}
            />
            <th
              className="w-8 px-1 py-2 sticky top-0 bg-surface-elevated"
              title={t('stlSearch.findSTL')}
            />
            <SortHeader
              label="H"
              sortKeyValue="height"
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={onSort}
              title={t('print.sort.sortByHeight')}
              className="w-12"
            />
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-surface-elevated">
              {t('inspector.label')}
            </th>
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-surface-elevated">
              {t('inspector.notes')}
            </th>
            <th
              className="w-6 px-1 py-2 sticky top-0 bg-surface-elevated"
              title={t('print.sort.customProperties')}
            />
            <th className="px-3 py-2 text-right font-medium sticky top-0 bg-surface-elevated w-16">
              {t('binList.qtyAbbrev')}
            </th>
            {hasAnySplits && (
              <th className="px-3 py-2 text-right font-medium sticky top-0 bg-surface-elevated w-16">
                {t('binList.pcsAbbrev')}
              </th>
            )}
            <SortHeader
              label="~m"
              sortKeyValue="filament"
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={onSort}
              title={t('print.sort.sortByFilament')}
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
                  <div
                    className="flex gap-0.5"
                    title={(row.categoryIds ?? [])
                      .map(
                        (catId) =>
                          categories.find((c) => c.id === catId)?.name || t('common.unknown')
                      )
                      .join(LIST_SEPARATOR)}
                  >
                    {(row.categoryIds ?? []).slice(0, 3).map((catId) => {
                      const cat = categories.find((c) => c.id === catId);
                      return (
                        <span
                          key={catId}
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat?.color || DEFAULT_CATEGORY_COLOR }}
                        />
                      );
                    })}
                    {(row.categoryIds ?? []).length > 3 && (
                      <span className="text-[9px] text-content-disabled">
                        {t('rightPanel.moreCategories', {
                          count: (row.categoryIds ?? []).length - 3,
                        })}
                      </span>
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
                        aria-label={t('grid.clickToSeeSplitPreview')}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </span>
                </td>

                {/* Find STL */}
                <td className="px-1 py-2">
                  <STLSearchDropdown
                    width={parseFloat(row.size.split('×')[0])}
                    depth={parseFloat(row.size.split('×')[1])}
                    variant="icon"
                    needsSplit={row.needsSplit}
                  />
                </td>

                {/* Height */}
                <td className="px-3 py-2 text-content-tertiary">{row.height}u</td>

                {/* Label (editable) */}
                <td
                  role={onEditLabel ? 'gridcell' : undefined}
                  tabIndex={onEditLabel ? 0 : undefined}
                  className={`px-3 py-2 text-content-secondary max-w-[150px] ${
                    onEditLabel
                      ? 'cursor-text hover:bg-surface-hover focus:outline-none focus:ring-1 focus:ring-accent focus:ring-inset'
                      : ''
                  }`}
                  onDoubleClick={() =>
                    handleDoubleClick(index, 'label', (row.labels ?? [])[0] || '')
                  }
                  onKeyDown={(e) =>
                    handleCellKeyDown(e, index, 'label', (row.labels ?? [])[0] || '')
                  }
                  aria-label={
                    onEditLabel
                      ? t('binList.labelAriaEdit', {
                          label: (row.labels ?? [])[0] || t('common.empty'),
                        })
                      : undefined
                  }
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
                    <span className="truncate block" title={(row.labels ?? [])[0]}>
                      {(row.labels ?? [])[0] || (
                        <span className="text-content-disabled italic">—</span>
                      )}
                    </span>
                  )}
                </td>

                {/* Notes (editable) */}
                <td
                  role={onEditNotes ? 'gridcell' : undefined}
                  tabIndex={onEditNotes ? 0 : undefined}
                  className={`px-3 py-2 text-content-tertiary max-w-[200px] ${
                    onEditNotes
                      ? 'cursor-text hover:bg-surface-hover focus:outline-none focus:ring-1 focus:ring-accent focus:ring-inset'
                      : ''
                  }`}
                  onDoubleClick={() => handleDoubleClick(index, 'notes', row.notes || '')}
                  onKeyDown={(e) => handleCellKeyDown(e, index, 'notes', row.notes || '')}
                  aria-label={
                    onEditNotes
                      ? t('binList.notesAriaEdit', { notes: row.notes || t('common.empty') })
                      : undefined
                  }
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

                {/* Custom properties indicator */}
                <td className="px-1 py-2">
                  {row.customProperties && Object.keys(row.customProperties).length > 0 && (
                    <svg
                      className="w-3.5 h-3.5 text-content-disabled"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-label={t('binList.customPropertiesCount', {
                        count: Object.keys(row.customProperties).length,
                      })}
                    >
                      <title>
                        {t('binList.customPropertiesCount', {
                          count: Object.keys(row.customProperties).length,
                        })}
                      </title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  )}
                </td>

                {/* Quantity */}
                <td className="px-3 py-2 text-right text-content tabular-nums">{row.binCount}</td>

                {/* Pieces (if any splits) */}
                {hasAnySplits && (
                  <td className="px-3 py-2 text-right text-content tabular-nums">
                    {row.totalPieces}
                  </td>
                )}

                {/* Filament */}
                <td className="px-3 py-2 text-right text-content-tertiary tabular-nums">
                  {row.filament}
                </td>
              </tr>
            );
          })}

          {/* Expanded split preview row */}
          {expandedSplitRow !== null && rows[expandedSplitRow]?.needsSplit && (
            <tr className="bg-surface-elevated border-b border-stroke-subtle">
              <td colSpan={hasAnySplits ? 11 : 10} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  <SplitPreview
                    width={parseInt(rows[expandedSplitRow].size.split('×')[0])}
                    depth={parseInt(rows[expandedSplitRow].size.split('×')[1])}
                    pieces={rows[expandedSplitRow].pieces}
                  />
                  <div className="text-xs text-content-secondary">
                    <div className="font-medium mb-1">
                      {t('binList.splitInto')}
                      {rows[expandedSplitRow].totalPieces}
                      {t('binList.pieces')}
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
