import { useCallback } from 'react';
import type { LayoutEntry } from '@/core/types';
import { LayoutThumbnail } from '@/components/LayoutThumbnail';
import { LayoutActions } from './LayoutActions';
import { useInlineEdit } from './useInlineEdit';
import { useTranslation, useFormatting } from '@/i18n';

interface LayoutGridItemProps {
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
  onSuggestName?: () => void;
  onFocus: () => void;
  itemRef?: (el: HTMLDivElement | null) => void;
}

/**
 * Grid card view for a layout in the layout manager.
 * Shows larger thumbnail with name and metadata below.
 */
export function LayoutGridItem({
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
  onSuggestName,
  onFocus,
  itemRef,
}: LayoutGridItemProps) {
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
      data-layout-card
      className={`
        group w-full text-left rounded-lg overflow-hidden
        border-2 transition-colors cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary
        ${isActive ? 'border-accent' : 'border-transparent hover:border-accent/50'}
      `}
      onClick={() => !isEditing && onSelect()}
      onKeyDown={handleItemKeyDown}
      onFocus={onFocus}
    >
      {/* Thumbnail - landscape aspect keeps cards short and uniform */}
      <div className="aspect-[4/3] relative flex items-center justify-center bg-surface-elevated">
        <LayoutThumbnail
          preview={entry.preview}
          size={180}
          showLabels
          className="max-w-full max-h-full"
        />
        {/* Active badge */}
        {isActive && (
          <span
            className="absolute top-1.5 right-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-dark"
            aria-label={t('layouts.currentlyActiveLayout')}
          >
            {t('layouts.active')}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-2 py-1.5 bg-surface-secondary">
        {/* Title */}
        <div className="min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editingValue}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleFinish}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-surface px-1.5 py-0.5 rounded border border-stroke focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none text-content text-sm"
              maxLength={64}
              aria-label={t('layouts.layoutName')}
            />
          ) : (
            <h3
              className="font-medium text-content text-sm leading-tight line-clamp-1"
              title={entry.name}
            >
              {entry.name}
            </h3>
          )}
        </div>

        {/* Metadata */}
        <p className="text-xs text-content-secondary mt-0.5">
          {entry.preview.binCount} {t('layouts.bins')} · {entry.preview.drawerWidth}×
          {entry.preview.drawerDepth}
        </p>

        {/* Date and actions row */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-content-tertiary">
            {formatRelativeDate(entry.modifiedAt, false)}
          </span>

          <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
            <LayoutActions
              entry={entry}
              isOnlyLayout={isOnlyLayout}
              isActive={isActive}
              onCopyLink={onCopyLink}
              onDownload={onDownload}
              onRename={startEditing}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onSuggestName={onSuggestName}
            />
          </div>
        </div>

        {/* Forked From */}
        {entry.forkedFrom && (
          <div className="text-[10px] text-content-tertiary truncate mt-0.5">
            {t('layouts.forkedFromName', { name: entry.forkedFrom.name })}
          </div>
        )}
      </div>
    </div>
  );
}
