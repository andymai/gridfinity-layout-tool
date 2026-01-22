import { LayoutThumbnailWithLabels } from './LayoutThumbnailWithLabels';
import { THEME_CONFIG } from '../types';
import type { InspirationLayout } from '../types';

interface LayoutCardProps {
  layout: InspirationLayout;
  onClick: () => void;
  index: number;
  tabIndex?: number;
  onFocus?: () => void;
}

/**
 * Layout card with thumbnail, title, description, and metadata.
 */
export function LayoutCard({
  layout: inspirationLayout,
  onClick,
  index,
  tabIndex = 0,
  onFocus,
}: LayoutCardProps) {
  const { name, shortDescription, metrics, layout, theme } = inspirationLayout;

  const animationDelay = `${Math.min(index * 50, 300)}ms`;
  const themeConfig = THEME_CONFIG[theme];

  return (
    <div
      role="button"
      tabIndex={tabIndex}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
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
      aria-label={`${name}. ${themeConfig.label}. ${metrics.binCount} bins. ${shortDescription}`}
      data-layout-card
    >
      {/* Thumbnail - portrait aspect for taller cards */}
      <div className="aspect-[3/4] bg-surface-secondary rounded overflow-hidden mb-2 flex items-center justify-center relative p-2">
        <LayoutThumbnailWithLabels layout={layout} responsive className="max-w-full max-h-full" />
        {/* Theme indicator - top right */}
        <span
          className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full bg-black/70 text-white backdrop-blur-sm"
          aria-hidden="true"
        >
          {themeConfig.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-medium text-content text-base leading-tight line-clamp-1">{name}</h3>

      {/* Short description */}
      <p className="text-sm text-content-secondary line-clamp-1 mt-0.5">{shortDescription}</p>

      {/* Metadata row: bins, size */}
      <div className="flex items-center mt-1.5">
        <span className="text-sm text-content-tertiary">
          {metrics.binCount} bins · {metrics.drawerSize.width}×{metrics.drawerSize.depth}
        </span>
      </div>
    </div>
  );
}
