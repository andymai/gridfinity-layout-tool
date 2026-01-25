import { useState, useRef, useEffect, useCallback } from 'react';
import type { LayoutEntry } from '@/core/types';
import { LayoutThumbnail } from '@/components/LayoutThumbnail';
import { LayoutActions } from './LayoutActions';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartRename = useCallback(() => {
    setEditingName(entry.name);
    setIsEditing(true);
  }, [entry.name]);

  const handleFinishRename = useCallback(() => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== entry.name) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editingName, entry.name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFinishRename();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditingName(entry.name);
      }
    },
    [handleFinishRename, entry.name]
  );

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
        w-full text-left p-3 rounded-lg border transition-colors cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset
        ${
          isActive
            ? 'bg-accent-muted border-accent'
            : 'bg-surface-secondary border-transparent hover:border-stroke-subtle hover:bg-surface'
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
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleFinishRename}
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
                >{t('layouts.active')}</span>
              )}
            </div>
          )}

          {/* Preview Info */}
          <div className="mt-0.5 text-xs text-content-secondary flex flex-wrap gap-x-3 gap-y-0.5">
            <span>
              {entry.preview.drawerWidth}×{entry.preview.drawerDepth}×{entry.preview.drawerHeight}
            </span>
            <span>{t('layouts.binCount', { count: entry.preview.binCount })}</span>
            <span className="text-content-tertiary">{formatRelativeDate(entry.modifiedAt, false)}</span>
          </div>

          {/* Forked From */}
          {entry.forkedFrom && (
            <div className="mt-0.5 text-xs text-content-tertiary">{t('layouts.forkedFrom')}{entry.forkedFrom.name}
              {entry.forkedFrom.author && ` by ${entry.forkedFrom.author}`}
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
            onRename={handleStartRename}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
