import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '../../store';
import { useToastStore } from '../../store/toast';
import { CONSTRAINTS, STAGING_ID } from '../../constants';
import { getDisplayLayers } from '../../utils/collision';
import { ConfirmDialog } from '../modals/ConfirmDialog';

/**
 * Mobile-optimized layers panel with larger touch targets.
 */
export function MobileLayersPanel() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteLayerId, setDeleteLayerId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { layout, addLayer, updateLayer, deleteLayer, reorderLayers, fillLayerGaps, clearLayer } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      addLayer: state.addLayer,
      updateLayer: state.updateLayer,
      deleteLayer: state.deleteLayer,
      reorderLayers: state.reorderLayers,
      fillLayerGaps: state.fillLayerGaps,
      clearLayer: state.clearLayer,
    }))
  );
  const layers = layout.layers;
  const bins = layout.bins;
  const drawer = layout.drawer;

  const { activeLayerId, activeCategoryId, setActiveLayer, setSelectedBins, closeMobilePanel, halfBinMode } = useUIStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      activeCategoryId: state.activeCategoryId,
      setActiveLayer: state.setActiveLayer,
      setSelectedBins: state.setSelectedBins,
      closeMobilePanel: state.closeMobilePanel,
      halfBinMode: state.halfBinMode,
    }))
  );

  const { execute } = useUndoableAction();
  const addToast = useToastStore(state => state.addToast);

  const totalLayerHeight = layers.reduce((sum, l) => sum + l.height, 0);
  const displayLayers = getDisplayLayers(layers);
  const hasMultipleLayers = layers.length > 1;

  // Coverage calculations
  const totalCells = drawer.width * drawer.depth;
  const activeLayerBins = bins.filter(b => b.layerId === activeLayerId);
  const activeCoveredCells = activeLayerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const activeCoverage = totalCells > 0 ? Math.round((activeCoveredCells / totalCells) * 100) : 0;
  const emptyCells = totalCells - activeCoveredCells;

  // Multi-layer stats
  const allPlacedBins = bins.filter(b => b.layerId !== STAGING_ID);
  const totalBinCount = allPlacedBins.length;
  const totalCoveredCells = allPlacedBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const totalAvailableCells = totalCells * layers.length;
  const totalCoverage = totalAvailableCells > 0
    ? Math.round((totalCoveredCells / totalAvailableCells) * 100)
    : 0;

  // Display is reversed: index 0 in display = last in array (top layer)
  const displayToArrayIndex = (displayIndex: number) => layers.length - 1 - displayIndex;

  const handleAddLayer = () => {
    execute(() => {
      const id = addLayer();
      if (id) {
        setActiveLayer(id);
      }
    });
  };

  const handleSelectLayer = (layerId: string) => {
    setActiveLayer(layerId);
    closeMobilePanel();
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= CONSTRAINTS.LAYERS_MIN) return;
    setDeleteLayerId(id);
  };

  const confirmDeleteLayer = () => {
    if (!deleteLayerId) return;
    execute(() => {
      const deleted = deleteLayer(deleteLayerId);
      if (deleted && activeLayerId === deleteLayerId && layers.length > 0) {
        const remaining = layers.filter(l => l.id !== deleteLayerId);
        if (remaining.length > 0) {
          setActiveLayer(remaining[0].id);
        }
      }
    });
    setDeleteLayerId(null);
  };

  const handleHeightChange = (id: string, delta: number) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    const newHeight = Math.max(1, layer.height + delta);
    execute(() => {
      updateLayer(id, { height: newHeight });
    });
  };

  const handleMoveLayer = (displayIndex: number, direction: 'up' | 'down') => {
    const targetDisplayIndex = direction === 'up' ? displayIndex - 1 : displayIndex + 1;
    if (targetDisplayIndex < 0 || targetDisplayIndex >= layers.length) return;

    const fromArrayIndex = displayToArrayIndex(displayIndex);
    const toArrayIndex = displayToArrayIndex(targetDisplayIndex);

    execute(() => {
      const result = reorderLayers(fromArrayIndex, toArrayIndex);
      if (!result.success && result.error) {
        setReorderError(result.error);
        setTimeout(() => setReorderError(null), 3000);
      }
    });
  };

  const handleFillGaps = () => {
    if (!activeLayerId) return;
    const beforeCount = activeLayerBins.length;
    execute(() => {
      fillLayerGaps(activeLayerId, activeCategoryId, halfBinMode);
    });
    setTimeout(() => {
      const afterCount = useLayoutStore.getState().layout.bins.filter(b => b.layerId === activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(`Added ${added} bin${added !== 1 ? 's' : ''} to fill gaps`, 'success');
      }
    }, 0);
  };

  const handleClear = () => {
    if (!activeLayerId || activeLayerBins.length === 0) return;
    const count = activeLayerBins.length;
    execute(() => {
      clearLayer(activeLayerId);
      setSelectedBins([]);
    });
    addToast(`Cleared ${count} bins from layer`, 'success');
    setShowClearConfirm(false);
  };

  const layerToDelete = deleteLayerId ? layers.find(l => l.id === deleteLayerId) : null;
  const binsInLayer = deleteLayerId ? bins.filter(b => b.layerId === deleteLayerId).length : 0;
  const canAddLayer = totalLayerHeight < drawer.height;
  const activeLayer = layers.find(l => l.id === activeLayerId);

  const cancelDeleteLayer = useCallback(() => {
    setDeleteLayerId(null);
  }, []);

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
                backgroundColor: totalLayerHeight >= drawer.height ? 'var(--color-warning)' : 'var(--color-info)',
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
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {reorderError}
        </div>
      )}

      {/* Layer list */}
      <div className="space-y-2">
        {displayLayers.map((layer, displayIndex) => {
          const isActive = layer.id === activeLayerId;
          const isEditing = editingId === layer.id;
          const layerBins = bins.filter(b => b.layerId === layer.id);
          const binCount = layerBins.length;
          const layerCoveredCells = layerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
          const layerCoverage = totalCells > 0 ? Math.round((layerCoveredCells / totalCells) * 100) : 0;

          return (
            <div
              key={layer.id}
              className={`border-l-4 overflow-hidden ${isActive ? 'bg-surface-hover border-l-accent' : 'bg-surface-elevated border-l-transparent'}`}
            >
              <button
                className="w-full p-4 text-left"
                onClick={() => !isEditing && handleSelectLayer(layer.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={layer.name}
                        onChange={(e) => execute(() => updateLayer(layer.id, { name: e.target.value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH) }))}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                        className="input w-full"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className={`truncate block text-content text-base ${isActive ? 'font-semibold' : 'font-medium'}`}
                        onClick={(e) => {
                          if (isActive) {
                            e.stopPropagation();
                            setEditingId(layer.id);
                          }
                        }}
                      >
                        {layer.name}
                      </span>
                    )}
                    <span
                      className="text-sm mt-1 block text-content-tertiary"
                    >
                      {binCount} bin{binCount !== 1 ? 's' : ''} · {layer.height}u{hasMultipleLayers ? ` · ${layerCoverage}%` : ''}
                    </span>
                  </div>
                </div>
              </button>

              {/* Layer controls */}
              <div
                className="flex items-center gap-2 px-4 py-2 border-t border-stroke-subtle"
              >
                {/* Height control */}
                <div className="flex items-center">
                  <button
                    onClick={() => handleHeightChange(layer.id, -1)}
                    disabled={layer.height <= 1}
                    className="btn btn-ghost w-11 h-11 p-0"
                    aria-label="Decrease height"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span
                    className="w-10 text-center text-sm font-medium text-content-secondary"
                  >
                    {layer.height}u
                  </span>
                  <button
                    onClick={() => handleHeightChange(layer.id, 1)}
                    className="btn btn-ghost w-11 h-11 p-0"
                    aria-label="Increase height"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1" />

                {/* Reorder buttons - only for active layer when multiple layers */}
                {isActive && hasMultipleLayers && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveLayer(displayIndex, 'up')}
                      disabled={displayIndex === 0}
                      className="btn btn-ghost w-11 h-11 p-0"
                      aria-label="Move layer up"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveLayer(displayIndex, 'down')}
                      disabled={displayIndex === layers.length - 1}
                      className="btn btn-ghost w-11 h-11 p-0"
                      aria-label="Move layer down"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Delete */}
                {layers.length > 1 && (
                  <button
                    onClick={() => handleDeleteLayer(layer.id)}
                    className="btn btn-ghost w-11 h-11 p-0 text-error"
                    aria-label="Delete layer"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Fill Gaps / Clear actions - only for active layer */}
              {isActive && (
                <div className="flex items-center gap-2 px-4 py-2 border-t border-stroke-subtle">
                  <button
                    onClick={handleFillGaps}
                    disabled={emptyCells === 0}
                    className="btn btn-secondary flex-1 h-11"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    {emptyCells > 0 ? `Fill ${emptyCells}` : 'Filled'}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={binCount === 0}
                    className="btn btn-ghost h-11 text-error"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats line */}
      <div className="text-sm text-content-tertiary mb-2 mt-4">
        {hasMultipleLayers
          ? `${totalCoverage}% filled · ${totalBinCount} bin${totalBinCount !== 1 ? 's' : ''} total`
          : `${activeCoverage}% filled · ${activeLayerBins.length} bin${activeLayerBins.length !== 1 ? 's' : ''}`
        }
      </div>

      {/* Coverage bar */}
      <div className="h-2 rounded-full overflow-hidden mb-4 bg-surface-elevated">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${hasMultipleLayers ? totalCoverage : activeCoverage}%`,
            backgroundColor: (hasMultipleLayers ? totalCoverage : activeCoverage) === 100
              ? 'var(--color-success)'
              : 'var(--text-tertiary)',
          }}
        />
      </div>

      {/* Add layer button */}
      <button
        onClick={handleAddLayer}
        disabled={!canAddLayer}
        className="btn btn-primary w-full"
      >
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Layer
      </button>

      <ConfirmDialog
        isOpen={deleteLayerId !== null}
        title="Delete Layer"
        message={`Delete "${layerToDelete?.name}"${binsInLayer > 0 ? ` and its ${binsInLayer} bin${binsInLayer > 1 ? 's' : ''}` : ''}?`}
        confirmText="Delete"
        destructive
        onConfirm={confirmDeleteLayer}
        onCancel={cancelDeleteLayer}
      />

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Layer"
        message={`Remove all ${activeLayerBins.length} bin${activeLayerBins.length !== 1 ? 's' : ''} from "${activeLayer?.name}"? This can be undone.`}
        confirmText="Clear"
        destructive
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
