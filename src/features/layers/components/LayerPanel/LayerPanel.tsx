import { useState, useMemo } from 'react';
import { useLayoutStore } from '@/core/store';
import { getGridBins, getLayerBins } from '@/shared/utils';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Collapsible, IconButton, PlusIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { CONSTRAINTS } from '@/core/constants';
import type { LayerId } from '@/core/types';
import { useDrawerCeiling } from '@/shared/hooks/useDrawerCeiling';
import { HeightCrossSectionDiagram } from './HeightCrossSectionDiagram';
import { useLayerListController } from '../../hooks/useLayerListController';

export function LayerPanel() {
  const t = useTranslation();
  const [editingLayerId, setEditingLayerId] = useState<LayerId | null>(null);
  const [hoveredLayerId, setHoveredLayerId] = useState<LayerId | null>(null);

  const layout = useLayoutStore((state) => state.layout);
  const {
    layers,
    displayLayers,
    activeLayerId,
    activeLayer,
    setActiveLayer,
    totalLayerHeight,
    canAddLayer,
    heightFull,
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
  } = useLayerListController();

  const drawerHeight = layout.drawer.height;
  const totalCells = layout.drawer.width * layout.drawer.depth;
  const hasMultipleLayers = layers.length > 1;

  const layerStats = useMemo(() => {
    const stats: Record<string, { coverage: number; binCount: number }> = {};
    for (const layer of layers) {
      const bins = getLayerBins(layout.bins, layer.id);
      const covered = bins.reduce((sum, b) => sum + b.width * b.depth, 0);
      stats[layer.id] = {
        coverage: totalCells > 0 ? Math.round((covered / totalCells) * 100) : 0,
        binCount: bins.length,
      };
    }
    return stats;
  }, [layers, layout.bins, totalCells]);

  const ceiling = useDrawerCeiling();
  const allPlacedBins = getGridBins(layout.bins);
  const totalBinCount = allPlacedBins.length;
  const totalCoveredCells = allPlacedBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const totalAvailableCells = totalCells * layers.length;
  const totalCoverage =
    totalAvailableCells > 0 ? Math.round((totalCoveredCells / totalAvailableCells) * 100) : 0;

  const activeStat = activeLayerId ? layerStats[activeLayerId] : undefined;
  const effectiveCoverage = hasMultipleLayers ? totalCoverage : (activeStat?.coverage ?? 0);
  const effectiveBinCount = hasMultipleLayers ? totalBinCount : (activeStat?.binCount ?? 0);

  if (!activeLayer) return null;

  const getAddLayerTitle = (): string => {
    if (canAddLayer) return t('layers.addNewLayer');
    if (heightFull)
      return t('layers.maxHeightFull', { current: totalLayerHeight, max: drawerHeight });
    return t('layers.maxLayersReached', { max: CONSTRAINTS.LAYERS_MAX });
  };

  const addLayerButton = (
    <IconButton
      size="sm"
      touchTarget={false}
      onClick={addLayerWithAutoExpand}
      disabled={!canAddLayer}
      className="w-7 h-7"
      title={getAddLayerTitle()}
      aria-label={t('layers.addNewLayer')}
    >
      <PlusIcon className="w-4 h-4" />
    </IconButton>
  );

  return (
    <div>
      <Collapsible title={t('common.layers')} size="md" actions={addLayerButton}>
        <div className="mb-3">
          <HeightCrossSectionDiagram
            layers={displayLayers}
            drawerHeight={drawerHeight}
            activeLayerId={activeLayerId}
            hoveredLayerId={hoveredLayerId}
            canAddLayer={canAddLayer}
            editingLayerId={editingLayerId}
            onLayerClick={setActiveLayer}
            onLayerHover={setHoveredLayerId}
            onAddLayer={addLayerWithAutoExpand}
            onReorder={reorderByDisplayIndex}
            onNameChange={renameLayer}
            onHeightChange={changeLayerHeight}
            onDeleteLayer={requestDelete}
            onEditingStart={(id) => {
              setActiveLayer(id);
              setEditingLayerId(id);
            }}
            onEditingEnd={() => setEditingLayerId(null)}
            layerStats={layerStats}
          />
        </div>

        {ceiling !== null && !ceiling.fits && (
          <p className="mb-1.5 text-micro text-warning tabular-nums">
            {t('drawerCeiling.layerOverflow', {
              over: String(Math.round(-ceiling.slackMm * 10) / 10),
            })}
          </p>
        )}

        <div className="h-1 rounded-full overflow-hidden bg-surface-elevated mb-1.5">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${effectiveCoverage}%`,
              backgroundColor:
                effectiveCoverage === 100 ? 'var(--color-success)' : 'var(--text-tertiary)',
            }}
          />
        </div>
        <div className="flex items-center gap-1 text-micro text-content-disabled tabular-nums">
          <span>
            {hasMultipleLayers
              ? t('layers.statsTotal', { coverage: totalCoverage, count: totalBinCount })
              : t('layers.stats', { coverage: effectiveCoverage, count: effectiveBinCount })}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t('layers.heightTotal', { used: totalLayerHeight, total: drawerHeight })}</span>
          {heightFull && (
            <svg
              className="w-3 h-3 text-warning ml-auto flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-label={t('layers.maxHeightFull', {
                current: totalLayerHeight,
                max: drawerHeight,
              })}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>
      </Collapsible>

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
    </div>
  );
}
