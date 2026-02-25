import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useUndoableAction } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { useToastStore } from '@/core/store/toast';
import { STAGING_ID } from '@/core/constants';
import { getLayerBins } from '@/shared/utils';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useTranslation } from '@/i18n';
import { SizeSelectorPopover } from './SizeSelectorPopover';

export function ActiveLayerPanel() {
  const t = useTranslation();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);

  const { layout, fillLayer, fillLayerGaps, clearLayer, addBin } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      fillLayer: state.fillLayer,
      fillLayerGaps: state.fillLayerGaps,
      clearLayer: state.clearLayer,
      addBin: state.addBin,
    }))
  );

  const { activeLayerId, activeCategoryId, setSelectedBins } = useSelectionStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      activeCategoryId: state.activeCategoryId,
      setSelectedBins: state.setSelectedBins,
    }))
  );

  const { paintSize, togglePaintSize, setPaintSize } = useInteractionStore(
    useShallow((state) => ({
      paintSize: state.paintSize,
      togglePaintSize: state.togglePaintSize,
      setPaintSize: state.setPaintSize,
    }))
  );

  const halfBinMode = useHalfBinModeStore((state) => state.halfBinMode);

  const addToast = useToastStore((state) => state.addToast);
  const { execute } = useUndoableAction();

  const activeLayer = layout.layers.find((l) => l.id === activeLayerId);
  const layerBins = getLayerBins(layout.bins, activeLayerId);

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

  const handleFill = () => {
    if (!activeLayerId || !paintSize) return;
    const { width, depth } = paintSize;
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

  // Add bin directly to stash (Shift+click on size button in popover)
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

  const handleSelectSize = (w: number, d: number) => {
    togglePaintSize({ width: w, depth: d });
  };

  const handleSizeButtonClick = () => {
    setPopoverOpen((prev) => !prev);
  };

  return (
    <div>
      {/* Compact toolbar — 3 full-width rows */}
      <div className="flex flex-col gap-1.5">
        {/* Row 1: Size selector */}
        <button
          ref={sizeButtonRef}
          onClick={handleSizeButtonClick}
          className={`btn w-full justify-center text-sm h-8 gap-1.5 ${
            paintSize
              ? 'bg-accent/15 border-accent/60 text-accent hover:bg-accent/25'
              : 'btn-secondary'
          }`}
          title={
            paintSize
              ? t('layers.paintSizeTitle', { width: paintSize.width, depth: paintSize.depth })
              : t('layers.sizeSelector')
          }
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          {paintSize ? `${paintSize.width}×${paintSize.depth}` : t('layers.sizeSelector')}
          <svg
            className={`w-3 h-3 opacity-60 shrink-0 transition-transform ${popoverOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Row 2: Fill — shows "Fill with NxN" when size selected, "Fill gaps" otherwise */}
        {paintSize ? (
          <button
            onClick={handleFill}
            className="btn btn-primary w-full justify-center text-sm h-8"
            title={t('layers.fillTitle', { width: paintSize.width, depth: paintSize.depth })}
          >
            {t('layers.fillWith')}
            {paintSize.width}×{paintSize.depth}
          </button>
        ) : (
          <button
            onClick={handleFillGaps}
            disabled={emptyCells === 0}
            className="btn btn-secondary w-full justify-center text-sm h-8 gap-1.5"
            title={
              emptyCells > 0
                ? t('layers.fillGapsTitle', { count: emptyCells })
                : t('layers.noGapsToFill')
            }
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
            {emptyCells > 0 ? t('layers.fillGaps', { count: emptyCells }) : t('layers.noGaps')}
          </button>
        )}

        {/* Row 3: Clear layer */}
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={layerBins.length === 0}
          className="btn btn-ghost w-full justify-center text-sm h-8 gap-1.5 text-error hover:bg-error/10"
          title={
            layerBins.length > 0
              ? t('layers.clearBinsTitle', { count: layerBins.length })
              : t('layers.noBinsToClear')
          }
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      </div>

      {/* Size selector popover */}
      <SizeSelectorPopover
        anchorRef={sizeButtonRef}
        isOpen={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        paintSize={paintSize}
        onSelectSize={handleSelectSize}
        onShiftClickSize={handleAddToStash}
      />

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
