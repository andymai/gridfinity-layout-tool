import { useTranslation } from '@/i18n';

interface NewLayoutCardProps {
  onCreate: () => void;
}

/**
 * "+" card for creating a new layout in grid view.
 * Matches the design of LayoutGridItem (inspiration gallery style).
 */
export function NewLayoutCard({ onCreate }: NewLayoutCardProps) {
  const t = useTranslation();

  return (
    <button
      onClick={onCreate}
      className="
        group w-full text-left bg-surface-secondary rounded-lg p-2
        border-2 border-dashed border-stroke
        hover:border-accent hover:bg-surface-tertiary
        transition-colors cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
      "
      aria-label={t('layouts.newLayout')}
    >
      {/* Thumbnail placeholder - portrait aspect like LayoutGridItem */}
      <div className="aspect-[3/4] bg-surface rounded overflow-hidden mb-2 flex items-center justify-center">
        <svg
          className="w-12 h-12 text-content-tertiary group-hover:text-accent transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
      </div>

      {/* Title - matches LayoutGridItem */}
      <h3 className="font-medium text-content text-base leading-tight line-clamp-1">
        {t('layouts.newLayout')}
      </h3>

      {/* Metadata row - matches LayoutGridItem structure */}
      <div className="flex items-center mt-0.5">
        <span className="text-sm text-content-tertiary">{t('layouts.createNewLayoutHint')}</span>
      </div>

      {/* Placeholder for modified date row - matches LayoutGridItem height */}
      <div className="text-sm text-transparent mt-0.5 select-none" aria-hidden="true">
        &nbsp;
      </div>

      {/* Placeholder for action buttons row - matches LayoutGridItem height */}
      <div className="mt-1.5 h-8" aria-hidden="true" />
    </button>
  );
}
