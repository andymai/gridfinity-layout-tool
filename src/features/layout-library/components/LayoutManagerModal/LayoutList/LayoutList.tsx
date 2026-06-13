import { useState, useRef, useCallback, useMemo } from 'react';
import type { LayoutEntry, Layout } from '@/core/types';
import { LayoutListItem } from '../LayoutListItem';
import { LayoutGridItem } from '../LayoutGridItem';
import { useLayoutStore } from '@/core/store/layout';
import { loadLayoutAsync, downloadLayoutAsFile } from '@/core/storage';
import { useInteractionStore } from '@/core/store/interaction';
import { useTranslation } from '@/i18n';
import { ViewModeToggle } from '../ViewModeToggle';
import type { ViewMode } from '../ViewModeToggle';
import type { SortOption } from '../index';
import { IconButton, XIcon } from '@/design-system';

/** Threshold for showing search bar */
const SEARCH_THRESHOLD = 6;

interface LayoutListProps {
  entries: LayoutEntry[];
  activeLayoutId: string | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showViewToggle: boolean;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  onSwitch: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
}

/**
 * Layout list with search, keyboard navigation, and actions.
 */
export function LayoutList({
  entries,
  activeLayoutId,
  viewMode,
  sortBy,
  onSwitch,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
  onViewModeChange,
  showViewToggle,
  onSortChange,
}: LayoutListProps) {
  const t = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const currentLayout = useLayoutStore((state) => state.layout);
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

  const showSearch = entries.length >= SEARCH_THRESHOLD;

  // Filter and sort entries based on sortBy option
  const sortedEntries = useMemo(
    () =>
      [...entries]
        .filter((entry) => {
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          return entry.name.toLowerCase().includes(query);
        })
        .sort((a, b) => {
          // Active layout always first
          if (a.id === activeLayoutId) return -1;
          if (b.id === activeLayoutId) return 1;

          switch (sortBy) {
            case 'name':
              return a.name.localeCompare(b.name);
            case 'size': {
              const aSize = a.preview.drawerWidth * a.preview.drawerDepth;
              const bSize = b.preview.drawerWidth * b.preview.drawerDepth;
              return bSize - aSize;
            }
            case 'binCount':
              return b.preview.binCount - a.preview.binCount;
            case 'recent':
            default:
              return b.modifiedAt - a.modifiedAt;
          }
        }),
    [entries, searchQuery, activeLayoutId, sortBy]
  );

  // Handle search input change - reset focus to first item
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setFocusedIndex(0);
  }, []);

  // Calculate grid columns dynamically
  const getGridColumns = useCallback(() => {
    if (viewMode === 'list' || !gridRef.current) return 1;
    const style = window.getComputedStyle(gridRef.current);
    const columns = style.gridTemplateColumns.split(' ').length;
    return Math.max(1, columns);
  }, [viewMode]);

  // Handle keyboard navigation within list/grid
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = sortedEntries.length;
      if (totalItems === 0) return;

      const cols = getGridColumns();
      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (viewMode === 'grid') {
            newIndex = Math.min(focusedIndex + cols, totalItems - 1);
          } else {
            newIndex = Math.min(focusedIndex + 1, totalItems - 1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (viewMode === 'grid') {
            newIndex = Math.max(focusedIndex - cols, 0);
          } else {
            newIndex = Math.max(focusedIndex - 1, 0);
          }
          break;
        case 'ArrowRight':
          if (viewMode === 'grid') {
            e.preventDefault();
            newIndex = Math.min(focusedIndex + 1, totalItems - 1);
          }
          break;
        case 'ArrowLeft':
          if (viewMode === 'grid') {
            e.preventDefault();
            newIndex = Math.max(focusedIndex - 1, 0);
          }
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = totalItems - 1;
          break;
        default:
          return;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        const entry = sortedEntries[newIndex];
        itemRefs.current.get(entry.id)?.focus();
      }
    },
    [focusedIndex, sortedEntries, viewMode, getGridColumns]
  );

  const getLayoutData = useCallback(
    async (id: string): Promise<Layout | null> => {
      // For active layout, use current state; otherwise load from IndexedDB
      return id === activeLayoutId ? currentLayout : loadLayoutAsync(id);
    },
    [activeLayoutId, currentLayout]
  );

  const handleDownload = useCallback(
    async (entry: LayoutEntry) => {
      const layout = await getLayoutData(entry.id);
      if (layout) {
        await downloadLayoutAsFile(
          layout,
          `${entry.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
        );
        announceToScreenReader(t('layouts.announce.downloaded'));
      }
    },
    [getLayoutData, announceToScreenReader, t]
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
      announceToScreenReader(t('layouts.announce.renamedTo', { name: newName }));
    },
    [onRename, announceToScreenReader, t]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      onDuplicate(id);
      announceToScreenReader(
        t('layouts.announce.duplicated', {
          name: entry?.name || t('layouts.announce.fallbackName'),
        })
      );
    },
    [entries, onDuplicate, announceToScreenReader, t]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      onDelete(id);
      announceToScreenReader(
        t('layouts.announce.deleted', {
          name: entry?.name || t('layouts.announce.fallbackNameCapitalized'),
        })
      );
    },
    [entries, onDelete, announceToScreenReader, t]
  );

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto]">
      {/* Header: Search */}
      <div className="space-y-4 pb-4">
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('layouts.searchPlaceholder')}
              className="w-full pl-9 pr-8 py-2 bg-surface border border-stroke rounded-lg text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              aria-label={t('layouts.searchLayouts')}
            />
            {searchQuery && (
              <IconButton
                size="sm"
                touchTarget={false}
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-content-tertiary hover:bg-transparent hover:text-content"
                aria-label={t('layouts.clearSearch')}
              >
                <XIcon className="w-4 h-4" />
              </IconButton>
            )}
          </div>
        )}
      </div>

      {/* Empty States */}
      {sortedEntries.length === 0 && searchQuery && (
        <div className="text-center py-12 text-content-tertiary">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p>{t('layouts.noLayoutsMatch', { query: searchQuery })}</p>
        </div>
      )}

      {sortedEntries.length === 0 && !searchQuery && (
        <div className="text-center py-12 text-content-tertiary">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p>{t('layouts.noLayoutsYet')}</p>
          <p className="text-sm mt-1">{t('layouts.createYourFirstLayoutToGetStarted')}</p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && sortedEntries.length > 0 && (
        <div
          ref={gridRef}
          role="listbox"
          tabIndex={0}
          aria-label={t('layouts.availableLayouts')}
          className="overflow-y-auto min-h-0 [scrollbar-gutter:stable] grid grid-cols-[repeat(auto-fill,minmax(225px,1fr))] gap-3 content-start"
          onKeyDown={handleListKeyDown}
        >
          {sortedEntries.map((entry, index) => (
            <LayoutGridItem
              key={entry.id}
              entry={entry}
              isActive={entry.id === activeLayoutId}
              isFocused={index === focusedIndex}
              isOnlyLayout={entries.length <= 1}
              onSelect={() => handleSwitch(entry.id)}
              onRename={(newName) => handleRename(entry.id, newName)}
              onDuplicate={() => handleDuplicate(entry.id)}
              onDelete={() => handleDelete(entry.id)}
              onCopyLink={() => onShare(entry.id)}
              onDownload={() => handleDownload(entry)}
              onFocus={() => setFocusedIndex(index)}
              itemRef={(el) => {
                if (el) itemRefs.current.set(entry.id, el);
                else itemRefs.current.delete(entry.id);
              }}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && sortedEntries.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label={t('layouts.availableLayouts')}
          aria-activedescendant={sortedEntries[focusedIndex]?.id}
          className="overflow-y-auto space-y-2 min-h-0 [scrollbar-gutter:stable]"
          onKeyDown={handleListKeyDown}
        >
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
              onCopyLink={() => onShare(entry.id)}
              onDownload={() => handleDownload(entry)}
              onFocus={() => setFocusedIndex(index)}
              itemRef={(el) => {
                if (el) itemRefs.current.set(entry.id, el);
                else itemRefs.current.delete(entry.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-stroke text-sm text-content-tertiary flex items-center justify-between">
        <span>{t('layouts.layoutCount', { count: entries.length })}</span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="appearance-none pl-3 pr-8 py-1.5 bg-surface border border-stroke rounded-lg text-sm text-content focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer"
              aria-label={t('layouts.sortBy')}
            >
              <option value="recent">{t('layouts.sortRecent')}</option>
              <option value="name">{t('layouts.sortName')}</option>
              <option value="size">{t('layouts.sortSize')}</option>
              <option value="binCount">{t('layouts.sortBinCount')}</option>
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
          {showViewToggle && <ViewModeToggle value={viewMode} onChange={onViewModeChange} />}
        </div>
      </div>
    </div>
  );
}
