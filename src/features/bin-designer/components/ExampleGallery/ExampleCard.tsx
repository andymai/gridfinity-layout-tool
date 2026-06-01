import { useGalleryFavoritesStore } from '@/features/bin-designer/store/galleryFavorites';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { TECHNIQUE_CONFIG } from '@/features/bin-designer/types/exampleGallery';
import { useTranslation } from '@/i18n';

interface ExampleCardProps {
  example: ExampleDesign;
  onSelect: (example: ExampleDesign) => void;
  index: number;
  tabIndex?: number;
  onFocus?: () => void;
}

export function ExampleCard({ example, onSelect, index, tabIndex = 0, onFocus }: ExampleCardProps) {
  const t = useTranslation();
  const toggleFavorite = useGalleryFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useGalleryFavoritesStore((state) => state.isFavorite);
  const favorited = isFavorite(example.id);

  const animationDelay = `${Math.min(index * 50, 300)}ms`;
  const primaryTechnique = example.techniques[0];
  const techniqueLabel = t(TECHNIQUE_CONFIG[primaryTechnique].labelKey);

  return (
    <div
      role="button"
      tabIndex={tabIndex}
      onClick={() => onSelect(example)}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(example);
        }
      }}
      className="
        group w-full text-left bg-surface-secondary rounded-lg p-2
        border-2 border-transparent hover:border-accent/50
        transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        animate-fade-in-up cursor-pointer
      "
      style={{ animationDelay }}
      aria-label={`${t(example.nameKey)}. ${techniqueLabel}.`}
      data-example-card
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-surface rounded overflow-hidden mb-2 flex items-center justify-center relative">
        <img
          src={example.thumbnail}
          alt={t(example.nameKey)}
          loading="lazy"
          className="w-full h-full object-cover"
        />

        {/* Popular tag */}
        {example.popular && (
          <span
            className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded-full bg-accent text-on-dark"
            aria-hidden="true"
          >
            {t('binExamples.popular')}
          </span>
        )}

        {/* Favorite button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(example.id);
          }}
          className="
            absolute top-1.5 right-1.5
            p-1 rounded-full bg-black/50 backdrop-blur-sm
            text-white hover:bg-black/70 transition-colors
          "
          aria-label={favorited ? t('binExamples.removeFavorite') : t('binExamples.addFavorite')}
          aria-pressed={favorited}
        >
          <svg
            className="w-3.5 h-3.5"
            fill={favorited ? 'currentColor' : 'none'}
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
      </div>

      {/* Name */}
      <h3
        className="font-medium text-content text-sm leading-tight line-clamp-1"
        title={t(example.nameKey)}
      >
        {t(example.nameKey)}
      </h3>

      {/* Technique label */}
      <p className="text-xs text-content-secondary line-clamp-1 mt-0.5">{techniqueLabel}</p>

      {/* Dimensions */}
      <div className="flex items-center mt-1">
        <span className="text-xs text-content-tertiary">
          {example.metrics.width}×{example.metrics.depth}×{example.metrics.height}
        </span>
      </div>
    </div>
  );
}
