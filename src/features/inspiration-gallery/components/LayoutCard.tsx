import { useCallback } from 'react';
import { LayoutThumbnailWithLabels } from './LayoutThumbnailWithLabels';
import { FEATURE_CONFIG, THEME_CONFIG } from '../types';
import type { InspirationLayout } from '../types';

interface LayoutCardProps {
  layout: InspirationLayout;
  onClick: () => void;
  onQuickUse: () => void;
  index: number;
  tabIndex?: number;
}

/**
 * Card component displaying a layout preview in the gallery grid.
 */
export function LayoutCard({ layout: inspirationLayout, onClick, onQuickUse, index, tabIndex = 0 }: LayoutCardProps) {
  const { name, shortDescription, theme, features, metrics, layout } = inspirationLayout;

  // Staggered animation delay based on index
  const animationDelay = `${Math.min(index * 50, 300)}ms`;

  // Get hero stat - the most distinctive metric for this layout
  const heroStat = getHeroStat(inspirationLayout);

  // Handle quick use click without triggering card click
  const handleQuickUse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickUse();
  }, [onQuickUse]);

  return (
    <div
      role="button"
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="
        group w-full text-left bg-surface rounded-xl p-2 md:p-3
        border border-transparent hover:border-stroke-subtle
        transition-all duration-200 ease-out
        hover:shadow-lg hover:-translate-y-0.5
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        animate-fade-in-up cursor-pointer relative
      "
      style={{ animationDelay }}
      aria-label={`${name}. ${metrics.binCount} bins, ${metrics.layerCount} layer${metrics.layerCount !== 1 ? 's' : ''}. ${shortDescription}`}
      data-layout-card
    >
      {/* Thumbnail with hero stat overlay */}
      <div className="aspect-[4/3] bg-surface-secondary rounded-lg overflow-hidden mb-2 flex items-center justify-center relative">
        <LayoutThumbnailWithLabels
          layout={layout}
          size={140}
          className="transition-transform duration-200 group-hover:scale-105"
        />
        {/* Hero stat badge */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
          {heroStat}
        </div>
        {/* Quick use button - appears on hover */}
        <button
          onClick={handleQuickUse}
          className="absolute bottom-1.5 right-1.5 px-2 py-1 rounded-md bg-accent text-white text-xs font-medium opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity hover:bg-accent/90 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label={`Quick add ${name} to your layouts`}
        >
          Use
        </button>
      </div>

      {/* Content - more compact */}
      <div className="space-y-1">
        {/* Title and theme */}
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-medium text-content text-xs md:text-sm leading-tight line-clamp-1">
            {name}
          </h3>
          <span
            className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-surface-secondary text-content-tertiary shrink-0"
            title={THEME_CONFIG[theme].description}
          >
            {THEME_CONFIG[theme].label}
          </span>
        </div>

        {/* Compact metrics */}
        <p className="text-[10px] text-content-tertiary">
          {metrics.drawerSize.width}×{metrics.drawerSize.depth} • {metrics.binCount} bins
          {metrics.layerCount > 1 && ` • ${metrics.layerCount}L`}
        </p>

        {/* Feature badges - only show if there are features */}
        {features.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {features.slice(0, 2).map((feature) => (
              <FeatureBadge key={feature} feature={feature} />
            ))}
            {features.length > 2 && (
              <span className="text-[9px] text-content-tertiary px-1">
                +{features.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get the most distinctive/interesting stat for a layout to show as hero.
 */
function getHeroStat(layout: InspirationLayout): string {
  const { metrics, features } = layout;

  // Prioritize interesting features
  if (features.includes('multiple-layers')) {
    return `${metrics.layerCount} layers`;
  }
  if (features.includes('half-bins')) {
    return 'Half-bins';
  }
  if (metrics.binCount >= 20) {
    return `${metrics.binCount} bins`;
  }
  if (metrics.categoryCount >= 4) {
    return `${metrics.categoryCount} categories`;
  }
  // Default to bin count
  return `${metrics.binCount} bins`;
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
