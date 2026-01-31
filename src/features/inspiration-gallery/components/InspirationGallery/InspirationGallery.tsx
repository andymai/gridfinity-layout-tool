import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useResponsive } from '@/shared/hooks';
import { useLayoutSwitcher } from '@/hooks';
import { useUIStore } from '@/core/store/ui';
import { useToastStore } from '@/core/store/toast';
import { isOk } from '@/core/result';
import { layoutId } from '@/core/types';
import {
  trackEvent,
  trackBinCreated,
  trackGalleryOpened,
  trackGalleryClosed,
  trackTemplateLoadError,
} from '@/shared/analytics/posthog';
import { INSPIRATION_LAYOUTS, getLayoutsByTheme } from '../../data';
import { THEME_CONFIG } from '../../types';
import type { InspirationLayout, InspirationTheme } from '../../types';
import { ThemeFilterPills } from '../ThemeFilterPills';
import { LayoutCard } from '../LayoutCard';
import { LayoutPreviewOverlay } from '../LayoutPreviewOverlay';
import { useTranslation } from '@/i18n';

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

// Calculate responsive grid columns based on viewport width
function getGridColumns(width: number): number {
  if (width >= 1536) return 7; // 2xl
  if (width >= 1280) return 6; // xl
  if (width >= 1024) return 5; // lg
  return 4; // md-lg
}

