import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMutations } from '@/shared/contexts';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useToastStore } from '@/core/store/toast';
import { STAGING_ID } from '@/core/constants';
import { gridUnits } from '@/core/types';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SizeSelectorPopover } from './SizeSelectorPopover';
import { useLayerFillActions } from '../../hooks/useLayerFillActions';
import { batch } from '@/core/cqrs';

export function ActiveLayerPanel() {
  const t = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);

  const { addBin } = useMutations();
  const activeCategoryId = useSelectionStore((state) => state.activeCategoryId);

  const { paintSize, togglePaintSize } = useInteractionStore(
    useShallow((state) => ({
      paintSize: state.paintSize,
      togglePaintSize: state.togglePaintSize,
    }))
  );

  const addToast = useToastStore((state) => state.addToast);

  const {
    activeLayer,
    layerBins,
    emptyCells,
    clearConfirmOpen,
    setClearConfirmOpen,
    fillGaps,
    confirmClear,
    fillWithSize,
  } = useLayerFillActions();
  const hasBins = layerBins.length > 0;

  const handleFill = () => {
    if (!paintSize) return;
    fillWithSize(paintSize.width, paintSize.depth);
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
            className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-label leading-tight text-accent"
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
            onClick={fillGaps}
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
          onClick={() => setClearConfirmOpen(true)}
          disabled={!hasBins}
          className={`text-sm h-8 gap-1.5 ${
            hasBins ? 'text-error hover:bg-error/10 hover:text-error' : ''
          }`}
          title={
            hasBins
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
          {hasBins
            ? t('layers.clearBins', { count: layerBins.length })
            : t('layers.clearLayerLabel')}
        </Button>
      </div>

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
