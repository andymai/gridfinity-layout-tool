import { useState, useRef, useCallback, useEffect } from 'react';
import type { SharedWithMeEntry } from '../../../core/types';
import { useSharedWithMe } from '../../../hooks/useSharedWithMe';
import { SharedWithMeItem } from './SharedWithMeItem';

interface SharedWithMeListProps {
  onOpenLayout: () => void; // Called after successfully opening a layout (to close modal)
}

/**
 * List of layouts shared with the current user.
 * Displays shared layouts sorted by last access time.
 */
export function SharedWithMeList({ onOpenLayout }: SharedWithMeListProps) {
  const { sharedWithMe, isLoaded, status, openSharedLayout, removeSharedLayout } = useSharedWithMe();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loadingEntryId, setLoadingEntryId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  // Sort by last accessed (most recent first)
  const sortedEntries = [...sharedWithMe].sort(
    (a, b) => b.lastAccessedAt - a.lastAccessedAt
  );

  // Derive valid focused index (clamp to list bounds)
  const validFocusedIndex = Math.min(
    focusedIndex,
    Math.max(0, sortedEntries.length - 1)
  );

  const handleOpen = useCallback(
    async (entry: SharedWithMeEntry) => {
      setLoadingEntryId(entry.id);
      const success = await openSharedLayout(entry);
      setLoadingEntryId(null);

      if (success) {
        onOpenLayout();
      }
    },
    [openSharedLayout, onOpenLayout]
  );

  const handleRemove = useCallback(
    (id: string) => {
      removeSharedLayout(id);
    },
    [removeSharedLayout]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = sortedEntries.length - 1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, maxIndex));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(maxIndex);
          break;
      }
    },
    [sortedEntries.length]
  );

  // Scroll focused item into view
  useEffect(() => {
    const el = itemRefs.current.get(validFocusedIndex);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [validFocusedIndex]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-content-secondary">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (sortedEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-surface flex items-center justify-center">
          <svg className="w-8 h-8 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-content mb-2">No shared layouts yet</h3>
        <p className="text-sm text-content-secondary max-w-sm">
          When someone shares a layout with you, it will appear here automatically.
          Open a shared link to get started.
        </p>
      </div>
    );
  }

  // Error state for status
  const showError = status === 'error';

  return (
    <div className="flex flex-col gap-2">
      {showError && (
        <div className="mb-2 p-3 rounded-lg bg-error/10 text-error text-sm">
          Failed to open layout. Please try again.
        </div>
      )}

      <div
        ref={listRef}
        role="listbox"
        aria-label="Shared layouts"
        className="flex flex-col gap-2"
        onKeyDown={handleKeyDown}
      >
        {sortedEntries.map((entry, index) => (
          <SharedWithMeItem
            key={entry.id}
            entry={entry}
            isFocused={index === validFocusedIndex}
            isLoading={loadingEntryId === entry.id}
            onOpen={() => handleOpen(entry)}
            onRemove={() => handleRemove(entry.id)}
            onFocus={() => setFocusedIndex(index)}
            itemRef={(el) => itemRefs.current.set(index, el)}
          />
        ))}
      </div>

      {/* Count summary */}
      <div className="mt-2 text-xs text-content-tertiary text-center">
        {sortedEntries.length} shared layout{sortedEntries.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
