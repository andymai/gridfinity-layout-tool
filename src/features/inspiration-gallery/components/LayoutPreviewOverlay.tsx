import { useEffect, useRef } from 'react';
import { useResponsive } from '@/shared/hooks';
import { useLayoutStore } from '@/core/store/layout';
import { LayoutThumbnailWithLabels } from './LayoutThumbnailWithLabels';
import { THEME_CONFIG, FEATURE_CONFIG } from '../types';
import type { InspirationLayout } from '../types';

interface LayoutPreviewOverlayProps {
  layout: InspirationLayout;
  onClose: () => void;
  onUseLayout: () => void;
  isImporting: boolean;
}

/**
 * Full-screen preview overlay for an inspiration layout.
 */
export function LayoutPreviewOverlay({
  layout,
  onClose,
  onUseLayout,
  isImporting,
}: LayoutPreviewOverlayProps) {
  const { isMobile } = useResponsive();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const {
    name,
    description,
    theme,
    features,
    metrics,
    layout: layoutData,
  } = layout;

  // Get current drawer size for comparison
  const currentDrawer = useLayoutStore((state) => state.layout.drawer);
  const gridUnitMm = layoutData.gridUnitMm || 42;

  // Calculate real-world dimensions
  const realWidth = metrics.drawerSize.width * gridUnitMm;
  const realDepth = metrics.drawerSize.depth * gridUnitMm;

  // Check if layout matches current drawer size
  const matchesCurrentDrawer =
    metrics.drawerSize.width === currentDrawer.width &&
    metrics.drawerSize.depth === currentDrawer.depth;

  // Count labeled bins
  const labeledBins = layout.layout.bins.filter((b) => b.label.trim() !== '');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Darker backdrop */}
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      {/* Preview panel */}
      <div
        className={`
          relative bg-surface-elevated rounded-xl shadow-2xl
          flex flex-col overflow-hidden animate-scale-in
          ${isMobile ? 'w-full max-h-[95vh]' : 'w-full max-w-4xl max-h-[90vh]'}
        `}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-stroke-subtle shrink-0">
          <div className="flex items-center gap-3">
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 text-content-secondary hover:text-content hover:bg-surface rounded-lg transition-colors"
              aria-label="Back to gallery"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 id="preview-title" className="text-lg md:text-xl font-bold text-content">
              {name}
            </h2>
          </div>
          <span className="text-xs uppercase tracking-wide px-2 py-1 rounded bg-surface-secondary text-content-tertiary">
            {THEME_CONFIG[theme].label}
          </span>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'flex flex-col' : 'flex'}`}>
          {/* Large preview */}
          <div className={`${isMobile ? 'p-4' : 'flex-1 p-6'} flex items-center justify-center bg-surface`}>
            <div className="bg-surface-secondary rounded-xl p-4 md:p-8">
              <LayoutThumbnailWithLabels
                layout={layoutData}
                size={isMobile ? 280 : 400}
              />
            </div>
          </div>

          {/* Details panel */}
          <div className={`${isMobile ? 'p-4' : 'w-80 p-6 border-l border-stroke-subtle'} space-y-6`}>
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-content mb-2">Description</h3>
              <p className="text-sm text-content-secondary">{description}</p>
            </div>

            {/* Drawer Size Info */}
            <DrawerSizeInfo
              templateSize={metrics.drawerSize}
              currentSize={currentDrawer}
              matchesCurrent={matchesCurrentDrawer}
              realWidth={realWidth}
              realDepth={realDepth}
            />

            {/* Metrics */}
            <div>
              <h3 className="text-sm font-medium text-content mb-3">Layout Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Drawer Size"
                  value={`${metrics.drawerSize.width}×${metrics.drawerSize.depth}`}
                  subtext={`${realWidth}×${realDepth}mm`}
                />
                <MetricCard label="Drawer Height" value={`${metrics.drawerSize.height}u`} />
                <MetricCard label="Total Bins" value={metrics.binCount.toString()} />
                <MetricCard label="Layers" value={metrics.layerCount.toString()} />
                <MetricCard label="Categories" value={metrics.categoryCount.toString()} />
                <MetricCard label="Labeled Bins" value={labeledBins.length.toString()} />
              </div>
            </div>

            {/* Features */}
            {features.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-content mb-3">Features Used</h3>
                <div className="flex flex-wrap gap-2">
                  {features.map((feature) => (
                    <span
                      key={feature}
                      className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent"
                      title={FEATURE_CONFIG[feature].description}
                    >
                      {FEATURE_CONFIG[feature].label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sample labels */}
            {labeledBins.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-content mb-2">Sample Labels</h3>
                <div className="flex flex-wrap gap-1">
                  {labeledBins.slice(0, 8).map((bin) => (
                    <span
                      key={bin.id}
                      className="text-xs px-2 py-1 rounded bg-surface text-content-secondary"
                    >
                      {bin.label}
                    </span>
                  ))}
                  {labeledBins.length > 8 && (
                    <span className="text-xs px-2 py-1 text-content-tertiary">
                      +{labeledBins.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with CTA */}
        <div className="p-4 md:p-6 border-t border-stroke-subtle bg-surface shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-content-secondary hidden md:block">
              This will create a copy in your layout library.
            </p>
            <div className="flex gap-3 w-full md:w-auto">
              <button
                onClick={onClose}
                className="flex-1 md:flex-none btn btn-secondary px-6"
              >
                Cancel
              </button>
              <button
                onClick={onUseLayout}
                disabled={isImporting}
                className="flex-1 md:flex-none btn btn-primary px-6"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Use This Layout'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="bg-surface rounded-lg p-3">
      <div className="text-lg font-semibold text-content">{value}</div>
      <div className="text-xs text-content-tertiary">{label}</div>
      {subtext && <div className="text-[10px] text-content-disabled mt-0.5">{subtext}</div>}
    </div>
  );
}

interface DrawerSize {
  width: number;
  depth: number;
}

function DrawerSizeInfo({
  templateSize,
  currentSize,
  matchesCurrent,
  realWidth,
  realDepth,
}: {
  templateSize: DrawerSize;
  currentSize: DrawerSize;
  matchesCurrent: boolean;
  realWidth: number;
  realDepth: number;
}) {
  if (matchesCurrent) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <div>
          <div className="text-sm font-medium text-emerald-600">Matches your drawer</div>
          <div className="text-xs text-emerald-600/70">
            Same size as your current {currentSize.width}×{currentSize.depth} drawer
          </div>
        </div>
      </div>
    );
  }

  // Different size - just show info, no warning needed since it creates a copy
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-surface border border-stroke-subtle">
      <svg className="w-5 h-5 text-content-tertiary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
      <div>
        <div className="text-sm font-medium text-content-secondary">
          {templateSize.width}×{templateSize.depth} drawer
        </div>
        <div className="text-xs text-content-tertiary">
          {realWidth}×{realDepth}mm
          {(templateSize.width !== currentSize.width || templateSize.depth !== currentSize.depth) && (
            <span className="ml-1 text-content-disabled">
              (yours: {currentSize.width}×{currentSize.depth})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
