import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '../../store';
import { useToastStore } from '../../store/toast';
import { CONSTRAINTS, STAGING_ID } from '../../constants';
import { getDisplayLayers } from '../../utils/collision';
import { ConfirmDialog } from '../modals/ConfirmDialog';

export function LayerPanel() {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteLayerId, setDeleteLayerId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const { layout, fillLayerGaps, clearLayer, addLayer, updateLayer, deleteLayer, reorderLayers, updateDrawer } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      fillLayerGaps: state.fillLayerGaps,
      clearLayer: state.clearLayer,
      addLayer: state.addLayer,
      updateLayer: state.updateLayer,
      deleteLayer: state.deleteLayer,
      reorderLayers: state.reorderLayers,
      updateDrawer: state.updateDrawer,
    }))
  );

  const { activeLayerId, activeCategoryId, setSelectedBins, setActiveLayer } = useUIStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      activeCategoryId: state.activeCategoryId,
      setSelectedBins: state.setSelectedBins,
      setActiveLayer: state.setActiveLayer,
    }))
  );

  const addToast = useToastStore(state => state.addToast);
  const { execute } = useUndoableAction();

  const layers = layout.layers;
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const layerBins = layout.bins.filter(b => b.layerId === activeLayerId);
  const binCount = layerBins.length;

  const totalCells = layout.drawer.width * layout.drawer.depth;
  const coveredCells = layerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const coverage = totalCells > 0 ? Math.round((coveredCells / totalCells) * 100) : 0;
  const emptyCells = totalCells - coveredCells;

  const hasMultipleLayers = layers.length > 1;
  const totalLayerHeight = layers.reduce((sum, l) => sum + l.height, 0);

  // Total stats across all layers
  const allPlacedBins = layout.bins.filter(b => b.layerId !== STAGING_ID);
  const totalBinCount = allPlacedBins.length;
  const totalCoveredCells = allPlacedBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const totalAvailableCells = totalCells * layers.length;
  const totalCoverage = totalAvailableCells > 0 ? Math.round((totalCoveredCells / totalAvailableCells) * 100) : 0;

  // Display is reversed: index 0 in display = last in array (top layer)
  const displayToArrayIndex = (displayIndex: number) => layers.length - 1 - displayIndex;
  const displayLayers = getDisplayLayers(layers);

  const handleFillGaps = () => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    execute(() => {
      fillLayerGaps(activeLayerId, activeCategoryId);
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
    if (!activeLayerId || layerBins.length === 0) return;
    const count = layerBins.length;
    execute(() => {
      clearLayer(activeLayerId);
      setSelectedBins([]);
    });
    addToast(`Cleared ${count} bins from layer`, 'success');
    setShowClearConfirm(false);
  };

  const handleAddLayer = () => {
    execute(() => {
      const id = addLayer();
      if (id) {
        setActiveLayer(id);
      }
    });
  };

  const handleDeleteLayer = useCallback(() => {
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
  }, [deleteLayerId, deleteLayer, activeLayerId, layers, setActiveLayer, execute]);

  const handleNameChange = (layerId: string, name: string) => {
    execute(() => {
      updateLayer(layerId, { name: name.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH) });
    });
  };

  const handleHeightChange = (layerId: string, delta: number) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const newHeight = Math.max(1, layer.height + delta);
    execute(() => {
      updateLayer(layerId, { height: newHeight });
    });
  };

  const handleDrawerHeightChange = (delta: number) => {
    const newHeight = Math.max(1, layout.drawer.height + delta);
    execute(() => {
      updateDrawer({ height: newHeight });
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, displayIndex: number) => {
    setDragSourceIndex(displayIndex);
    setReorderError(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(displayIndex));
  };

  const handleDragOver = (e: React.DragEvent, displayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSourceIndex !== null && displayIndex !== dragSourceIndex) {
      setDragOverIndex(displayIndex);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetDisplayIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (dragSourceIndex === null || dragSourceIndex === targetDisplayIndex) {
      setDragSourceIndex(null);
      return;
    }

    // Convert display indices to array indices
    const fromArrayIndex = displayToArrayIndex(dragSourceIndex);
    const toArrayIndex = displayToArrayIndex(targetDisplayIndex);

    execute(() => {
      const result = reorderLayers(fromArrayIndex, toArrayIndex);
      if (!result.success && result.error) {
        setReorderError(result.error);
        setTimeout(() => setReorderError(null), 3000);
      }
    });

    setDragSourceIndex(null);
  };

  const handleDragEnd = () => {
    setDragSourceIndex(null);
    setDragOverIndex(null);
  };

  const layerToDelete = deleteLayerId ? layers.find(l => l.id === deleteLayerId) : null;
  const binsInDeleteLayer = deleteLayerId ? layout.bins.filter(b => b.layerId === deleteLayerId).length : 0;

  if (!activeLayer) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-content-secondary tracking-wide mb-3" title="Layers stack vertically in your drawer. Tall bins on lower layers block placement above.">Layers</h2>

      {/* Drawer height */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-content-tertiary" title="Total height available for all layers (in Gridfinity height units)">Drawer height</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleDrawerHeightChange(-1)}
            disabled={layout.drawer.height <= 1}
            className="w-5 h-5 flex items-center justify-center text-content-tertiary hover:text-content disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Decrease drawer height"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className={`text-xs tabular-nums min-w-[28px] text-center ${totalLayerHeight > layout.drawer.height ? 'text-error' : 'text-content-secondary'}`}>
            {layout.drawer.height}u
          </span>
          <button
            onClick={() => handleDrawerHeightChange(1)}
            className="w-5 h-5 flex items-center justify-center text-content-tertiary hover:text-content transition-colors"
            aria-label="Increase drawer height"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Reorder error message */}
      {reorderError && (
        <div className="mb-3 p-2 rounded-md flex items-center gap-2 animate-shake bg-error-muted border border-error text-error text-xs">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {reorderError}
        </div>
      )}

      {/* Layer list - always visible */}
      <div className="flex flex-col gap-1 mb-3">
        {displayLayers.map((layer, displayIndex) => {
          const isActive = layer.id === activeLayerId;
          const isEditing = editingLayerId === layer.id;
          const layerCoveredCells = layout.bins
            .filter(b => b.layerId === layer.id)
            .reduce((sum, b) => sum + b.width * b.depth, 0);
          const layerCoverage = totalCells > 0 ? Math.round((layerCoveredCells / totalCells) * 100) : 0;
          const isDragging = dragSourceIndex === displayIndex;
          const isDragOver = dragOverIndex === displayIndex;

          return (
            <div
              key={layer.id}
              draggable={hasMultipleLayers && !editingLayerId}
              onDragStart={(e) => handleDragStart(e, displayIndex)}
              onDragOver={(e) => handleDragOver(e, displayIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, displayIndex)}
              onDragEnd={handleDragEnd}
              onClick={() => !isEditing && setActiveLayer(layer.id)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
                  e.preventDefault();
                  setActiveLayer(layer.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`${layer.name}, ${layer.height} height units, ${layerCoverage}% coverage${isActive ? ', active' : ''}`}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
                isActive
                  ? 'bg-accent text-black'
                  : 'bg-surface-elevated text-content-secondary hover:bg-surface-hover cursor-pointer'
              }`}
              style={{
                opacity: isDragging ? 0.5 : 1,
                border: isDragOver ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
            >
              {/* Drag handle - only show for multiple layers */}
              {hasMultipleLayers && (
                <div className={`flex-shrink-0 cursor-grab active:cursor-grabbing ${isActive ? 'text-black/40' : 'text-content-disabled'}`}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                  </svg>
                </div>
              )}

              {/* Layer name - editable when active and clicked */}
              {isEditing ? (
                <input
                  type="text"
                  value={layer.name}
                  onChange={(e) => handleNameChange(layer.id, e.target.value)}
                  onBlur={() => setEditingLayerId(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingLayerId(null)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-black/10 rounded px-1 py-0.5 text-xs font-medium outline-none text-black"
                  autoFocus
                />
              ) : (
                <span
                  className={`flex-1 text-left truncate ${isActive ? 'cursor-text' : ''}`}
                  onClick={(e) => {
                    if (isActive) {
                      e.stopPropagation();
                      setEditingLayerId(layer.id);
                    }
                  }}
                  title={isActive ? 'Click to rename' : undefined}
                >
                  {layer.name}
                </span>
              )}

              {/* Coverage percentage */}
              <span className={`${isActive ? 'text-black/60' : 'text-content-disabled'}`}>
                {layerCoverage}%
              </span>

              {/* Height controls - show +/- when active, badge otherwise */}
              {isActive ? (
                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleHeightChange(layer.id, -1)}
                    disabled={layer.height <= 1}
                    className="w-5 h-5 flex items-center justify-center text-black/50 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease layer height"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-[10px] tabular-nums min-w-[24px] text-center text-black/80" title="Minimum bin height for this layer">
                    {layer.height}u
                  </span>
                  <button
                    onClick={() => handleHeightChange(layer.id, 1)}
                    className="w-5 h-5 flex items-center justify-center text-black/50 hover:text-black transition-colors"
                    aria-label="Increase layer height"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-hover">
                  {layer.height}u
                </span>
              )}

              {/* Delete button - only for active layer when multiple exist */}
              {isActive && hasMultipleLayers && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteLayerId(layer.id);
                  }}
                  className="p-0.5 rounded text-black/40 hover:text-black transition-colors"
                  title="Delete this layer"
                  aria-label={`Delete ${layer.name} layer`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats line */}
      <div className="text-xs text-content-tertiary mb-2">
        {hasMultipleLayers
          ? `${totalCoverage}% filled · ${totalBinCount} bin${totalBinCount !== 1 ? 's' : ''} total`
          : `${coverage}% filled · ${binCount} bin${binCount !== 1 ? 's' : ''}`
        }
      </div>

      {/* Coverage bar */}
      <div className="h-1.5 rounded-full overflow-hidden bg-surface-elevated mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${hasMultipleLayers ? totalCoverage : coverage}%`,
            backgroundColor: (hasMultipleLayers ? totalCoverage : coverage) === 100 ? 'var(--color-success)' : 'var(--color-primary)',
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 text-xs">
        <button
          onClick={handleFillGaps}
          disabled={coverage === 100}
          className="text-content-tertiary hover:text-content disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Fill empty cells with optimally-sized bins"
        >
          {coverage === 100 ? 'Filled' : `Fill ${emptyCells} gap${emptyCells !== 1 ? 's' : ''}`}
        </button>
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={binCount === 0}
          className="text-content-tertiary hover:text-error disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Remove all bins from this layer"
        >
          Clear layer
        </button>
      </div>

      {/* Add layer button */}
      <button
        onClick={handleAddLayer}
        className="btn btn-ghost w-full justify-center mt-2 text-xs text-content-tertiary"
        title="Add a new layer above the current one"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add layer
      </button>

      {/* Clear confirmation */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Layer"
        message={`Remove all ${binCount} bin${binCount !== 1 ? 's' : ''} from "${activeLayer.name}"? This can be undone.`}
        confirmText="Clear"
        destructive
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Delete layer confirmation */}
      <ConfirmDialog
        isOpen={deleteLayerId !== null}
        title="Delete Layer"
        message={`Delete "${layerToDelete?.name}"${binsInDeleteLayer > 0 ? ` and its ${binsInDeleteLayer} bin${binsInDeleteLayer > 1 ? 's' : ''}` : ''}?`}
        confirmText="Delete"
        destructive
        onConfirm={handleDeleteLayer}
        onCancel={() => setDeleteLayerId(null)}
      />
    </div>
  );
}
