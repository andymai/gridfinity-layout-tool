import { useEffect, useRef, useMemo } from 'react';
import { useResponsive } from '@/shared/hooks';
import { useLayoutStore } from '@/core/store/layout';
import { LayoutThumbnailWithLabels } from '../LayoutThumbnailWithLabels';
import { THEME_CONFIG } from '../../types';
import { INSPIRATION_LAYOUTS } from '../../data';
import type { InspirationLayout } from '../../types';
import { Button, IconButton, ArrowLeftIcon } from '@/design-system';
import { useTranslation } from '@/i18n';

interface LayoutPreviewOverlayProps {
  layout: InspirationLayout;
  onClose: () => void;
  onUseLayout: () => void;
  onSelectRelated?: (layout: InspirationLayout) => void;
  isImporting: boolean;
}

/**
 * Full-screen preview overlay for an inspiration layout.
 */
export function LayoutPreviewOverlay({
  layout,
  onClose,
  onUseLayout,
  onSelectRelated,
  isImporting,
}: LayoutPreviewOverlayProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount and handle Escape key
  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { name, description, theme, metrics, layout: layoutData } = layout;

  // Find related layouts (same theme, excluding current)
  const relatedLayouts = useMemo(() => {
    return INSPIRATION_LAYOUTS.filter((l) => l.theme === theme && l.id !== layout.id).slice(0, 3);
  }, [theme, layout.id]);

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

  // Count labeled bins (guard against undefined labels)
  const labeledBins = layout.layout.bins.filter((b) => b.label && b.label.trim() !== '');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      role="presentation"
      onClick={onClose}
    >
      {/* Darker backdrop */}
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      {/* Preview panel */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        className={`
          relative bg-surface-elevated rounded-xl shadow-2xl
          flex flex-col overflow-hidden animate-scale-in
          ${isMobile ? 'w-full max-h-[95vh]' : 'w-full max-w-4xl max-h-[90vh]'}
        `}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-stroke-subtle shrink-0">
          <div className="flex items-center gap-3">
            <IconButton
              ref={closeButtonRef}
              onClick={onClose}
              aria-label={t('gallery.backToGallery')}
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </IconButton>
            <h2 id="preview-title" className="text-lg md:text-xl font-bold text-content">
              {name}
            </h2>
          </div>
          <span className="text-xs uppercase tracking-wide px-2 py-1 rounded bg-surface-secondary text-content-tertiary">
            {THEME_CONFIG[theme].label}
          </span>
        </div>

        {/* Content */}
        <div
          className={`flex-1 overflow-y-auto scrollbar-thin ${isMobile ? 'flex flex-col' : 'flex'}`}
        >
          {/* Large preview - fills available space */}
          <div
            className={`${isMobile ? 'p-4' : 'flex-1 p-6'} flex items-center justify-center bg-surface`}
          >
            <div className="bg-surface-secondary rounded-xl p-6 md:p-8 w-full h-full max-h-[60vh] flex items-center justify-center">
              <LayoutThumbnailWithLabels
                layout={layoutData}
                responsive
                className="max-w-full max-h-full"
              />
            </div>
          </div>

          {/* Details panel - wider on desktop */}
          <div
            className={`${isMobile ? 'p-4' : 'w-96 p-6 border-l border-stroke-subtle'} space-y-5`}
          >
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-content mb-2">{t('gallery.description')}</h3>
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

            {/* Metrics - streamlined, no redundant drawer size */}
            <div>
              <h3 className="text-sm font-medium text-content mb-3">
                {t('gallery.layoutDetails')}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Bins" value={metrics.binCount.toString()} />
                <MetricCard label="Layers" value={metrics.layerCount.toString()} />
                <MetricCard label="Categories" value={metrics.categoryCount.toString()} />
              </div>
            </div>

            {/* Example items */}
            {labeledBins.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-content mb-2">
                  {t('gallery.exampleItems')}
                </h3>
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
                      {t('gallery.moreCount', { count: labeledBins.length - 8 })}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Related layouts */}
            {relatedLayouts.length > 0 && onSelectRelated && (
              <div>
                <h3 className="text-sm font-medium text-content mb-2">
                  {t('gallery.moreInTheme', { theme: THEME_CONFIG[theme].label })}
                </h3>
                <div className="flex gap-2">
                  {relatedLayouts.map((related) => (
                    <Button
                      key={related.id}
                      variant="ghost"
                      onClick={() => onSelectRelated(related)}
                      className="flex-1 flex-col items-stretch p-2 rounded-lg bg-surface hover:bg-surface-hover border border-stroke-subtle hover:border-stroke text-left"
                    >
                      <div className="aspect-[3/4] bg-surface-secondary rounded mb-1.5 flex items-center justify-center overflow-hidden p-1">
                        <LayoutThumbnailWithLabels
                          layout={related.layout}
                          responsive
                          className="max-w-full max-h-full"
                        />
                      </div>
                      <div
                        className="text-xs font-medium text-content truncate"
                        title={related.name}
                      >
                        {related.name}
                      </div>
                      <div className="text-[10px] text-content-tertiary">
                        {related.metrics.binCount}
                        {t('gallery.bins')}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with CTA */}
        <div className="p-4 md:p-6 border-t border-stroke-subtle bg-surface shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-content-secondary">
              {t('gallery.useAsAStartingPointCustomizeToFitYo')}
            </p>
            <Button
              variant="primary"
              loading={isImporting}
              onClick={onUseLayout}
              className="px-6 shrink-0"
            >
              {isImporting ? t('gallery.adding') : t('gallery.useAsStartingPoint')}
            </Button>
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
  const t = useTranslation();
  if (matchesCurrent) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-success-muted border border-success/20">
        <svg
          className="w-5 h-5 text-success shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <div>
          <div className="text-sm font-medium text-success">{t('gallery.matchesYourDrawer')}</div>
          <div className="text-xs text-success/70">
            {t('gallery.sameSizeAsYourCurrent', {
              size: `${currentSize.width}×${currentSize.depth}`,
            })}
          </div>
        </div>
      </div>
    );
  }

  // Different size - just show info, no warning needed since it creates a copy
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-surface border border-stroke-subtle">
      <svg
        className="w-5 h-5 text-content-tertiary shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
        />
      </svg>
      <div>
        <div className="text-sm font-medium text-content-secondary">
          {templateSize.width}×{templateSize.depth}
          {t('gallery.drawer')}
        </div>
        <div className="text-xs text-content-tertiary">
          {realWidth}×{realDepth}mm
          <span className="ml-1 text-content-disabled">
            {t('gallery.yourSize', { size: `${currentSize.width}×${currentSize.depth}` })}
          </span>
        </div>
      </div>
    </div>
  );
}
