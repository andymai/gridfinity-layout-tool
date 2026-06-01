import { thumbnailUrl } from '@/features/bin-designer/data/examples/thumbnails';
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
          src={thumbnailUrl(example.id) ?? ''}
          alt={t(example.nameKey)}
          loading="lazy"
          className="w-full h-full object-cover"
        />
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
