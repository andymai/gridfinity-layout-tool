import { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useUndoableAction } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useMutations } from '@/shared/contexts';
import { CONSTRAINTS } from '@/core/constants';
import { getGridBins, getLayerBins } from '@/shared/utils';
import { getDisplayLayers } from '@/shared/utils/collision';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { isOk, isErr, getUserMessage } from '@/core/result';
import { useToastStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { calculateLayerAutoExpansion } from '@/features/layers/utils/layerAutoExpansion';
import type { LayerId } from '@/core/types';
import { HeightCrossSectionDiagram } from './HeightCrossSectionDiagram';

export function LayerPanel() {
  const t = useTranslation();
  const [deleteLayerId, setDeleteLayerId] = useState<LayerId | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<LayerId | null>(null);
  const [hoveredLayerId, setHoveredLayerId] = useState<LayerId | null>(null);

  const layout = useLayoutStore((state) => state.layout);
  const { addLayer, updateLayer, deleteLayer, reorderLayers } = useMutations();

  const { activeLayerId, setActiveLayer } = useSelectionStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      setActiveLayer: state.setActiveLayer,
    }))
  );

  const { execute } = useUndoableAction();
  const addToast = useToastStore((state) => state.addToast);

  const layers = layout.layers;
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const totalLayerHeight = layers.reduce((sum, l) => sum + l.height, 0);
  const drawerHeight = layout.drawer.height;
  const canAddLayer = layers.length < CONSTRAINTS.LAYERS_MAX && totalLayerHeight < drawerHeight;
  const heightFull = totalLayerHeight > drawerHeight;

  const totalCells = layout.drawer.width * layout.drawer.depth;
  const hasMultipleLayers = layers.length > 1;

  const displayToArrayIndex = (displayIndex: number) => layers.length - 1 - displayIndex;
  const displayLayers = getDisplayLayers(layers);

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

  const allPlacedBins = getGridBins(layout.bins);
  const totalBinCount = allPlacedBins.length;
  const totalCoveredCells = allPlacedBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const totalAvailableCells = totalCells * layers.length;
  const totalCoverage =
    totalAvailableCells > 0 ? Math.round((totalCoveredCells / totalAvailableCells) * 100) : 0;

  const activeStat = activeLayerId ? layerStats[activeLayerId] : undefined;
  const effectiveCoverage = hasMultipleLayers ? totalCoverage : (activeStat?.coverage ?? 0);
  const effectiveBinCount = hasMultipleLayers ? totalBinCount : (activeStat?.binCount ?? 0);

  const handleAddLayer = () => {
    const topLayer = layers[layers.length - 1];

    const expansion = calculateLayerAutoExpansion(
      topLayer,
      layout.bins,
      totalLayerHeight,
      drawerHeight
    );

    if (expansion.wouldExceedCapacity && expansion.smallestExceedingHeight !== undefined) {
      addToast(
        t('layers.cannotAddLayerTallBins', {
          layerName: topLayer.name,
          binHeight: expansion.smallestExceedingHeight,
          layerHeight: topLayer.height,
        }),
        'error'
      );
      return;
    }

    if (expansion.needsExpansion && expansion.newHeight !== undefined) {
      const newHeight = expansion.newHeight;
      execute(() => {
        const expandResult = updateLayer(topLayer.id, { height: newHeight });
        if (isErr(expandResult)) {
          addToast(getUserMessage(expandResult.error), 'error');
          return;
        }
        const addResult = addLayer();
        if (isOk(addResult)) {
          setActiveLayer(addResult.value);
        } else {
          addToast(getUserMessage(addResult.error), 'error');
        }
      });
    } else {
      execute(() => {
        const result = addLayer();
        if (isOk(result)) {
          setActiveLayer(result.value);
        }
      });
    }
  };

  const handleDeleteLayer = useCallback(() => {
    if (!deleteLayerId) return;
    execute(() => {
      const result = deleteLayer(deleteLayerId);
      if (isOk(result) && activeLayerId === deleteLayerId && layers.length > 0) {
        const remaining = layers.filter((l) => l.id !== deleteLayerId);
        if (remaining.length > 0) {
          setActiveLayer(remaining[0].id);
        }
      }
    });
    setDeleteLayerId(null);
  }, [deleteLayerId, deleteLayer, activeLayerId, layers, setActiveLayer, execute]);

  const handleNameChange = (layerId: LayerId, name: string) => {
    execute(() => {
      const result = updateLayer(layerId, {
        name: name.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH),
      });
      if (isErr(result)) {
        addToast(getUserMessage(result.error), 'error');
      }
    });
  };

  const handleHeightChange = (layerId: LayerId, delta: number) => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    const newHeight = Math.max(CONSTRAINTS.MIN_LAYER_HEIGHT, layer.height + delta);
    execute(() => {
      const result = updateLayer(layerId, { height: newHeight });
      if (isErr(result)) {
        addToast(getUserMessage(result.error), 'error');
      }
    });
  };

  const handleReorder = (fromDisplayIndex: number, toDisplayIndex: number) => {
    const fromArrayIndex = displayToArrayIndex(fromDisplayIndex);
    const toArrayIndex = displayToArrayIndex(toDisplayIndex);
    execute(() => {
      const result = reorderLayers(fromArrayIndex, toArrayIndex);
      if (isErr(result)) {
        addToast(getUserMessage(result.error), 'error');
      }
    });
  };

  const layerToDelete = deleteLayerId ? layers.find((l) => l.id === deleteLayerId) : null;
  const deletedLayerBinCount = !deleteLayerId ? 0 : getLayerBins(layout.bins, deleteLayerId).length;

  if (!activeLayer) return null;

  const getAddLayerTitle = (): string => {
    if (canAddLayer) return t('layers.addNewLayer');
    if (heightFull)
      return t('layers.maxHeightFull', { current: totalLayerHeight, max: drawerHeight });
    return t('layers.maxLayersReached', { max: CONSTRAINTS.LAYERS_MAX });
  };

  const addLayerButton = (
    <button
      onClick={handleAddLayer}
      disabled={!canAddLayer}
      className="btn btn-ghost w-7 h-7 p-0 min-w-0 min-h-0"
      title={getAddLayerTitle()}
      aria-label={t('layers.addNewLayer')}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );

  return (
    <div>
      <CollapsibleSection title={t('common.layers')} variant="default" actions={addLayerButton}>
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
            onAddLayer={handleAddLayer}
            onReorder={handleReorder}
            onNameChange={handleNameChange}
            onHeightChange={handleHeightChange}
            onDeleteLayer={setDeleteLayerId}
            onEditingStart={(id) => {
              setActiveLayer(id);
              setEditingLayerId(id);
            }}
            onEditingEnd={() => setEditingLayerId(null)}
            layerStats={layerStats}
          />
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
        <div className="flex items-center gap-1 text-[10px] text-content-disabled tabular-nums">
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
      </CollapsibleSection>

      <ConfirmDialog
        isOpen={deleteLayerId !== null}
        title={t('layers.confirmDelete.title')}
        message={t('layers.confirmDelete.message', {
          name: layerToDelete?.name || '',
          count: deletedLayerBinCount,
        })}
        confirmText={t('common.delete')}
        destructive
        onConfirm={handleDeleteLayer}
        onCancel={() => setDeleteLayerId(null)}
      />
    </div>
  );
}