function InspirationGalleryContent({ onClose }: { onClose: () => void }) {
  const t = useTranslation();
  const { isMobile, viewportWidth } = useResponsive();
  const [selectedTheme, setSelectedTheme] = useState<InspirationTheme | 'all'>('all');
  const [previewLayout, setPreviewLayout] = useState<InspirationLayout | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  // Initialize grid columns from responsive viewport (user can adjust via slider)
  const [gridColumns, setGridColumns] = useState(() => getGridColumns(viewportWidth));
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasTrackedCloseRef = useRef(false);

  const { importLayoutFromJSON, switchLayout } = useLayoutSwitcher();
  const { announceToScreenReader, closeMobilePanel } = useUIStore(
    useShallow((state) => ({
      announceToScreenReader: state.announceToScreenReader,
      closeMobilePanel: state.closeMobilePanel,
    }))
  );
  const addToast = useToastStore((state) => state.addToast);

  /** Close gallery with tracking (fires only once per open). */
  const handleCloseGallery = useCallback(
    (reason: 'applied_template' | 'dismissed') => {
      if (!hasTrackedCloseRef.current) {
        trackGalleryClosed(reason);
        hasTrackedCloseRef.current = true;
      }
      onClose();
    },
    [onClose]
  );

  // Filter by theme
  const filteredLayouts = getLayoutsByTheme(selectedTheme);

  // Count layouts per theme in a single pass (memoized since INSPIRATION_LAYOUTS is static)
  const themeCounts = useMemo(() => {
    const counts = { all: 0, kitchen: 0, workshop: 0, office: 0, hobby: 0, personal: 0 };
    for (const layout of INSPIRATION_LAYOUTS) {
      counts.all++;
      counts[layout.theme]++;
    }
    return counts;
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewLayout) {
          setPreviewLayout(null);
        } else {
          handleCloseGallery(templateApplied ? 'applied_template' : 'dismissed');
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseGallery, previewLayout, templateApplied]);

  // Focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
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

  // Focus close button on mount and track gallery open
  useEffect(() => {
    closeButtonRef.current?.focus();
    announceToScreenReader(
      `Inspiration Gallery opened. ${INSPIRATION_LAYOUTS.length} layouts available. Use Tab to navigate.`
    );
    trackGalleryOpened(INSPIRATION_LAYOUTS.length);
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
      const count = themeCounts[theme];
      const label = theme === 'all' ? 'all themes' : THEME_CONFIG[theme].label;
      announceToScreenReader(`Showing ${count} ${label} layouts`);
      trackEvent('gallery_filter_changed', {
        theme,
        result_count: count,
      });
    },
    [announceToScreenReader, themeCounts]
  );

  const handleSelectLayout = useCallback((layout: InspirationLayout) => {
    setPreviewLayout(layout);
    trackEvent('template_preview', {
      template_id: layout.id,
      template_name: layout.name,
      template_theme: layout.theme,
      bin_count: layout.metrics.binCount,
    });
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewLayout(null);
  }, []);

  // Use layout from preview - imports and switches to it
  const handleUseLayout = useCallback(async () => {
    if (!previewLayout || isImporting) return;

    setIsImporting(true);
    try {
      const result = await importLayoutFromJSON(
        { ...previewLayout.layout, name: previewLayout.name },
        { name: previewLayout.name, author: 'Gridfinity Templates' }
      );

      if (isOk(result)) {
        const switchResult = await switchLayout(layoutId(result.value));
        if (isOk(switchResult)) {
          setTemplateApplied(true);
          addToast(t('toast.galleryAdded', { name: previewLayout.name }), 'success');
          announceToScreenReader(`${previewLayout.name} added to your library`);
          trackEvent('template_applied', {
            template_id: previewLayout.id,
            template_name: previewLayout.name,
            template_theme: previewLayout.theme,
            bin_count: previewLayout.metrics.binCount,
            layer_count: previewLayout.metrics.layerCount,
          });
          trackBinCreated({
            method: 'import',
            count: previewLayout.metrics.binCount,
            from_template_id: previewLayout.id,
          });
        }
        closeMobilePanel();
        handleCloseGallery('applied_template');
      } else {
        trackTemplateLoadError(previewLayout.id, 'Import failed');
        addToast(t('toast.galleryAddFailed'), 'error');
      }
    } finally {
      setIsImporting(false);
    }
  }, [
    previewLayout,
    isImporting,
    importLayoutFromJSON,
    switchLayout,
    addToast,
    announceToScreenReader,
    closeMobilePanel,
    handleCloseGallery,
    t,
  ]);

  // Keyboard navigation for grid
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    },
    [focusedCardIndex]
  );

  // Grid column style - fixed 2 cols on mobile, user-controlled on desktop
  const gridStyle = isMobile
    ? undefined
    : { gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={() => handleCloseGallery(templateApplied ? 'applied_template' : 'dismissed')}
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
          ${
            isMobile
              ? 'inset-x-0 bottom-0 rounded-t-2xl max-h-[85dvh]'
              : 'inset-4 md:inset-8 lg:inset-12 xl:inset-16 rounded-xl max-h-[90vh]'
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-stroke-subtle">
          {isMobile && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-content-disabled" />
          )}
          {/* Title row */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div>
              <h2 id="inspiration-gallery-title" className="text-lg font-semibold text-content">
                {t('gallery.title')}
              </h2>
              <p className="text-sm text-content-secondary">
                {t('gallery.seeWhatSPossibleThenMakeItYours')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Grid size slider (desktop only) */}
              {!isMobile && (
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 text-content-tertiary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  <input
                    type="range"
                    min={3}
                    max={8}
                    value={gridColumns}
                    onChange={(e) => setGridColumns(Number(e.target.value))}
                    className="w-16"
                    aria-label={t('gallery.gridColumns')}
                  />
                </div>
              )}
              <button
                ref={closeButtonRef}
                onClick={() =>
                  handleCloseGallery(templateApplied ? 'applied_template' : 'dismissed')
                }
                className="p-1.5 text-content-secondary hover:text-content hover:bg-surface rounded-lg transition-colors"
                aria-label={t('common.close')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          {/* Filter row */}
          <div className="px-4 pb-2 overflow-x-auto">
            <ThemeFilterPills
              selectedTheme={selectedTheme}
              onThemeChange={handleThemeChange}
              themeCounts={themeCounts}
            />
          </div>
        </div>

        {/* Layout grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 md:p-4">
          <div
            ref={gridRef}
            className={`grid ${isMobile ? 'grid-cols-2' : ''} gap-3 md:gap-4`}
            style={gridStyle}
            onKeyDown={handleGridKeyDown}
            role="grid"
            aria-label={t('gallery.layoutGallery')}
          >
            {filteredLayouts.map((layout, index) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onClick={() => handleSelectLayout(layout)}
                index={index}
                tabIndex={
                  (focusedCardIndex === -1 && index === 0) || focusedCardIndex === index ? 0 : -1
                }
                onFocus={() => setFocusedCardIndex(index)}
              />
            ))}
          </div>

          {/* Empty state */}
          {filteredLayouts.length === 0 && (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-content-disabled mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              <p className="text-content-secondary mb-2">{t('gallery.empty')}</p>
              <button
                onClick={() => setSelectedTheme('all')}
                className="text-sm text-accent hover:underline"
              >
                {t('gallery.browseAllLayouts')}
              </button>
            </div>
          )}
        </div>

        {/* Footer with count */}
        <div className="px-3 py-1.5 border-t border-stroke-subtle text-xs text-content-tertiary shrink-0">
          {selectedTheme !== 'all'
            ? t('gallery.layoutsInTheme', {
                count: filteredLayouts.length,
                theme: THEME_CONFIG[selectedTheme].label,
              })
            : t('gallery.layoutCount', { count: filteredLayouts.length })}
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
