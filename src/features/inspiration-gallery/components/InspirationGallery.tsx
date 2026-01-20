import { useState, useEffect, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useResponsive } from '@/shared/hooks';
import { useLayoutSwitcher } from '@/features/layout-library/hooks/useLayoutSwitcher';
import { useUIStore } from '@/core/store/ui';
import { useToastStore } from '@/core/store/toast';
import { isOk } from '@/core/result';
import { INSPIRATION_LAYOUTS, getLayoutsByTheme } from '../data/inspirationLayouts';
import { THEME_CONFIG } from '../types';
import type { InspirationLayout, InspirationTheme } from '../types';
import { ThemeFilterPills } from './ThemeFilterPills';
import { LayoutCard } from './LayoutCard';
import { LayoutPreviewOverlay } from './LayoutPreviewOverlay';

type SortOption = 'default' | 'bins-desc' | 'bins-asc' | 'size-desc' | 'size-asc';

const SEARCH_SUGGESTIONS = ['screwdriver', 'utensils', 'cables', 'craft', 'sockets'];

interface InspirationGalleryProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Wrapper component that only mounts content when open (fresh state pattern).
 */
export function InspirationGallery({ isOpen, onClose }: InspirationGalleryProps) {
  if (!isOpen) return null;
  return <InspirationGalleryContent onClose={onClose} />;
}

