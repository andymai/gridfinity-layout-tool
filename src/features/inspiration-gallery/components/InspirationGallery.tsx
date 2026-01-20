import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [previewLayout, setPreviewLayout] = useState<InspirationLayout | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { importLayoutFromJSON, switchLayout } = useLayoutSwitcher();
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);
  const addToast = useToastStore((state) => state.addToast);

  // Filter by theme first
  const themeFilteredLayouts = getLayoutsByTheme(selectedTheme);

  // Then filter by search query
  const filteredLayouts = searchQuery.trim()
    ? themeFilteredLayouts.filter((layout) => {
        const query = searchQuery.toLowerCase();
        return (
          layout.name.toLowerCase().includes(query) ||
          layout.description.toLowerCase().includes(query) ||
          layout.shortDescription.toLowerCase().includes(query) ||
          layout.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          // Also search bin labels
          layout.layout.bins.some((bin) => bin.label.toLowerCase().includes(query))
        );
      })
    : themeFilteredLayouts;

  // Count layouts per theme for filter badges
  const themeCounts = {
    all: INSPIRATION_LAYOUTS.length,
    kitchen: INSPIRATION_LAYOUTS.filter((l) => l.theme === 'kitchen').length,
    workshop: INSPIRATION_LAYOUTS.filter((l) => l.theme === 'workshop').length,
    office: INSPIRATION_LAYOUTS.filter((l) => l.theme === 'office').length,
    hobby: INSPIRATION_LAYOUTS.filter((l) => l.theme === 'hobby').length,
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

  const handleUseLayout = useCallback(async () => {
    if (!previewLayout || isImporting) return;

    setIsImporting(true);
    try {
      const result = await importLayoutFromJSON(
        { ...previewLayout.layout, name: previewLayout.name },
        { name: previewLayout.name, author: 'Gridfinity Templates' }
      );

      if (isOk(result)) {
        await switchLayout(result.value);
        addToast(`Created "${previewLayout.name}"`, 'success');
        announceToScreenReader(`${previewLayout.name} added to your library`);
        onClose();
      } else {
        addToast('Failed to create layout', 'error');
      }
    } finally {
      setIsImporting(false);
    }
  }, [previewLayout, isImporting, importLayoutFromJSON, switchLayout, addToast, announceToScreenReader, onClose]);

  // Responsive grid columns
  const gridCols = isMobile
    ? 'grid-cols-1'
    : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

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
            ? 'inset-x-0 bottom-0 rounded-t-2xl max-h-[90dvh]'
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
        <div className="px-4 md:px-6 py-3 border-b border-stroke-subtle shrink-0 space-y-3">
          {/* Search input */}
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

          {/* Theme filter pills */}
          <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6">
            <ThemeFilterPills
              selectedTheme={selectedTheme}
              onThemeChange={handleThemeChange}
              themeCounts={themeCounts}
            />
          </div>
        </div>

        {/* Layout grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className={`grid ${gridCols} gap-4 md:gap-6`}>
            {filteredLayouts.map((layout, index) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onClick={() => handleSelectLayout(layout)}
                index={index}
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
          isImporting={isImporting}
        />
      )}
    </>
  );
}
