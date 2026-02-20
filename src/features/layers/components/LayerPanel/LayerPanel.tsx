import { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
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
  // Derive edit mode: only active when the editing layer matches the active layer
  const editingName = editingLayerId === activeLayerId && editingLayerId !== null;

  // Height capacity tracking
  const totalLayerHeight = layers.reduce((sum, l) => sum + l.height, 0);
  const drawerHeight = layout.drawer.height;
  const canAddLayer = layers.length < CONSTRAINTS.LAYERS_MAX && totalLayerHeight < drawerHeight;
  const heightFull = totalLayerHeight >= drawerHeight;

  const totalCells = layout.drawer.width * layout.drawer.depth;
  const hasMultipleLayers = layers.length > 1;

  // Display is reversed: index 0 in display = last in array (top layer)
  const displayToArrayIndex = (displayIndex: number) => layers.length - 1 - displayIndex;
  const displayLayers = getDisplayLayers(layers);

  // Build per-layer stats for the diagram tooltips
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

  // Aggregate stats
  const allPlacedBins = getGridBins(layout.bins);
  const totalBinCount = allPlacedBins.length;
  const totalCoveredCells = allPlacedBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const totalAvailableCells = totalCells * layers.length;
  const totalCoverage =
    totalAvailableCells > 0 ? Math.round((totalCoveredCells / totalAvailableCells) * 100) : 0;

  // Active layer stats (for single-layer display and controls)
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
    const newHeight = Math.max(1, layer.height + delta);
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

  const handleLayerDoubleClick = (layerId: LayerId) => {
    setActiveLayer(layerId);
    setEditingLayerId(layerId);
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
        {/* Cross-section diagram — primary layer UI */}
        <div className="mb-3">
          <HeightCrossSectionDiagram
            layers={displayLayers}
            drawerHeight={drawerHeight}
            activeLayerId={activeLayerId}
            hoveredLayerId={hoveredLayerId}
            canAddLayer={canAddLayer}
            onLayerClick={setActiveLayer}
            onLayerDoubleClick={handleLayerDoubleClick}
            onLayerHover={setHoveredLayerId}
            onAddLayer={handleAddLayer}
            onReorder={handleReorder}
            layerStats={layerStats}
          />
        </div>

        {/* Active layer controls — lightweight inline row, subordinate to diagram */}
        <div
          className="flex items-center gap-1.5 text-xs mb-3"
          data-testid="layer-controls"
          onMouseEnter={() => setHoveredLayerId(activeLayerId)}
          onMouseLeave={() => setHoveredLayerId(null)}
        >
          {/* Editable name */}
          {editingName ? (
            <input
              type="text"
              value={activeLayer.name}
              onChange={(e) => handleNameChange(activeLayer.id, e.target.value)}
              onBlur={() => setEditingLayerId(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingLayerId(null)}
              className="flex-1 bg-surface-elevated rounded px-1 py-0.5 text-xs font-medium outline-none text-content min-w-0"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: user triggered edit via double-click
              autoFocus
              aria-label={t('layers.layerNamePlaceholder')}
            />
          ) : (
            <button
              className="flex-1 text-left truncate bg-transparent border-none p-0 font-medium cursor-text text-content min-w-0"
              onClick={() => setEditingLayerId(activeLayerId)}
              title={t('layers.clickToRename')}
              aria-label={t('layers.layerButtonAria', {
                name: activeLayer.name,
                height: activeLayer.height,
                coverage: activeStat?.coverage ?? 0,
                suffix: t('layers.activeClickToRename'),
              })}
            >
              {activeLayer.name}
            </button>
          )}

          {/* Height stepper */}
          <div className="flex items-center gap-0.5" role="presentation">
            <button
              onClick={() => handleHeightChange(activeLayer.id, -1)}
              disabled={activeLayer.height <= 1}
              className="w-5 h-5 flex items-center justify-center rounded text-content-disabled hover:text-content hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={t('layers.decreaseHeight', { name: activeLayer.name })}
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span
              className="text-[10px] tabular-nums min-w-[20px] text-center text-content-tertiary"
              title={t('layers.heightTooltip')}
            >
              {activeLayer.height}u
            </span>
            <button
              onClick={() => handleHeightChange(activeLayer.id, 1)}
              className="w-5 h-5 flex items-center justify-center rounded text-content-disabled hover:text-content hover:bg-surface-hover transition-colors"
              aria-label={t('layers.increaseHeight', { name: activeLayer.name })}
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>

          {/* Delete button — only when multiple layers */}
          {hasMultipleLayers && (
            <button
              onClick={() => setDeleteLayerId(activeLayer.id)}
              className="p-1 rounded text-content-disabled hover:text-error hover:bg-surface-hover transition-colors"
              title={t('layers.deleteTooltip')}
              aria-label={t('layers.deleteLayerAria', { name: activeLayer.name })}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Aggregate stats row */}
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

      {/* Delete layer confirmation */}
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
