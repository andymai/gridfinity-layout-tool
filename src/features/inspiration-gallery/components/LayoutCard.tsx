import { LayoutThumbnailWithLabels } from './LayoutThumbnailWithLabels';
import { FEATURE_CONFIG, THEME_CONFIG } from '../types';
import type { InspirationLayout } from '../types';

interface LayoutCardProps {
  layout: InspirationLayout;
  onClick: () => void;
  index: number;
}

/**
 * Card component displaying a layout preview in the gallery grid.
 */
export function LayoutCard({ layout: inspirationLayout, onClick, index }: LayoutCardProps) {
  const { name, shortDescription, theme, features, metrics, layout } = inspirationLayout;

  // Staggered animation delay based on index
  const animationDelay = `${Math.min(index * 50, 300)}ms`;

  return (
    <button
      onClick={onClick}
      className="
        group w-full text-left bg-surface rounded-xl p-3 md:p-4
        border border-transparent hover:border-stroke-subtle
        transition-all duration-200 ease-out
        hover:shadow-lg hover:-translate-y-1
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        animate-fade-in-up
      "
      style={{ animationDelay }}
      aria-label={`${name}. ${metrics.binCount} bins, ${metrics.layerCount} layer${metrics.layerCount !== 1 ? 's' : ''}. ${shortDescription}`}
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-surface-secondary rounded-lg overflow-hidden mb-3 flex items-center justify-center">
        <LayoutThumbnailWithLabels
          layout={layout}
          size={160}
          className="transition-transform duration-200 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        {/* Title and theme */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-content text-sm md:text-base leading-tight">
            {name}
          </h3>
          <span
            className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-secondary text-content-tertiary shrink-0"
            title={THEME_CONFIG[theme].description}
          >
            {THEME_CONFIG[theme].label}
          </span>
        </div>

        {/* Metrics */}
        <p className="text-xs text-content-tertiary">
          {metrics.drawerSize.width}×{metrics.drawerSize.depth} drawer • {metrics.binCount} bins
          {metrics.layerCount > 1 && ` • ${metrics.layerCount} layers`}
        </p>

        {/* Description */}
        <p className="text-xs text-content-secondary line-clamp-2">
          {shortDescription}
        </p>

        {/* Feature badges - always show at least some useful info */}
        <div className="flex flex-wrap gap-1 pt-1">
          {features.length > 0 ? (
            <>
              {features.slice(0, 3).map((feature) => (
                <FeatureBadge key={feature} feature={feature} />
              ))}
              {features.length > 3 && (
                <span className="text-[10px] text-content-tertiary px-1.5 py-0.5">
                  +{features.length - 3} more
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] text-content-tertiary px-1.5 py-0.5">
              Great for beginners
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function FeatureBadge({ feature }: { feature: keyof typeof FEATURE_CONFIG }) {
  const config = FEATURE_CONFIG[feature];

  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent"
      title={config.description}
    >
      {config.label}
    </span>
  );
}
