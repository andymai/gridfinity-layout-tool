import { useState } from 'react';
import { useLayoutStore, useUIStore, useUndoableAction, useToastStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { ContextMenuContainer, ContextMenuItem, ContextMenuDivider } from '@/shared/components/ContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { STAGING_ID } from '@/core/constants';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { Bin } from '@/core/types';

interface MultiBinContextMenuProps {
  binIds: string[];
  position: { x: number; y: number };
  onClose: () => void;
  source?: 'grid' | 'staging';
}

/**
 * Context menu for multiple selected bins.
 * Provides bulk operations: Delete All, Move to Layer, Change Category.
 */
export function MultiBinContextMenu({ binIds, position, onClose, source }: MultiBinContextMenuProps) {
  // Calculate adjusted position for upward opening
  // For staging bins, position menu above cursor but not too far
  const shouldOpenUpward = source === 'staging';
  const upwardOffset = 140; // Slightly more for taller multi-select menu
  const adjustedPosition = {
    x: position.x,
    y: shouldOpenUpward
      ? Math.max(0, position.y - upwardOffset) // Open upward with moderate offset
      : position.y, // Open downward (normal)
  };

  const { menuRef } = useContextMenu();
  const layout = useLayoutStore(state => state.layout);
  const { deleteBin, updateBin } = useMutations();
  const setSelectedBins = useUIStore(state => state.setSelectedBins);
  const addToast = useToastStore(state => state.addToast);
  const { execute } = useUndoableAction();

  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Get bins and categorize them
  const bins = binIds
    .map(id => layout.bins.find(b => b.id === id))
    .filter((b): b is Bin => b !== undefined);

  const stagingBins = bins.filter(b => b.layerId === STAGING_ID);
  const gridBins = bins.filter(b => b.layerId !== STAGING_ID);

  // Only show layer picker if there are bins that can be moved to a layer
  // (staging bins can be moved to grid)
  const canMoveToLayer = stagingBins.length > 0;

  const handleDeleteAll = () => {
    // Track deletion BEFORE executing (need bin data)
    // Use 'bulk' method since this deletes multiple bins at once
    if (bins.length > 0) {
      mlTracking.trackDeletion(bins[0], 'bulk', bins.length);
    }

    execute(() => {
      bins.forEach(b => deleteBin(b.id));
    });
    setSelectedBins([]);
    addToast(`Deleted ${bins.length} bins`, 'success');
    onClose();
  };

  const handleChangeCategory = (categoryId: string) => {
    // Filter to only bins that actually change
    const binsToUpdate = bins.filter(b => b.category !== categoryId);
    if (binsToUpdate.length === 0) {
      onClose();
      return;
    }

    const batchSize = binsToUpdate.length;
    const category = layout.categories.find(c => c.id === categoryId);

    execute(() => {
      binsToUpdate.forEach(b => {
        updateBin(b.id, { category: categoryId });
      });
    });

    // Track once per batch (not per bin)
    if (category && binsToUpdate.length > 0) {
      mlTracking.trackCategory(binsToUpdate[0], category.name, batchSize);
    }

    addToast(`Updated ${binsToUpdate.length} bins`, 'success');
    onClose();
  };

  const handleMoveToLayer = (layerId: string) => {
    const layer = layout.layers.find(l => l.id === layerId);
    if (!layer) return;

    execute(() => {
      stagingBins.forEach(b => {
        // Move to layer - keep original height (don't auto-adjust to layer minimum)
        updateBin(b.id, {
          layerId,
          x: 0,
          y: 0,
        });
      });
    });
    addToast(`Moved ${stagingBins.length} bins to ${layer.name}`, 'success');
    onClose();
  };

  return (
    <ContextMenuContainer
      isOpen={true}
      position={adjustedPosition}
      onClose={onClose}
      menuRef={menuRef}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-stroke-subtle">
        <div className="font-medium text-content">
          {bins.length} Bins Selected
        </div>
        {stagingBins.length > 0 && gridBins.length > 0 && (
          <div className="text-sm text-content-tertiary">
            {stagingBins.length} in stash, {gridBins.length} on grid
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="py-1">
        {/* Change Category */}
        <div>
          <button
            onClick={() => setShowCategoryPicker(!showCategoryPicker)}
            className="w-full px-4 py-3 flex items-center justify-between transition-colors text-content hover:bg-surface-hover"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Change Category
            </div>
            <svg
              className={`w-4 h-4 ml-3 transition-transform ${showCategoryPicker ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showCategoryPicker && (
            <div className="px-2 py-1 bg-surface-secondary">
              {layout.categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleChangeCategory(category.id)}
                  className="w-full px-3 py-2 flex items-center gap-2 rounded transition-colors hover:bg-surface-hover"
                >
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm text-content">{category.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Move All to Layer */}
        {canMoveToLayer && (
          <div>
            <button
              onClick={() => setShowLayerPicker(!showLayerPicker)}
              className="w-full px-4 py-3 flex items-center justify-between transition-colors text-content hover:bg-surface-hover"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                Move to Layer
              </div>
              <svg
                className={`w-4 h-4 ml-3 transition-transform ${showLayerPicker ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showLayerPicker && (
              <div className="px-2 py-1 bg-surface-secondary">
                {layout.layers.map(layer => (
                  <button
                    key={layer.id}
                    onClick={() => handleMoveToLayer(layer.id)}
                    className="w-full px-3 py-2 text-left rounded transition-colors hover:bg-surface-hover"
                  >
                    <div className="text-sm text-content">{layer.name}</div>
                    <div className="text-xs text-content-tertiary">
                      Min height: {layer.height}u
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <ContextMenuDivider />

        {/* Delete All */}
        <ContextMenuItem
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          }
          label="Delete All"
          onClick={handleDeleteAll}
          destructive
        />
      </div>
    </ContextMenuContainer>
  );
}
