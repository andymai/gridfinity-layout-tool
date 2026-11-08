import { useState, useMemo } from 'react';
import { useLayoutStore } from '@/core/store';
import { getGridBins, getLayerBins } from '@/shared/utils';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { IconButton, PlusIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { CONSTRAINTS } from '@/core/constants';
import type { LayerId } from '@/core/types';
import { useDrawerCeiling } from '@/shared/hooks/useDrawerCeiling';
import { LayerRows } from './LayerRows';
import { TallestStackMeter } from '../TallestStackMeter';
import { useLayerListController } from '../../hooks/useLayerListController';
import { PanelSection } from '@/shared/components/PanelSection';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';

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
    tallestStack,
    drawerHeight,
    canAddLayer,
    addNewLayer,
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

  const addLayerButton = (
    <IconButton
      size="sm"
      touchTarget={false}
      onClick={addNewLayer}
      disabled={!canAddLayer}
      className="w-7 h-7"
      title={
        canAddLayer
          ? t('layers.addNewLayer')
          : t('layers.maxLayersReached', { max: CONSTRAINTS.LAYERS_MAX })
      }
      aria-label={t('layers.addNewLayer')}
    >
      <PlusIcon className="w-4 h-4" />
    </IconButton>
  );

  return (
    <div>
      <StickyGroupHeader variant="band" title={t('common.layers')} actions={addLayerButton}>
        <PanelSection>
          <div className="mb-3">
            <LayerRows
              layers={displayLayers}
              activeLayerId={activeLayerId}
              hoveredLayerId={hoveredLayerId}
              editingLayerId={editingLayerId}
              onLayerClick={setActiveLayer}
              onLayerHover={setHoveredLayerId}
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

          <div className="mb-3">
            <TallestStackMeter tallest={tallestStack} drawerHeight={drawerHeight} />
            {ceiling !== null && !ceiling.fits && (
              <p className="mt-1 text-micro text-warning tabular-nums">
                {t('drawerCeiling.layerOverflow', {
                  over: String(Math.round(-ceiling.slackMm * 10) / 10),
                })}
              </p>
            )}
          </div>

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
          <div className="text-micro text-content-disabled tabular-nums">
            {hasMultipleLayers
              ? totalBinCount === 1
                ? t('layers.statsTotalOne', { coverage: totalCoverage })
                : t('layers.statsTotal', { coverage: totalCoverage, count: totalBinCount })
              : effectiveBinCount === 1
                ? t('layers.statsOne', { coverage: effectiveCoverage })
                : t('layers.stats', { coverage: effectiveCoverage, count: effectiveBinCount })}
          </div>
        </PanelSection>
      </StickyGroupHeader>

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
