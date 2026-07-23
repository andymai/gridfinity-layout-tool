import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutStore } from '@/core/store/layout';
import { useInteractionStore } from '@/core/store';
import type { LayerId } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { getGridBins, getLayerBins } from '@/shared/utils';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useTranslation } from '@/i18n';
import { Button, IconButton, PlusIcon, MinusIcon } from '@/design-system';
import { useLayerListController } from '@/features/layers/hooks/useLayerListController';

/**
 * Layers tab content - layer list with selection, height controls, reordering, and deletion.
 * Mobile-optimized with 44px touch targets.
 */
export function LayersTab() {
  const t = useTranslation();
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [renameLayerId, setRenameLayerId] = useState<LayerId | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Scroll rename input into view when keyboard appears on mobile
  useEffect(() => {
    if (renameLayerId && renameInputRef.current) {
      // Small delay to allow keyboard to appear
      const timer = setTimeout(() => {
        renameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [renameLayerId]);

  const layout = useLayoutStore((state) => state.layout);
  const bins = layout.bins;
  const drawer = layout.drawer;

  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

  const {
    layers,
    displayLayers,
    activeLayerId,
    setActiveLayer,
    totalLayerHeight,
    canAddLayer,
    addLayerWithAutoExpand,
    deleteLayerId,
    layerToDelete,
    deletedLayerBinCount,
    requestDelete,
    confirmDelete,
    cancelDelete,
    renameLayer,
    changeLayerHeight,
    reorderByDisplayIndex,
  } = useLayerListController({
    onReorderError: (message) => {
      setReorderError(message);
      setTimeout(() => setReorderError(null), 3000);
    },
  });

  const handleRenameRequest = (id: LayerId) => {
    const layer = layers.find((l) => l.id === id);
    setRenameValue(layer?.name || '');
    setRenameLayerId(id);
  };

  const handleRenameConfirm = () => {
    if (!renameLayerId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameLayer(renameLayerId, trimmed);
      announceToScreenReader(t('layers.announce.renamedTo', { name: trimmed }));
    }
    setRenameLayerId(null);
    setRenameValue('');
  };

  const hasMultipleLayers = layers.length > 1;

  // Coverage calculations
  const totalCells = drawer.width * drawer.depth;

  // Multi-layer stats
  const allPlacedBins = getGridBins(bins);
  const totalBinCount = allPlacedBins.length;
  const totalCoveredCells = allPlacedBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const totalAvailableCells = totalCells * layers.length;
  const totalCoverage =
    totalAvailableCells > 0 ? Math.round((totalCoveredCells / totalAvailableCells) * 100) : 0;

  // Single layer stats
  const activeLayerBins = getLayerBins(bins, activeLayerId);
  const activeCoverage =
    totalCells > 0
      ? Math.round(
          (activeLayerBins.reduce((sum, b) => sum + b.width * b.depth, 0) / totalCells) * 100
        )
      : 0;

  const handleMoveLayer = (displayIndex: number, direction: 'up' | 'down') => {
    const targetDisplayIndex = direction === 'up' ? displayIndex - 1 : displayIndex + 1;
    reorderByDisplayIndex(displayIndex, targetDisplayIndex);
  };

  return (
    <div className="pb-4">
      {/* Layer usage indicator - only show for multiple layers */}
      {hasMultipleLayers && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-elevated">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (totalLayerHeight / drawer.height) * 100)}%`,
                backgroundColor:
                  totalLayerHeight >= drawer.height ? 'var(--color-warning)' : 'var(--color-info)',
              }}
            />
          </div>
          <span
            className={`text-xs ${totalLayerHeight >= drawer.height ? 'text-warning' : 'text-content-tertiary'}`}
          >
            {totalLayerHeight}/{drawer.height}u
          </span>
        </div>
      )}

      {/* Reorder error message */}
      {reorderError && (
        <div className="mb-3 p-3 rounded-lg flex items-center gap-2 bg-error-muted border border-error text-error text-sm">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {reorderError}
        </div>
      )}

      {/* Layer list */}
      <div className="space-y-1.5">
        {displayLayers.map((layer, displayIndex) => {
          const isActive = layer.id === activeLayerId;
          const layerBins = getLayerBins(bins, layer.id);
          const binCount = layerBins.length;
          const layerCoveredCells = layerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
          const layerCoverage =
            totalCells > 0 ? Math.round((layerCoveredCells / totalCells) * 100) : 0;

          return (
            <div
              key={layer.id}
              className={`flex items-center gap-2 px-3 py-2 border-l-2 ${
                isActive
                  ? 'bg-surface-hover border-l-accent'
                  : 'bg-surface-elevated border-l-transparent'
              }`}
            >
              {/* Layer info - tappable to select */}
              <Button
                variant="ghost"
                touchTarget={false}
                className="flex-1 min-w-0 flex-col items-start text-left py-1 px-0 hover:bg-transparent"
                onClick={() => setActiveLayer(layer.id)}
              >
                <span
                  className={`truncate block text-sm ${isActive ? 'text-content font-semibold' : 'text-content font-medium'}`}
                  title={layer.name}
                  role="presentation"
                  onClick={(e) => {
                    if (isActive) {
                      e.stopPropagation();
                      handleRenameRequest(layer.id);
                    }
                  }}
                >
                  {layer.name}
                </span>
                <span className="text-xs text-content-tertiary">
                  {t('mobile.layers.binCount', { count: binCount })}
                  {hasMultipleLayers ? ` · ${layerCoverage}%` : ''}
                </span>
              </Button>

              {/* Height control - compact */}
              <div className="flex items-center gap-1">
                <IconButton
                  size="lg"
                  onClick={() => changeLayerHeight(layer.id, -1)}
                  disabled={layer.height <= CONSTRAINTS.MIN_LAYER_HEIGHT}
                  className="w-10 h-10 text-content-tertiary active:bg-surface-hover"
                  aria-label={t('layers.decreaseHeight', { name: layer.name })}
                >
                  <MinusIcon size="sm" />
                </IconButton>
                <span
                  className="text-center text-xs font-medium text-content-secondary tabular-nums whitespace-nowrap min-w-[2ch]"
                  title={t('layers.heightTooltip')}
                >
                  {layer.height}u
                </span>
                <IconButton
                  size="lg"
                  onClick={() => changeLayerHeight(layer.id, 1)}
                  className="w-10 h-10 text-content-tertiary active:bg-surface-hover"
                  aria-label={t('layers.increaseHeight', { name: layer.name })}
                >
                  <PlusIcon size="sm" />
                </IconButton>
              </div>

              {/* Reorder buttons - only for active layer when multiple layers */}
              {isActive && hasMultipleLayers && (
                <div className="flex items-center">
                  <IconButton
                    touchTarget={false}
                    onClick={() => handleMoveLayer(displayIndex, 'up')}
                    disabled={displayIndex === 0}
                    className="w-8 h-8 text-content-tertiary hover:text-content"
                    aria-label={t('mobile.moveLayerUp')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </IconButton>
                  <IconButton
                    touchTarget={false}
                    onClick={() => handleMoveLayer(displayIndex, 'down')}
                    disabled={displayIndex === layers.length - 1}
                    className="w-8 h-8 text-content-tertiary hover:text-content"
                    aria-label={t('mobile.moveLayerDown')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </IconButton>
                </div>
              )}

              {/* Delete */}
              {layers.length > 1 && (
                <IconButton
                  touchTarget={false}
                  variant="dangerGhost"
                  onClick={() => requestDelete(layer.id)}
                  className="w-8 h-8 text-content-tertiary"
                  aria-label={t('mobile.deleteLayer')}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </IconButton>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats line */}
      <div className="text-sm text-content-tertiary mb-2 mt-4">
        {hasMultipleLayers
          ? t('mobile.layers.statsMulti', {
              coverage: totalCoverage,
              count: totalBinCount,
              layers: layers.length,
            })
          : t('mobile.layers.statsSingle', {
              coverage: activeCoverage,
              count: activeLayerBins.length,
            })}
      </div>

      {/* Coverage bar */}
      <div className="h-2 rounded-full overflow-hidden mb-4 bg-surface-elevated">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${hasMultipleLayers ? totalCoverage : activeCoverage}%`,
            backgroundColor:
              (hasMultipleLayers ? totalCoverage : activeCoverage) === 100
                ? 'var(--color-success)'
                : 'var(--text-tertiary)',
          }}
        />
      </div>

      {/* Add layer button */}
      <Button
        variant="primary"
        fullWidth
        onClick={addLayerWithAutoExpand}
        disabled={!canAddLayer}
        leftIcon={<PlusIcon />}
      >
        {t('layers.addLayer')}
      </Button>

      <ConfirmDialog
        isOpen={deleteLayerId !== null}
        title={t('layers.confirmDelete.title')}
        message={t('layers.confirmDelete.message', {
          name: layerToDelete?.name || '',
          count: deletedLayerBinCount,
        })}
        confirmText={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Rename action sheet - portaled to escape BottomSheet's scrollable container */}
      {renameLayerId &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 z-[60] flex items-end"
            onClick={() => {
              setRenameLayerId(null);
              setRenameValue('');
            }}
            role="presentation"
          >
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
            <div
              className="bg-surface-elevated w-full rounded-t-2xl p-4 pb-8 animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="w-10 h-1 bg-content-disabled rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-content mb-4">{t('mobile.renameLayer')}</h3>
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameConfirm();
                  } else if (e.key === 'Escape') {
                    setRenameLayerId(null);
                    setRenameValue('');
                  }
                }}
                className="w-full bg-surface px-4 py-3 rounded-lg border border-stroke focus:border-accent focus:outline-none text-content text-base"
                placeholder={t('layers.layerNamePlaceholder')}
                maxLength={CONSTRAINTS.LABEL_MAX_LENGTH}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
                autoFocus
              />
              <div className="flex gap-2 mt-4">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setRenameLayerId(null);
                    setRenameValue('');
                  }}
                  className="flex-1 py-3 text-content-secondary bg-surface rounded-lg"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleRenameConfirm}
                  disabled={!renameValue.trim()}
                  className="flex-1 py-3 text-on-dark bg-accent rounded-lg disabled:opacity-50"
                >
                  {t('common.rename')}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
