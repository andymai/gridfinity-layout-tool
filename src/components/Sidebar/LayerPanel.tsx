import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '../../store';
import { CONSTRAINTS, STAGING_ID } from '../../constants';
import { getDisplayLayers } from '../../utils/collision';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { CollapsibleSection } from '../CollapsibleSection';

export function LayerPanel() {
  const [deleteLayerId, setDeleteLayerId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const { layout, addLayer, updateLayer, deleteLayer, reorderLayers } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      addLayer: state.addLayer,
      updateLayer: state.updateLayer,
      deleteLayer: state.deleteLayer,
      reorderLayers: state.reorderLayers,
    }))
  );

  const { activeLayerId, setActiveLayer } = useUIStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      setActiveLayer: state.setActiveLayer,
    }))
  );

  const { execute } = useUndoableAction();

  const layers = layout.layers;
  const activeLayer = layers.find(l => l.id === activeLayerId);

  // Height capacity tracking
  const totalLayerHeight = layers.reduce((sum, l) => sum + l.height, 0);
  const drawerHeight = layout.drawer.height;
  const canAddLayer = layers.length < CONSTRAINTS.LAYERS_MAX && totalLayerHeight < drawerHeight;
  const heightFull = totalLayerHeight >= drawerHeight;

  const totalCells = layout.drawer.width * layout.drawer.depth;
  const hasMultipleLayers = layers.length > 1;

  // Total stats across all layers
  const allPlacedBins = layout.bins.filter(b => b.layerId !== STAGING_ID);
  const totalBinCount = allPlacedBins.length;
  const totalCoveredCells = allPlacedBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const totalAvailableCells = totalCells * layers.length;
  const totalCoverage = totalAvailableCells > 0 ? Math.round((totalCoveredCells / totalAvailableCells) * 100) : 0;

  // Single layer stats
  const layerBins = layout.bins.filter(b => b.layerId === activeLayerId);
  const binCount = layerBins.length;
  const coveredCells = layerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const coverage = totalCells > 0 ? Math.round((coveredCells / totalCells) * 100) : 0;

  // Display is reversed: index 0 in display = last in array (top layer)
  const displayToArrayIndex = (displayIndex: number) => layers.length - 1 - displayIndex;
  const displayLayers = getDisplayLayers(layers);

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

  const addLayerButton = (
    <button
      onClick={handleAddLayer}
      disabled={!canAddLayer}
      className="btn btn-ghost w-7 h-7 p-0 min-w-0 min-h-0"
      title={!canAddLayer
        ? (heightFull ? `Max height full (${totalLayerHeight}/${drawerHeight}u)` : `Maximum ${CONSTRAINTS.LAYERS_MAX} layers`)
        : "Add a new layer"}
      aria-label="Add new layer"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );

  return (
    <div>
      <CollapsibleSection title="Layers" variant="default" actions={addLayerButton}>
        {/* Height capacity indicator - only show for multiple layers */}
        {hasMultipleLayers && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-elevated">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (totalLayerHeight / drawerHeight) * 100)}%`,
                backgroundColor: heightFull ? 'var(--color-warning)' : 'var(--color-info)',
              }}
            />
          </div>
          <span className={`text-xs tabular-nums ${heightFull ? 'text-warning' : 'text-content-tertiary'}`}>
            {totalLayerHeight}/{drawerHeight}u
          </span>
        </div>
      )}

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
              className={`group flex items-center gap-2 px-2 py-1.5 text-xs transition-all border-l-2 ${
                isActive
                  ? 'bg-surface-hover border-l-accent text-content'
                  : 'bg-surface-elevated text-content-secondary hover:bg-surface-hover cursor-pointer border-l-transparent'
              }`}
              style={{
                opacity: isDragging ? 0.5 : 1,
                outline: isDragOver ? '2px solid var(--color-primary)' : 'none',
              }}
            >
              {/* Drag handle - only show for multiple layers */}
              {hasMultipleLayers && (
                <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-content-disabled">
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
                  className="flex-1 bg-surface-elevated rounded px-1 py-0.5 text-xs font-medium outline-none text-content"
                  autoFocus
                  aria-label={`Layer name for ${layer.name}`}
                />
              ) : (
                <button
                  className={`flex-1 text-left truncate bg-transparent border-none p-0 ${isActive ? 'cursor-text font-medium' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActive) {
                      setEditingLayerId(layer.id);
                    } else {
                      setActiveLayer(layer.id);
                    }
                  }}
                  aria-pressed={isActive}
                  aria-label={`${layer.name}, ${layer.height} height units, ${layerCoverage}% coverage${isActive ? ', active - click to rename' : ''}`}
                  title={isActive ? 'Click to rename' : `Select ${layer.name}`}
                >
                  {layer.name}
                </button>
              )}

              {/* Coverage percentage - only show for multiple layers */}
              {hasMultipleLayers && (
                <span className="text-content-disabled">
                  {layerCoverage}%
                </span>
              )}

              {/* Height controls - show +/- when active and multiple layers, or always for single layer */}
              {(isActive || !hasMultipleLayers) ? (
                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleHeightChange(layer.id, -1)}
                    disabled={layer.height <= 1}
                    className="w-5 h-5 flex items-center justify-center text-content-tertiary hover:text-content disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease layer height"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-[10px] tabular-nums min-w-[24px] text-center text-content-secondary" title="Minimum bin height for this layer">
                    {layer.height}u
                  </span>
                  <button
                    onClick={() => handleHeightChange(layer.id, 1)}
                    className="w-5 h-5 flex items-center justify-center text-content-tertiary hover:text-content transition-colors"
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
                  className="p-0.5 rounded text-content-disabled hover:text-error transition-colors"
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
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-elevated">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${hasMultipleLayers ? totalCoverage : coverage}%`,
              backgroundColor: (hasMultipleLayers ? totalCoverage : coverage) === 100 ? 'var(--color-success)' : 'var(--text-tertiary)',
            }}
          />
        </div>
      </CollapsibleSection>

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
