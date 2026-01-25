import { useCallback } from 'react';
import type { SharedWithMeEntry } from '@/core/types';
import { LayoutThumbnail } from '@/components/LayoutThumbnail';
import { useTranslation, useFormatting } from '@/i18n';

interface SharedWithMeItemProps {
  entry: SharedWithMeEntry;
  isFocused: boolean;
  isLoading: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onFocus: () => void;
  itemRef?: (el: HTMLDivElement | null) => void;
}

/**
 * Single shared layout row in the "Shared with me" list.
 * Displays thumbnail, name, author, permission badge, and actions.
 */
export function SharedWithMeItem({
  entry,
  isFocused,
  isLoading,
  onOpen,
  onRemove,
  onFocus,
  itemRef,
}: SharedWithMeItemProps) {
  const t = useTranslation();
  const { formatRelativeDate } = useFormatting();
  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isLoading && entry.status !== 'deleted') {
          onOpen();
        }
      }
    },
    [isLoading, entry.status, onOpen]
  );

  const isDeleted = entry.status === 'deleted';

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={false}
      tabIndex={isFocused ? 0 : -1}
      className={`
        w-full text-left p-3 rounded-lg border transition-colors cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset
        ${
          isDeleted
            ? 'bg-surface-secondary border-transparent opacity-60'
            : 'bg-surface-secondary border-transparent hover:border-stroke-subtle hover:bg-surface'
        }
      `}
      onClick={() => !isLoading && !isDeleted && onOpen()}
      onKeyDown={handleItemKeyDown}
      onFocus={onFocus}
    >
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {entry.preview ? (
            <LayoutThumbnail preview={entry.preview} size={56} />
          ) : (
            <div
              className="bg-surface rounded flex items-center justify-center text-content-tertiary"
              style={{ width: 56, height: 56 }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Name and Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium text-sm truncate ${isDeleted ? 'text-content-secondary line-through' : 'text-content'}`}
            >
              {entry.name}
            </span>

            {/* Permission badge */}
            <span
              className={`
              text-xs px-1.5 py-0.5 rounded flex-shrink-0
              ${
                entry.permission === 'edit'
                  ? 'bg-success-muted text-success'
                  : 'bg-surface text-content-secondary'
              }
            `}
            >
              {entry.permission === 'edit' ? t('layouts.canEdit') : t('layouts.viewOnly')}
            </span>

            {/* Deleted badge */}
            {isDeleted && (
              <span className="text-xs px-1.5 py-0.5 bg-error/20 text-error rounded flex-shrink-0">
                {t('layouts.deleted')}
              </span>
            )}
          </div>

          {/* Metadata */}
          <div className="mt-0.5 text-xs text-content-secondary flex flex-wrap gap-x-3 gap-y-0.5">
            {entry.authorName && <span>{t('layouts.sharedBy', { name: entry.authorName })}</span>}
            {entry.preview && (
              <span>
                {entry.preview.drawerWidth}×{entry.preview.drawerDepth}×{entry.preview.drawerHeight}
              </span>
            )}
            <span className="text-content-tertiary">
              {t('layouts.accessed')} {formatRelativeDate(entry.lastAccessedAt, false)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {/* Open button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            disabled={isLoading || isDeleted}
            className={`
              p-2 rounded transition-colors
              ${
                isLoading || isDeleted
                  ? 'text-content-tertiary cursor-not-allowed'
                  : 'text-content-secondary hover:text-content hover:bg-surface'
              }
            `}
            title={isDeleted ? t('layouts.layoutDeleted') : t('layouts.openLayout')}
            aria-label={isDeleted ? t('layouts.layoutDeleted') : t('layouts.openLayout')}
          >
            {isLoading ? (
              <svg
                className="w-4 h-4 animate-spin motion-reduce:animate-none"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            )}
          </button>

          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-2 rounded text-content-secondary hover:text-error hover:bg-surface transition-colors"
            title={t('layouts.removeFromList')}
            aria-label={t('layouts.removeFromList')}
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
        </div>
      </div>
    </div>
  );
}
