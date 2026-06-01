import { useState, useEffect, useCallback, useRef } from 'react';
import { useGalleryFavoritesStore } from '@/features/bin-designer/store/galleryFavorites';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { useTranslation } from '@/i18n';
import { filterAndSortExamples } from './useExampleGalleryFilters';
import type { GalleryFilters, GallerySort } from './useExampleGalleryFilters';
import { ExampleCard } from './ExampleCard';
import { TechniqueFilterPills } from './TechniqueFilterPills';
import { ExamplePreviewOverlay } from './ExamplePreviewOverlay';

interface ExampleGalleryProps {
  onClose: () => void;
}

type EditableFilters = Omit<GalleryFilters, 'favoriteIds'>;

const DEFAULT_FILTERS: EditableFilters = {
  search: '',
  technique: null,
  sort: 'recommended',
  favoritesOnly: false,
};

export function ExampleGallery({ onClose }: ExampleGalleryProps) {
  const t = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const favoriteIds = useGalleryFavoritesStore((state) => state.favoriteIds);

  const [filters, setFilters] = useState<EditableFilters>(DEFAULT_FILTERS);
  const [previewExample, setPreviewExample] = useState<ExampleDesign | null>(null);

  const filteredExamples = filterAndSortExamples(EXAMPLE_DESIGNS, { ...filters, favoriteIds });

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Modal key handling lives on the dialog element itself: its onKeyDown
  // stops propagation so app-wide shortcuts don't fire, which would also
  // swallow document-level listeners. Handle Escape + focus trap here.
  const handleDialogKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        if (previewExample) {
          setPreviewExample(null);
        } else {
          onClose();
        }
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose, previewExample]
  );

  const handleSelectExample = useCallback((example: ExampleDesign) => {
    setPreviewExample(example);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewExample(null);
  }, []);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, sort: e.target.value as GallerySort }));
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="example-gallery-title"
        className="fixed z-50 bg-surface-elevated flex flex-col animate-scale-in inset-4 md:inset-8 lg:inset-12 xl:inset-16 rounded-xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-stroke-subtle">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div>
              <h2 id="example-gallery-title" className="text-lg font-semibold text-content">
                {t('binExamples.gallery.title')}
              </h2>
              <p className="text-sm text-content-secondary">{t('binExamples.gallery.subtitle')}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort */}
              <select
                value={filters.sort}
                onChange={handleSortChange}
                className="text-sm bg-surface border border-stroke-subtle rounded-lg px-2 py-1.5 text-content"
                aria-label={t('binExamples.sortBy')}
              >
                <option value="recommended">{t('binExamples.sort.recommended')}</option>
                <option value="popular">{t('binExamples.sort.popular')}</option>
                <option value="size">{t('binExamples.sort.size')}</option>
                <option value="complexity">{t('binExamples.sort.complexity')}</option>
              </select>

              {/* Favorites toggle */}
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))
                }
                className={`
                  p-1.5 rounded-lg transition-colors
                  ${
                    filters.favoritesOnly
                      ? 'text-accent bg-accent/10'
                      : 'text-content-secondary hover:text-content hover:bg-surface'
                  }
                `}
                aria-label={t('binExamples.favoritesOnly')}
                aria-pressed={filters.favoritesOnly}
              >
                <svg
                  className="w-5 h-5"
                  fill={filters.favoritesOnly ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </button>

              {/* Close */}
              <button
                ref={closeButtonRef}
                onClick={onClose}
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

          {/* Search + filter row */}
          <div className="px-4 pb-2 flex items-center gap-3">
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={t('binExamples.searchPlaceholder')}
              className="flex-1 text-sm bg-surface border border-stroke-subtle rounded-lg px-3 py-1.5 text-content placeholder:text-content-disabled"
              aria-label={t('binExamples.searchLabel')}
            />
            <div className="overflow-x-auto">
              <TechniqueFilterPills
                examples={EXAMPLE_DESIGNS}
                selected={filters.technique}
                onChange={(technique) => setFilters((prev) => ({ ...prev, technique }))}
              />
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 md:p-4">
          {filteredExamples.length > 0 ? (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4"
              role="grid"
              aria-label={t('binExamples.gallery.gridLabel')}
            >
              {filteredExamples.map((example, index) => (
                <ExampleCard
                  key={example.id}
                  example={example}
                  onSelect={handleSelectExample}
                  index={index}
                />
              ))}
            </div>
          ) : (
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
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-content-secondary mb-2">{t('binExamples.empty')}</p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-sm text-accent hover:underline"
              >
                {t('binExamples.clearFilters')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-stroke-subtle text-xs text-content-tertiary shrink-0">
          {t('binExamples.gallery.count', { count: filteredExamples.length })}
        </div>
      </div>

      {/* Preview overlay */}
      {previewExample && (
        <ExamplePreviewOverlay
          example={previewExample}
          onClose={onClose}
          onBack={handleClosePreview}
        />
      )}
    </>
  );
}
