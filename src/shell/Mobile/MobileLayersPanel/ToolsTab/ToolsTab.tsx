import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useInteractionStore, useMobileStore } from '@/core/store';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SQUARE_SIZES, RECTANGLE_SIZES } from '@/features/layers/paintSizes';
import { useLayerFillActions } from '@/features/layers/hooks/useLayerFillActions';

/**
 * Tools tab content - bin palette for paint mode and layer fill actions.
 * Mobile-optimized with 44px touch targets.
 */
export function ToolsTab() {
  const t = useTranslation();
  const [rotated, setRotated] = useState(false);

  const { paintSize, togglePaintSize } = useInteractionStore(
    useShallow((state) => ({
      paintSize: state.paintSize,
      togglePaintSize: state.togglePaintSize,
    }))
  );
  const closeMobilePanel = useMobileStore((state) => state.closeMobilePanel);

  const {
    activeLayer,
    layerBins,
    emptyCells,
    clearConfirmOpen,
    setClearConfirmOpen,
    fillGaps,
    confirmClear,
    fillWithSize,
  } = useLayerFillActions({ onAfterAction: closeMobilePanel });

  const isPaintActive = (w: number, d: number) => paintSize?.width === w && paintSize.depth === d;

  if (!activeLayer) return null;

  // Get rectangle dimensions based on rotation state
  const getRectDims = (w: number, d: number) => (rotated ? { w: d, d: w } : { w, d });

  // Mobile-optimized size button with larger touch targets
  const SizeButton = ({ w, d }: { w: number; d: number }) => {
    const isActive = isPaintActive(w, d);
    // Proportional preview scaled for mobile
    const previewWidth = w * 5;
    const previewHeight = d * 5;

    return (
      <Button
        variant="ghost"
        onClick={() => togglePaintSize({ width: w, depth: d })}
        className={`flex flex-col items-center justify-end gap-1 min-h-[56px] p-2 rounded ${
          isActive
            ? 'bg-accent/20 ring-2 ring-accent hover:bg-accent/20'
            : 'bg-surface-elevated hover:bg-surface-hover'
        }`}
        aria-label={t('mobile.tools.selectForPaint', {
          action: t(isActive ? 'layers.deselect' : 'mobile.tools.select'),
          width: w,
          depth: d,
        })}
      >
        <div
          className="rounded-[2px]"
          style={{
            width: previewWidth,
            height: previewHeight,
            backgroundColor: isActive ? 'var(--color-accent)' : 'var(--text-tertiary)',
          }}
        />
        <span
          className={`text-xs ${isActive ? 'text-accent font-medium' : 'text-content-tertiary'}`}
        >
          {w}×{d}
        </span>
      </Button>
    );
  };

  return (
    <div className="pb-4">
      <p className="text-xs text-content-tertiary mb-4">{t('mobile.tools.instructions')}</p>

      {/* Squares section */}
      <div className="text-xs text-content-tertiary mb-2 uppercase tracking-wide">
        {t('layers.squares')}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {SQUARE_SIZES.map((size) => (
          <SizeButton key={`${size}×${size}`} w={size} d={size} />
        ))}
      </div>

      {/* Rectangles section */}
      <div className="flex items-center justify-between mt-4 mb-2">
        <span className="text-xs text-content-tertiary uppercase tracking-wide">
          {t('layers.rectangles')}
        </span>
        <Button
          variant="ghost"
          touchTarget={false}
          onClick={() => setRotated(!rotated)}
          className="text-xs text-content-tertiary hover:text-content flex items-center gap-1.5 px-2 py-1 rounded"
          aria-label={t(rotated ? 'mobile.tools.switchToWide' : 'mobile.tools.switchToTall')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {t(rotated ? 'layers.tall' : 'layers.wide')}
        </Button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {RECTANGLE_SIZES.map(({ w, d }) => {
          const dims = getRectDims(w, d);
          return <SizeButton key={`${w}×${d}`} w={dims.w} d={dims.d} />;
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-6 space-y-2">
        {/* Fill with selected size (conditional) */}
        {paintSize && (
          <Button
            variant="primary"
            fullWidth
            onClick={() => fillWithSize(paintSize.width, paintSize.depth)}
            className="h-11 justify-center"
          >
            {t('mobile.tools.fillWithSize', { width: paintSize.width, depth: paintSize.depth })}
          </Button>
        )}

        {/* Fill Gaps */}
        <Button
          variant="secondary"
          fullWidth
          onClick={fillGaps}
          disabled={emptyCells === 0}
          className="h-11 justify-center"
          leftIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
          }
        >
          {emptyCells > 0
            ? t('mobile.tools.fillGaps', { count: emptyCells })
            : t('mobile.tools.noGaps')}
        </Button>

        {/* Clear Layer */}
        <Button
          variant="ghost"
          fullWidth
          onClick={() => setClearConfirmOpen(true)}
          disabled={layerBins.length === 0}
          className="h-11 justify-center text-error hover:bg-error/10 hover:text-error"
          leftIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          }
        >
          {layerBins.length > 0
            ? t('mobile.tools.clearBins', { count: layerBins.length })
            : t('mobile.tools.noBins')}
        </Button>
      </div>

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        isOpen={clearConfirmOpen}
        title={t('layers.clearLayer.title')}
        message={t('layers.clearLayer.message', { count: layerBins.length })}
        confirmText={t('layers.clearLayer.confirm')}
        destructive
        onConfirm={confirmClear}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  );
}