function InspirationGalleryContent({ onClose }: { onClose: () => void }) {
  const { isMobile } = useResponsive();
  const [selectedTheme, setSelectedTheme] = useState<InspirationTheme | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [previewLayout, setPreviewLayout] = useState<InspirationLayout | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { importLayoutFromJSON, switchLayout, createNewLayout } = useLayoutSwitcher();
  const { announceToScreenReader, closeMobilePanel } = useUIStore(
    useShallow((state) => ({
      announceToScreenReader: state.announceToScreenReader,
      closeMobilePanel: state.closeMobilePanel,
    }))
  );
  const addToast = useToastStore((state) => state.addToast);

  // Filter by search query first (to get accurate theme counts)
  const searchFilteredLayouts = searchQuery.trim()
    ? INSPIRATION_LAYOUTS.filter((layout) => {
        const query = searchQuery.toLowerCase();
        return (
          layout.name.toLowerCase().includes(query) ||
          layout.description.toLowerCase().includes(query) ||
          layout.shortDescription.toLowerCase().includes(query) ||
          layout.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          layout.layout.bins.some((bin) => bin.label.toLowerCase().includes(query))
        );
      })
    : INSPIRATION_LAYOUTS;

  // Then filter by theme
  const themeFilteredLayouts = selectedTheme === 'all'
    ? searchFilteredLayouts
    : searchFilteredLayouts.filter((l) => l.theme === selectedTheme);

  // Apply sorting
  const sortedLayouts = [...themeFilteredLayouts].sort((a, b) => {
    switch (sortBy) {
      case 'bins-desc':
        return b.metrics.binCount - a.metrics.binCount;
      case 'bins-asc':
        return a.metrics.binCount - b.metrics.binCount;
      case 'size-desc':
        return (b.metrics.drawerSize.width * b.metrics.drawerSize.depth) -
               (a.metrics.drawerSize.width * a.metrics.drawerSize.depth);
      case 'size-asc':
        return (a.metrics.drawerSize.width * a.metrics.drawerSize.depth) -
               (b.metrics.drawerSize.width * b.metrics.drawerSize.depth);
      default:
        return 0;
    }
  });

  const filteredLayouts = sortedLayouts;

  // Count layouts per theme based on search results (not total)
  const themeCounts = {
    all: searchFilteredLayouts.length,
    kitchen: searchFilteredLayouts.filter((l) => l.theme === 'kitchen').length,
    workshop: searchFilteredLayouts.filter((l) => l.theme === 'workshop').length,
    office: searchFilteredLayouts.filter((l) => l.theme === 'office').length,
    hobby: searchFilteredLayouts.filter((l) => l.theme === 'hobby').length,
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewLayout) {
          setPreviewLayout(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, previewLayout]);

  // Focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
    announceToScreenReader(
      `Inspiration Gallery opened. ${INSPIRATION_LAYOUTS.length} layouts available. Use arrow keys to navigate.`
    );
  }, [announceToScreenReader]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleThemeChange = useCallback(
    (theme: InspirationTheme | 'all') => {
      setSelectedTheme(theme);
      const count = theme === 'all' ? INSPIRATION_LAYOUTS.length : getLayoutsByTheme(theme).length;
      const label = theme === 'all' ? 'all themes' : THEME_CONFIG[theme].label;
      announceToScreenReader(`Showing ${count} ${label} layouts`);
    },
    [announceToScreenReader]
  );

  const handleSelectLayout = useCallback((layout: InspirationLayout) => {
    setPreviewLayout(layout);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewLayout(null);
  }, []);

  // Quick use - directly add layout without preview
  const handleQuickUse = useCallback(async (layout: InspirationLayout) => {
    if (isImporting) return;

    setIsImporting(true);
    try {
      const result = await importLayoutFromJSON(
        { ...layout.layout, name: layout.name },
        { name: layout.name, author: 'Gridfinity Templates' }
      );

      if (isOk(result)) {
        await switchLayout(result.value);
        addToast(`Added "${layout.name}"`, 'success');
        announceToScreenReader(`${layout.name} added to your library`);
        closeMobilePanel();
        onClose();
      } else {
        addToast('Failed to add layout', 'error');
      }
    } finally {
      setIsImporting(false);
    }
  }, [isImporting, importLayoutFromJSON, switchLayout, addToast, announceToScreenReader, closeMobilePanel, onClose]);

  const handleUseLayout = useCallback(async () => {
    if (!previewLayout || isImporting) return;
    await handleQuickUse(previewLayout);
  }, [previewLayout, isImporting, handleQuickUse]);

  // Start fresh - create blank layout
  const handleStartFresh = useCallback(async () => {
    const result = await createNewLayout();
    if (isOk(result)) {
      addToast('New layout created', 'success');
      announceToScreenReader('New blank layout created');
      closeMobilePanel();
      onClose();
    }
  }, [createNewLayout, addToast, announceToScreenReader, closeMobilePanel, onClose]);

  // Keyboard navigation for grid
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!gridRef.current) return;

    const cards = gridRef.current.querySelectorAll('[data-layout-card]');
    const cardCount = cards.length;
    if (cardCount === 0) return;

    // Calculate grid columns based on viewport
    const gridComputedStyle = window.getComputedStyle(gridRef.current);
    const cols = gridComputedStyle.gridTemplateColumns.split(' ').length;

    let newIndex = focusedCardIndex;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = Math.min(focusedCardIndex + 1, cardCount - 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = Math.max(focusedCardIndex - 1, 0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newIndex = Math.min(focusedCardIndex + cols, cardCount - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = Math.max(focusedCardIndex - cols, 0);
        break;
      default:
        return;
    }

    if (newIndex !== focusedCardIndex && newIndex >= 0) {
      setFocusedCardIndex(newIndex);
      (cards[newIndex] as HTMLElement)?.focus();
    }
  }, [focusedCardIndex]);

  // Responsive grid columns - 2 cols on mobile for better density
  const gridCols = isMobile
    ? 'grid-cols-2'
    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspiration-gallery-title"
        className={`
          fixed z-50 bg-surface-elevated flex flex-col animate-scale-in
          ${isMobile
            ? 'inset-x-0 bottom-0 rounded-t-2xl max-h-[85dvh]'
            : 'inset-4 md:inset-8 lg:inset-12 xl:inset-16 rounded-xl max-h-[90vh]'
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-stroke-subtle shrink-0">
          {isMobile && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-content-disabled" />
          )}
          <div>
            <h2
              id="inspiration-gallery-title"
              className="text-xl md:text-2xl font-bold text-content"
            >
              Inspiration Gallery
            </h2>
            <p className="text-sm text-content-secondary mt-1 hidden sm:block">
              Browse pre-designed layouts to get started quickly
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 text-content-secondary hover:text-content hover:bg-surface rounded-lg transition-colors"
            aria-label="Close gallery"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and filter */}
        <div className="px-4 md:px-6 py-3 border-b border-stroke-subtle shrink-0 space-y-2">
          {/* Search input with suggestions */}
          <div className="space-y-1.5">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search layouts, bins, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm bg-surface border border-stroke rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-content placeholder:text-content-disabled"
                aria-label="Search layouts"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-tertiary hover:text-content rounded"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {/* Search suggestions - only show when no search query */}
            {!searchQuery && (
              <div className="flex items-center gap-1.5 text-[10px] text-content-disabled">
                <span>Try:</span>
                {SEARCH_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setSearchQuery(suggestion)}
                    className="px-1.5 py-0.5 rounded bg-surface-secondary hover:bg-surface-hover text-content-tertiary hover:text-content transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter row: Theme pills + Sort */}
          <div className="flex items-center gap-2">
            {/* Theme filter pills */}
            <div className="flex-1 overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6">
              <ThemeFilterPills
                selectedTheme={selectedTheme}
                onThemeChange={handleThemeChange}
                themeCounts={themeCounts}
              />
            </div>
            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs bg-surface border border-stroke rounded-lg px-2 py-1.5 text-content-secondary focus:outline-none focus:ring-2 focus:ring-accent shrink-0"
              aria-label="Sort layouts"
            >
              <option value="default">Default</option>
              <option value="bins-desc">Most bins</option>
              <option value="bins-asc">Fewest bins</option>
              <option value="size-desc">Largest drawer</option>
              <option value="size-asc">Smallest drawer</option>
            </select>
          </div>

          {/* Active filter indicator on mobile */}
          {isMobile && (selectedTheme !== 'all' || searchQuery) && (
            <div className="flex items-center gap-2 text-xs">
              {selectedTheme !== 'all' && (
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent flex items-center gap-1">
                  {THEME_CONFIG[selectedTheme].label}
                  <button
                    onClick={() => setSelectedTheme('all')}
                    className="hover:text-accent/70"
                    aria-label="Clear theme filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-full bg-surface-secondary text-content-secondary flex items-center gap-1">
                  "{searchQuery}"
                  <button
                    onClick={() => setSearchQuery('')}
                    className="hover:text-content"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Layout grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div
            ref={gridRef}
            className={`grid ${gridCols} gap-3 md:gap-4`}
            onKeyDown={handleGridKeyDown}
            role="grid"
            aria-label="Layout gallery"
          >
            {/* Start Fresh card */}
            <button
              onClick={handleStartFresh}
              className="
                group w-full text-left bg-surface rounded-xl p-2 md:p-3
                border-2 border-dashed border-stroke hover:border-accent
                transition-all duration-200 ease-out
                hover:shadow-md hover:-translate-y-0.5
                focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                animate-fade-in-up cursor-pointer flex flex-col items-center justify-center
                min-h-[140px] md:min-h-[180px]
              "
              aria-label="Start with a blank layout"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-secondary group-hover:bg-accent/10 flex items-center justify-center transition-colors mb-2">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-content-tertiary group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-xs md:text-sm font-medium text-content-secondary group-hover:text-content transition-colors">
                Start Fresh
              </span>
              <span className="text-[10px] text-content-tertiary mt-0.5">
                Blank canvas
              </span>
            </button>
            {filteredLayouts.map((layout, index) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onClick={() => handleSelectLayout(layout)}
                onQuickUse={() => handleQuickUse(layout)}
                index={index + 1}
                tabIndex={focusedCardIndex === index + 1 ? 0 : -1}
              />
            ))}
          </div>

          {/* Empty state */}
          {filteredLayouts.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-content-disabled mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-content-secondary mb-1">
                {searchQuery ? 'No layouts match your search' : 'No layouts found for this theme'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-accent hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer with count */}
        <div className="px-4 md:px-6 py-3 border-t border-stroke-subtle text-sm text-content-tertiary shrink-0">
          {filteredLayouts.length} layout{filteredLayouts.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
          {selectedTheme !== 'all' && !searchQuery && ` in ${THEME_CONFIG[selectedTheme].label}`}
          {selectedTheme !== 'all' && searchQuery && ` in ${THEME_CONFIG[selectedTheme].label}`}
        </div>
      </div>

      {/* Preview overlay */}
      {previewLayout && (
        <LayoutPreviewOverlay
          layout={previewLayout}
          onClose={handleClosePreview}
          onUseLayout={handleUseLayout}
          onSelectRelated={handleSelectLayout}
          isImporting={isImporting}
        />
      )}
    </>
  );
}
