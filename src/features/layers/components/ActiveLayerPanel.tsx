import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { STAGING_ID } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { useTranslation } from '@/i18n';

// Square sizes
const SQUARE_SIZES = [1, 2, 3, 4, 5, 6];

// Rectangle sizes (width × depth where width < depth)
const RECTANGLE_SIZES = [
  { w: 1, d: 2 },
  { w: 1, d: 3 },
  { w: 1, d: 4 },
  { w: 1, d: 5 },
  { w: 1, d: 6 },
  { w: 2, d: 3 },
  { w: 2, d: 4 },
  { w: 2, d: 5 },
  { w: 2, d: 6 },
  { w: 3, d: 4 },
  { w: 3, d: 5 },
  { w: 3, d: 6 },
  { w: 4, d: 5 },
  { w: 4, d: 6 },
  { w: 5, d: 6 },
];

export function ActiveLayerPanel() {
  const t = useTranslation();
  const [rotated, setRotated] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { layout, fillLayer, fillLayerGaps, clearLayer, addBin } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      fillLayer: state.fillLayer,
      fillLayerGaps: state.fillLayerGaps,
      clearLayer: state.clearLayer,
      addBin: state.addBin,
    }))
  );

  const {
    activeLayerId,
    activeCategoryId,
    paintSize,
    togglePaintSize,
    setPaintSize,
    setSelectedBins,
    halfBinMode,
  } = useUIStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      activeCategoryId: state.activeCategoryId,
      paintSize: state.paintSize,
      togglePaintSize: state.togglePaintSize,
      setPaintSize: state.setPaintSize,
      setSelectedBins: state.setSelectedBins,
      halfBinMode: state.halfBinMode,
    }))
  );

  const addToast = useToastStore((state) => state.addToast);
  const { execute } = useUndoableAction();

  const isPaintActive = (w: number, d: number) => paintSize?.width === w && paintSize?.depth === d;

  const activeLayer = layout.layers.find((l) => l.id === activeLayerId);
  const layerBins = layout.bins.filter(
    (b) => b.layerId === activeLayerId && b.layerId !== STAGING_ID
  );

  // Calculate empty cells for Fill gaps button
  const totalCells = layout.drawer.width * layout.drawer.depth;
  const coveredCells = layerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const emptyCells = totalCells - coveredCells;

  const handleFillGaps = () => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    execute(() => {
      fillLayerGaps(activeLayerId, activeCategoryId, halfBinMode);
    });
    setTimeout(() => {
      const afterCount = useLayoutStore
        .getState()
        .layout.bins.filter((b) => b.layerId === activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(t('toast.fillComplete', { count: added }), 'success');
      }
    }, 0);
  };

  const handleClearLayer = () => {
    if (!activeLayerId || layerBins.length === 0) return;
    const count = layerBins.length;
    execute(() => {
      clearLayer(activeLayerId);
      setSelectedBins([]);
    });
    addToast(t('toast.clearComplete', { count }), 'success');
    setShowClearConfirm(false);
  };

  const handleFill = (width: number, depth: number) => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    execute(() => {
      fillLayer(activeLayerId, width, depth, activeCategoryId, halfBinMode);
    });
    // Exit paint mode after filling
    setPaintSize(null);
    setTimeout(() => {
      const afterCount = useLayoutStore
        .getState()
        .layout.bins.filter((b) => b.layerId === activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(t('toast.fillWithSize', { count: added, width, depth }), 'success');
      }
    }, 0);
  };

  if (!activeLayer) return null;

  // Add bin directly to stash (Shift+click on size button)
  const handleAddToStash = (w: number, d: number) => {
    execute(() => {
      addBin({
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: w,
        depth: d,
        height: activeLayer.height,
        category: activeCategoryId,
        label: '',
        notes: '',
      });
    });

    addToast(t('toast.binAddedToStash', { width: w, depth: d }), 'success');
  };

  // Helper to render a size button with proportional preview
  const SizeButton = ({ w, d, className = '' }: { w: number; d: number; className?: string }) => {
    const isActive = isPaintActive(w, d);
    // Pure proportional sizing for correct aspect ratios
    // Multiplier of 4 ensures 6x6 (24x24px) fits within narrow grid cells
    const previewWidth = w * 4;
    const previewHeight = d * 4;
    return (
      <button
        onClick={(e) => {
          if (e.shiftKey) {
            handleAddToStash(w, d);
          } else {
            togglePaintSize({ width: w, depth: d });
          }
        }}
        className={`flex flex-col items-center justify-end gap-1 h-[60px] p-1.5 rounded transition-colors ${isActive ? 'bg-accent/20' : 'hover:bg-surface-hover'} ${className}`}
        aria-label={t('layers.paintSizeAriaLabel', {
          action: isActive ? t('layers.deselect') : t('layers.select'),
          width: w,
          depth: d,
        })}
        title={t('layers.paintSizeTitle', { width: w, depth: d })}
      >
        <div
          className="rounded-[1px]"
          style={{
            width: previewWidth,
            height: previewHeight,
            backgroundColor: isActive ? 'var(--color-accent)' : 'var(--text-tertiary)',
          }}
        />
        <span className={`text-[9px] ${isActive ? 'text-accent' : 'text-content-tertiary'}`}>
          {w}×{d}
        </span>
      </button>
    );
  };

  // Get rectangle dimensions based on rotation state
  const getRectDims = (w: number, d: number) => (rotated ? { w: d, d: w } : { w, d });

  return (
    <div>
      <CollapsibleSection title={t('layers.binPalette')} variant="default">
        <p className="text-xs text-content-tertiary mb-3">
          {t('layers.binPaletteInstruction')}{' '}
          <span className="text-content-disabled">{t('layers.binPaletteHint')}</span>
        </p>

        {/* Squares section */}
        <div className="text-xs text-content-tertiary mb-1.5">{t('layers.squares')}</div>
        <div className="grid grid-cols-6 gap-1.5">
          {SQUARE_SIZES.map((size) => (
            <SizeButton key={`${size}×${size}`} w={size} d={size} className="w-full" />
          ))}
        </div>

        {/* Rectangles section */}
        <div className="flex items-center justify-between mt-3 mb-1.5">
          <span className="text-xs text-content-tertiary">{t('layers.rectangles')}</span>
          <button
            onClick={() => setRotated(!rotated)}
            className="text-xs text-content-tertiary hover:text-content flex items-center gap-1 transition-colors"
            title={rotated ? t('layers.showingTall') : t('layers.showingWide')}
            aria-label={rotated ? t('layers.switchToWide') : t('layers.switchToTall')}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {rotated ? t('layers.tall') : t('layers.wide')}
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {RECTANGLE_SIZES.map(({ w, d }) => {
            const dims = getRectDims(w, d);
            return <SizeButton key={`${w}×${d}`} w={dims.w} d={dims.d} className="w-full" />;
          })}
        </div>

        {/* Fill button when size selected */}
        {paintSize && (
          <button
            onClick={() => handleFill(paintSize.width, paintSize.depth)}
            className="btn btn-primary w-full justify-center mt-3 text-sm"
            title={`Fill empty space with ${paintSize.width}×${paintSize.depth} bins`}
            aria-label={`Fill layer with ${paintSize.width} by ${paintSize.depth} bins`}
          >
            {t('layers.fillWith')}
            {paintSize.width}×{paintSize.depth}
          </button>
        )}

        {/* Fill gaps button */}
        <button
          onClick={handleFillGaps}
          disabled={emptyCells === 0}
          className="btn btn-secondary w-full justify-center mt-2 text-sm"
          title={
            emptyCells > 0
              ? t('layers.fillGapsTitle', { count: emptyCells })
              : t('layers.noGapsToFill')
          }
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
          {emptyCells > 0 ? t('layers.fillGaps', { count: emptyCells }) : t('layers.noGaps')}
        </button>

        {/* Clear layer button */}
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={layerBins.length === 0}
          className="btn btn-ghost w-full justify-center mt-2 text-sm text-error hover:bg-error/10"
          title={
            layerBins.length > 0
              ? t('layers.clearBinsTitle', { count: layerBins.length })
              : t('layers.noBinsToClear')
          }
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {layerBins.length > 0
            ? t('layers.clearBins', { count: layerBins.length })
            : t('layers.noBins')}
        </button>
      </CollapsibleSection>

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title={t('layers.clearLayer.title')}
        message={t('layers.clearLayer.message', { count: layerBins.length })}
        confirmText={t('layers.clearLayer.confirm')}
        destructive
        onConfirm={handleClearLayer}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
