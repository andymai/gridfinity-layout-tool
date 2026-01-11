import { useState, useRef, useCallback } from 'react';
import type { LayoutEntry, Layout } from '../../../types';
import { LayoutListItem } from './LayoutListItem';
import { useLayoutStore } from '../../../store/layout';
import { loadLayoutById, downloadLayoutAsFile, generateShareableURL, copyToClipboard } from '../../../utils/storage';
import { useUIStore } from '../../../store/ui';

/** Threshold for showing search bar */
const SEARCH_THRESHOLD = 6;

interface LayoutListProps {
  entries: LayoutEntry[];
  activeLayoutId: string | null;
  onSwitch: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

/**
 * Layout list with search, keyboard navigation, and actions.
 */
export function LayoutList({
  entries,
  activeLayoutId,
  onSwitch,
  onRename,
  onDuplicate,
  onDelete,
  onCreate,
}: LayoutListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const currentLayout = useLayoutStore((state) => state.layout);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  const showSearch = entries.length >= SEARCH_THRESHOLD;

  // Filter and sort entries: active first, then by modifiedAt descending
  const sortedEntries = [...entries]
    .filter((entry) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return entry.name.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (a.id === activeLayoutId) return -1;
      if (b.id === activeLayoutId) return 1;
      return b.modifiedAt - a.modifiedAt;
    });

  // Handle search input change - reset focus to first item
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setFocusedIndex(0);
  }, []);

  // Handle keyboard navigation within list
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.min(focusedIndex + 1, sortedEntries.length - 1);
        setFocusedIndex(newIndex);
        const entry = sortedEntries[newIndex];
        if (entry) {
          itemRefs.current.get(entry.id)?.focus();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(newIndex);
        const entry = sortedEntries[newIndex];
        if (entry) {
          itemRefs.current.get(entry.id)?.focus();
        }
      }
    },
    [focusedIndex, sortedEntries]
  );

  const getLayoutData = useCallback(
    (id: string): Layout | null => {
      // For active layout, use current state; otherwise load from storage
      return id === activeLayoutId ? currentLayout : loadLayoutById(id);
    },
    [activeLayoutId, currentLayout]
  );

  const handleCopyLink = useCallback(
    async (entry: LayoutEntry) => {
      const layout = getLayoutData(entry.id);
      if (layout) {
        const url = generateShareableURL(layout);
        const success = await copyToClipboard(url);
        if (success) {
          announceToScreenReader(`Link copied for ${entry.name}`);
        }
      }
    },
    [getLayoutData, announceToScreenReader]
  );

  const handleDownload = useCallback(
    (entry: LayoutEntry) => {
      const layout = getLayoutData(entry.id);
      if (layout) {
        downloadLayoutAsFile(layout, `${entry.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`);
        announceToScreenReader('Layout downloaded');
      }
    },
    [getLayoutData, announceToScreenReader]
  );

  const handleSwitch = useCallback(
    (id: string) => {
      if (id !== activeLayoutId) {
        onSwitch(id);
      }
    },
    [activeLayoutId, onSwitch]
  );

  const handleRename = useCallback(
    (id: string, newName: string) => {
      onRename(id, newName);
      announceToScreenReader(`Layout renamed to ${newName}`);
    },
    [onRename, announceToScreenReader]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      onDuplicate(id);
      announceToScreenReader(`Duplicated ${entry?.name || 'layout'}`);
    },
    [entries, onDuplicate, announceToScreenReader]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      onDelete(id);
      announceToScreenReader(`${entry?.name || 'Layout'} deleted`);
    },
    [entries, onDelete, announceToScreenReader]
  );

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto]">
      {/* Header: Create Button + Search */}
      <div className="space-y-4 pb-4">
        <button
          onClick={onCreate}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Layout
        </button>

        {/* Search (appears with 6+ layouts) */}
        {showSearch && (
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search layouts..."
              className="w-full pl-9 pr-8 py-2 bg-surface border border-stroke rounded-lg text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:border-blue-500"
              aria-label="Search layouts"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-tertiary hover:text-content"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Layout List */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Available layouts"
        aria-activedescendant={sortedEntries[focusedIndex]?.id}
        className="overflow-y-auto space-y-2 min-h-0"
        onKeyDown={handleListKeyDown}
      >
        {sortedEntries.length === 0 && searchQuery && (
          <div className="text-center py-12 text-content-tertiary">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p>No layouts match "{searchQuery}"</p>
          </div>
        )}

        {sortedEntries.length === 0 && !searchQuery && (
          <div className="text-center py-12 text-content-tertiary">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>No layouts yet</p>
            <p className="text-sm mt-1">Create your first layout to get started</p>
          </div>
        )}

        {sortedEntries.map((entry, index) => (
          <LayoutListItem
            key={entry.id}
            entry={entry}
            isActive={entry.id === activeLayoutId}
            isFocused={index === focusedIndex}
            isOnlyLayout={entries.length <= 1}
            onSelect={() => handleSwitch(entry.id)}
            onRename={(newName) => handleRename(entry.id, newName)}
            onDuplicate={() => handleDuplicate(entry.id)}
            onDelete={() => handleDelete(entry.id)}
            onCopyLink={() => handleCopyLink(entry)}
            onDownload={() => handleDownload(entry)}
            onFocus={() => setFocusedIndex(index)}
            itemRef={(el) => {
              if (el) itemRefs.current.set(entry.id, el);
              else itemRefs.current.delete(entry.id);
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-stroke text-sm text-content-tertiary">
        {entries.length} layout{entries.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}
