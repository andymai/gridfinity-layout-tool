import { useCallback } from 'react';
import type { LayoutEntry } from '@/core/types';
import { LayoutThumbnail } from '@/shell/LayoutThumbnail';
import { LayoutActions } from '../LayoutActions';
import { useInlineEdit } from '../useInlineEdit';
import { useTranslation, useFormatting } from '@/i18n';

interface LayoutListItemProps {
  entry: LayoutEntry;
  isActive: boolean;
  isFocused: boolean;
  isOnlyLayout: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onDownload: () => void;
  onFocus: () => void;
  itemRef?: (el: HTMLDivElement | null) => void;
}

/**
 * Single layout row in the layout list.
 * Displays thumbnail, name (with inline editing), metadata, and action buttons.
 */
export function LayoutListItem({
  entry,
  isActive,
  isFocused,
  isOnlyLayout,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onCopyLink,
  onDownload,
  onFocus,
  itemRef,
}: LayoutListItemProps) {
  const t = useTranslation();
  const { formatRelativeDate } = useFormatting();

  const {
    isEditing,
    editingValue,
    inputRef,
    startEditing,
    handleChange,
    handleFinish,
    handleKeyDown,
  } = useInlineEdit({
    initialValue: entry.name,
    onSave: onRename,
  });

  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditing) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    },
    [isEditing, onSelect]
  );

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isActive}
      aria-current={isActive ? 'true' : undefined}
      tabIndex={isFocused ? 0 : -1}
      className={`
        w-full text-left p-3 rounded-lg border-2 transition-colors cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset
        ${
          isActive
            ? 'border-accent bg-accent-muted/30'
            : 'border-stroke bg-surface-secondary hover:border-accent/50'
        }
      `}
      onClick={() => !isEditing && onSelect()}
      onKeyDown={handleItemKeyDown}
      onFocus={onFocus}
    >
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          <LayoutThumbnail preview={entry.preview} size={56} />
        </div>

        {/* Name and Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editingValue}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleFinish}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-surface px-2 py-1 rounded border border-stroke focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none text-content text-sm"
              maxLength={64}
              aria-label={t('layouts.layoutName')}
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-content text-sm truncate">{entry.name}</span>
              {isActive && (
                <span
                  className="text-xs px-1.5 py-0.5 bg-accent text-on-dark rounded flex-shrink-0 font-medium"
                  aria-label={t('layouts.currentlyActiveLayout')}
                >
                  {t('layouts.active')}
                </span>
              )}
            </div>
          )}

          {/* Preview Info */}
          <div className="mt-0.5 text-xs text-content-secondary flex flex-wrap gap-x-3 gap-y-0.5">
            <span>
              {entry.preview.drawerWidth}×{entry.preview.drawerDepth}×{entry.preview.drawerHeight}
            </span>
            <span>{t('layouts.binCount', { count: entry.preview.binCount })}</span>
            <span className="text-content-tertiary">
              {formatRelativeDate(entry.modifiedAt, false)}
            </span>
          </div>

          {/* Forked From */}
          {entry.forkedFrom && (
            <div className="mt-0.5 text-xs text-content-tertiary">
              {t('layouts.forkedFromName', { name: entry.forkedFrom.name })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0">
          <LayoutActions
            entry={entry}
            isOnlyLayout={isOnlyLayout}
            onCopyLink={onCopyLink}
            onDownload={onDownload}
            onRename={startEditing}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
