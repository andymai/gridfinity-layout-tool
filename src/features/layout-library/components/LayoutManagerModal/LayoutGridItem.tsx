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
        group w-full text-left bg-surface-secondary rounded-lg p-2
        border-2 transition-colors cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        ${isActive ? 'border-accent' : 'border-transparent hover:border-accent/50'}
      `}
      onClick={() => !isEditing && onSelect()}
      onKeyDown={handleItemKeyDown}
      onFocus={onFocus}
    >
      {/* Thumbnail - portrait aspect like inspiration gallery */}
      <div className="aspect-[3/4] bg-surface rounded overflow-hidden mb-2 flex items-center justify-center relative p-2">
        <LayoutThumbnail
          preview={entry.preview}
          size={160}
          showLabels
          className="max-w-full max-h-full"
        />
        {/* Active badge - top right corner (matches inspiration gallery theme badge) */}
        {isActive && (
          <span
            className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full bg-accent text-on-dark font-medium"
            aria-label={t('layouts.currentlyActiveLayout')}
          >
            {t('layouts.active')}
          </span>
        )}
      </div>

      {/* Title */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editingValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleFinish}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-surface px-2 py-1 rounded border border-stroke focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none text-content text-sm mb-0.5"
          maxLength={64}
          aria-label={t('layouts.layoutName')}
        />
      ) : (
        <h3
          className="font-medium text-content text-base leading-tight line-clamp-1"
          title={entry.name}
        >
          {entry.name}
        </h3>
      )}

      {/* Metadata row - matches inspiration gallery format */}
      <div className="flex items-center mt-0.5">
        <span className="text-sm text-content-tertiary">
          {entry.preview.binCount} {t('layouts.bins')} · {entry.preview.drawerWidth}×
          {entry.preview.drawerDepth}
        </span>
      </div>

      {/* Modified date */}
      <div className="text-sm text-content-tertiary mt-0.5">
        {formatRelativeDate(entry.modifiedAt, false)}
      </div>

      {/* Forked From */}
      {entry.forkedFrom && (
        <div className="text-xs text-content-tertiary truncate mt-0.5">
          {t('layouts.forkedFromName', { name: entry.forkedFrom.name })}
        </div>
      )}

      {/* Action Buttons - positioned at bottom */}
      <div className="mt-1.5 flex justify-end" onClick={(e) => e.stopPropagation()}>
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
  );
}
