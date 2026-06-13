import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { useToastStore } from '@/core/store/toast';
import { STAGING_ID } from '@/core/constants';
import { gridUnits } from '@/core/types';
import { getLayerBins } from '@/shared/utils';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SizeSelectorPopover } from './SizeSelectorPopover';
import { batch } from '@/core/cqrs';

export function ActiveLayerPanel() {
  const t = useTranslation();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);

  const layout = useLayoutStore((state) => state.layout);
  const { fillLayer, fillLayerGaps, clearLayer, addBin } = useMutations();

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

  const halfGridMode = useHalfGridModeStore((state) => state.halfGridMode);

  const addToast = useToastStore((state) => state.addToast);

  const activeLayer = layout.layers.find((l) => l.id === activeLayerId);
  const layerBins = getLayerBins(layout.bins, activeLayerId);

  // Calculate empty cells for Fill gaps button
  const totalCells = layout.drawer.width * layout.drawer.depth;
  const coveredCells = layerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const emptyCells = totalCells - coveredCells;

  const handleFillGaps = () => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    batch(() => {
      fillLayerGaps(activeLayerId, activeCategoryId, halfGridMode);
    });
    setTimeout(() => {
      const afterCount = getLayerBins(useLayoutStore.getState().layout.bins, activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(t('toast.fillComplete', { count: added }), 'success');
      }
    }, 0);
  };

  const handleClearLayer = () => {
    if (!activeLayerId || layerBins.length === 0) return;
    const count = layerBins.length;
    batch(() => {
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
    batch(() => {
      fillLayer(activeLayerId, width, depth, activeCategoryId, halfGridMode);
    });
    // Exit paint mode after filling
    setPaintSize(null);
    setTimeout(() => {
      const afterCount = getLayerBins(useLayoutStore.getState().layout.bins, activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(t('toast.fillWithSize', { count: added, width, depth }), 'success');
      }
    }, 0);
  };

  if (!activeLayer) return null;

  // Add bin directly to stash (Shift+click on size button in popover)
  const handleAddToStash = (w: number, d: number) => {
    batch(() => {
      addBin({
        layerId: STAGING_ID,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(w),
        depth: gridUnits(d),
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
        <Button
          ref={sizeButtonRef}
          variant={paintSize ? 'ghost' : 'secondary'}
          fullWidth
          onClick={handleSizeButtonClick}
          className={`text-sm h-8 gap-1.5 ${
            paintSize ? 'bg-accent/15 border border-accent/60 text-accent hover:bg-accent/25' : ''
          }`}
          title={
            paintSize
              ? t('layers.paintSizeTitle', { width: paintSize.width, depth: paintSize.depth })
              : t('layers.sizeSelector')
          }
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {ICON_PATHS.brush.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
          {paintSize ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
              {`${paintSize.width}×${paintSize.depth}`}
            </span>
          ) : (
            t('layers.sizeSelector')
          )}
          <svg
            className={`w-3 h-3 opacity-60 shrink-0 transition-transform ${popoverOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Button>

        {/* Status strip: makes paint mode unmistakable while a size is loaded */}
        {paintSize && (
          <div
            role="status"
            className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] leading-tight text-accent"
          >
            <svg
              className="w-3 h-3 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {ICON_PATHS.brush.map((d) => (
                <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
              ))}
            </svg>
            <span>
              {t('layers.brushStatus', { width: paintSize.width, depth: paintSize.depth })}
            </span>
          </div>
        )}

        {/* Row 2: Fill — shows "Fill with NxN" when size selected, "Fill gaps" otherwise */}
        {paintSize ? (
          <Button
            variant="primary"
            fullWidth
            onClick={handleFill}
            className="text-sm h-8"
            title={t('layers.fillTitle', { width: paintSize.width, depth: paintSize.depth })}
          >
            {t('layers.fillWith')}
            {paintSize.width}×{paintSize.depth}
          </Button>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            onClick={handleFillGaps}
            disabled={emptyCells === 0}
            className="text-sm h-8 gap-1.5"
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
          </Button>
        )}

        {/* Row 3: Clear layer */}
        <Button
          variant="ghost"
          fullWidth
          onClick={() => setShowClearConfirm(true)}
          disabled={layerBins.length === 0}
          className="text-sm h-8 gap-1.5 text-error hover:bg-error/10 hover:text-error"
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
        </Button>
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
