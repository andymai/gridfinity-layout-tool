import { useCallback } from 'react';
import { LayoutThumbnailWithLabels } from './LayoutThumbnailWithLabels';
import type { InspirationLayout } from '../types';

interface LayoutCardProps {
  layout: InspirationLayout;
  onClick: () => void;
  onQuickUse: () => void;
  index: number;
  tabIndex?: number;
}

/**
 * Minimal card component - thumbnail, title, one metric line.
 */
export function LayoutCard({ layout: inspirationLayout, onClick, onQuickUse, index, tabIndex = 0 }: LayoutCardProps) {
  const { name, shortDescription, metrics, layout } = inspirationLayout;

  const animationDelay = `${Math.min(index * 50, 300)}ms`;

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
        group w-full text-left bg-surface rounded-lg p-2
        border border-transparent hover:border-stroke-subtle
        transition-all duration-200 ease-out
        hover:shadow-md
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        animate-fade-in-up cursor-pointer
      "
      style={{ animationDelay }}
      aria-label={`${name}. ${metrics.binCount} bins. ${shortDescription}`}
      data-layout-card
    >
      {/* Thumbnail - portrait aspect for typical drawer layouts */}
      <div className="aspect-[3/4] bg-surface-secondary rounded overflow-hidden mb-1.5 flex items-center justify-center relative">
        <LayoutThumbnailWithLabels
          layout={layout}
          size={120}
          className="transition-transform duration-200 group-hover:scale-105"
        />
        {/* Quick use button - appears on hover */}
        <button
          onClick={handleQuickUse}
          className="absolute bottom-1 right-1 px-2 py-0.5 rounded bg-accent text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent/90 focus:opacity-100 focus:outline-none"
          aria-label={`Quick add ${name}`}
        >
          Use
        </button>
      </div>

      {/* Title + metric */}
      <h3 className="font-medium text-content text-xs leading-tight line-clamp-1">{name}</h3>
      <p className="text-[10px] text-content-tertiary">
        {metrics.binCount} bins · {metrics.drawerSize.width}×{metrics.drawerSize.depth}
      </p>
    </div>
  );
}
