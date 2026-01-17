import { useState, useRef, useEffect, useCallback } from 'react';
import type { LayoutEntry } from '../../../../core/types';
import { LayoutThumbnail } from '../../../../components/LayoutThumbnail';
import { LayoutActions } from './LayoutActions';

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditingName(entry.name);
    }
  }, [handleFinishRename, entry.name]);

  const handleItemKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  }, [isEditing, onSelect]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isActive}
      aria-current={isActive ? 'true' : undefined}
      tabIndex={isFocused ? 0 : -1}
      className={`
        w-full text-left p-3 rounded-lg border transition-colors cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset
        ${isActive
          ? 'bg-blue-900/30 border-blue-500'
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
              className="w-full bg-surface px-2 py-1 rounded border border-stroke focus:border-blue-500 focus:outline-none text-content text-sm"
              maxLength={64}
              aria-label="Layout name"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-content text-sm truncate">
                {entry.name}
              </span>
              {isActive && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded flex-shrink-0" aria-label="Currently active layout">
                  Active
                </span>
              )}
            </div>
          )}

          {/* Preview Info */}
          <div className="mt-0.5 text-xs text-content-secondary flex flex-wrap gap-x-3 gap-y-0.5">
            <span>
              {entry.preview.drawerWidth}×{entry.preview.drawerDepth}×{entry.preview.drawerHeight}
            </span>
            <span>{entry.preview.binCount} bins</span>
            <span className="text-content-tertiary">
              {formatDate(entry.modifiedAt)}
            </span>
          </div>

          {/* Forked From */}
          {entry.forkedFrom && (
            <div className="mt-0.5 text-xs text-content-tertiary">
              Forked from {entry.forkedFrom.name}
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
