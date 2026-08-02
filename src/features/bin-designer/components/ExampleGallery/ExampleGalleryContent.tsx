import { useState, useCallback } from 'react';
import { Button } from '@/design-system';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { useTranslation } from '@/i18n';
import { filterExamples } from './useExampleGalleryFilters';
import type { GalleryFilters } from './useExampleGalleryFilters';
import { ExampleCard } from './ExampleCard';
import { TechniqueFilterPills } from './TechniqueFilterPills';
import { ExamplePreviewOverlay } from './ExamplePreviewOverlay';

interface ExampleGalleryContentProps {
  onRequestClose: () => void;
}

const DEFAULT_FILTERS: GalleryFilters = {
  search: '',
  technique: null,
};

export function ExampleGalleryContent({ onRequestClose }: ExampleGalleryContentProps) {
  const t = useTranslation();

  const [filters, setFilters] = useState<GalleryFilters>(DEFAULT_FILTERS);
  const [previewExample, setPreviewExample] = useState<ExampleDesign | null>(null);

  const filteredExamples = filterExamples(EXAMPLE_DESIGNS, filters);

  const handleSelectExample = useCallback((example: ExampleDesign) => {
    setPreviewExample(example);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewExample(null);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-stroke-subtle px-4 py-2">
        <p className="text-sm text-content-secondary">{t('binExamples.gallery.subtitle')}</p>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder={t('binExamples.searchPlaceholder')}
          className="w-full text-sm bg-surface border border-stroke-subtle rounded-lg px-3 py-1.5 text-content placeholder:text-content-disabled"
          aria-label={t('binExamples.searchLabel')}
        />
        <TechniqueFilterPills
          examples={EXAMPLE_DESIGNS}
          selected={filters.technique}
          onChange={(technique) => setFilters((prev) => ({ ...prev, technique }))}
        />
      </div>

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
            <Button
              variant="ghost"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="px-0 py-0 text-sm font-normal text-accent hover:bg-transparent hover:underline"
            >
              {t('binExamples.clearFilters')}
            </Button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-stroke-subtle px-3 py-1.5 text-xs text-content-tertiary">
        {t('binExamples.gallery.count', { count: filteredExamples.length })}
      </div>

      {previewExample && (
        <ExamplePreviewOverlay
          example={previewExample}
          onClose={onRequestClose}
          onBack={handleClosePreview}
        />
      )}
    </div>
  );
}
