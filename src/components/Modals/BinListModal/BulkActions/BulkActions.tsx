import { useState, useCallback, useRef, useEffect } from 'react';
import type { Category, CategoryId } from '@/core/types';
import { useTranslation } from '@/i18n';

interface BulkActionsProps {
  /** Number of selected items */
  selectionCount: number;
  /** Available categories */
  categories: Category[];
  /** Callback to delete selected items */
  onDelete: () => void;
  /** Callback to change category of selected items */
  onChangeCategory: (categoryId: CategoryId) => void;
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Callback to update label for selected items */
  onUpdateLabel?: (label: string) => void;
  /** Callback to update notes for selected items */
  onUpdateNotes?: (notes: string) => void;
}

type DropdownOpen = 'category' | 'label' | 'notes' | null;

/**
 * Bulk actions toolbar that appears when items are selected.
 * Provides delete, category change, and edit options.
 */
export function BulkActions({
  selectionCount,
  categories,
  onDelete,
  onChangeCategory,
  onClearSelection,
  onUpdateLabel,
  onUpdateNotes,
}: BulkActionsProps) {
  const t = useTranslation();
  const [openDropdown, setOpenDropdown] = useState<DropdownOpen>(null);
  const [labelValue, setLabelValue] = useState('');
  const [notesValue, setNotesValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  const handleCategorySelect = useCallback(
    (categoryId: CategoryId) => {
      onChangeCategory(categoryId);
      setOpenDropdown(null);
    },
    [onChangeCategory]
  );

  const handleLabelSubmit = useCallback(() => {
    if (onUpdateLabel && labelValue.trim()) {
      onUpdateLabel(labelValue.trim());
      setLabelValue('');
      setOpenDropdown(null);
    }
  }, [onUpdateLabel, labelValue]);

  const handleNotesSubmit = useCallback(() => {
    if (onUpdateNotes && notesValue.trim()) {
      onUpdateNotes(notesValue.trim());
      setNotesValue('');
      setOpenDropdown(null);
    }
  }, [onUpdateNotes, notesValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, submitFn: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitFn();
    } else if (e.key === 'Escape') {
      setOpenDropdown(null);
    }
  }, []);

  if (selectionCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border-y border-accent/20">
      {/* Selection count */}
      <span className="text-sm font-medium text-content">
        {t('binList.selected', { count: selectionCount })}
      </span>

      {/* Clear selection */}
      <button
        onClick={onClearSelection}
        className="text-sm text-content-secondary hover:text-content transition-colors"
        aria-label={t('binList.clearSelection')}
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

      <div className="h-4 w-px bg-stroke mx-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1" ref={dropdownRef}>
        {/* Change Category dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-surface-elevated hover:bg-surface-hover rounded-lg transition-colors"
            aria-expanded={openDropdown === 'category'}
            aria-haspopup="listbox"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            {t('inspector.category')}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {openDropdown === 'category' && (
            <div
              className="absolute top-full left-0 mt-1 w-48 py-1 bg-surface-elevated border border-stroke rounded-lg shadow-lg z-50"
              role="listbox"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-content hover:bg-surface-hover transition-colors"
                  role="option"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Set Label dropdown */}
        {onUpdateLabel && (
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'label' ? null : 'label')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-surface-elevated hover:bg-surface-hover rounded-lg transition-colors"
              aria-expanded={openDropdown === 'label'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              {t('inspector.label')}
            </button>

            {openDropdown === 'label' && (
              <div className="absolute top-full left-0 mt-1 w-64 p-3 bg-surface-elevated border border-stroke rounded-lg shadow-lg z-50">
                <label className="block text-xs text-content-secondary mb-1">
                  {t('binList.setLabelForCount', { count: selectionCount })}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={labelValue}
                    onChange={(e) => setLabelValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleLabelSubmit)}
                    placeholder={t('binList.enterLabel')}
                    className="flex-1 px-2 py-1.5 text-sm bg-surface border border-stroke rounded focus:outline-none focus:ring-2 focus:ring-accent"
                    maxLength={24}
                    autoFocus
                  />
                  <button
                    onClick={handleLabelSubmit}
                    disabled={!labelValue.trim()}
                    className="px-3 py-1.5 text-sm bg-accent text-on-dark rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('common.apply')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Set Notes dropdown */}
        {onUpdateNotes && (
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'notes' ? null : 'notes')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-surface-elevated hover:bg-surface-hover rounded-lg transition-colors"
              aria-expanded={openDropdown === 'notes'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('inspector.notes')}
            </button>

            {openDropdown === 'notes' && (
              <div className="absolute top-full left-0 mt-1 w-72 p-3 bg-surface-elevated border border-stroke rounded-lg shadow-lg z-50">
                <label className="block text-xs text-content-secondary mb-1">
                  {t('binList.setNotesForCount', { count: selectionCount })}
                </label>
                <div className="flex flex-col gap-2">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setOpenDropdown(null);
                      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        // Ctrl/Cmd+Enter to submit for textarea
                        e.preventDefault();
                        handleNotesSubmit();
                      }
                    }}
                    placeholder={t('binList.enterNotesShortcut', { mod: '⌘' })}
                    className="w-full px-2 py-1.5 text-sm bg-surface border border-stroke rounded focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    rows={2}
                    maxLength={256}
                    autoFocus
                  />
                  <button
                    onClick={handleNotesSubmit}
                    disabled={!notesValue.trim()}
                    className="self-end px-3 py-1.5 text-sm bg-accent text-on-dark rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('common.apply')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="h-4 w-px bg-stroke mx-1" />

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-error bg-error/10 hover:bg-error/20 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}
