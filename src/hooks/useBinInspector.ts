import { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore, useUndoableAction, useToastStore } from '../core/store';
import { calcMaxGridUnits, STAGING_ID } from '../core/constants';
import { getLayerZStart } from '../features/grid-editor/utils/collision';
import { clamp, canPlaceBin, validateCustomProperties } from '../shared/utils/validation';
import { validateBinRotation } from '../utils/binLocation';
import type { Bin, Category, Layer, Layout } from '../core/types';

export type BinField = 'width' | 'depth' | 'height' | 'clearanceHeight' | 'category' | 'label' | 'notes';

export interface BinConstraints {
  minHeight: number;
  maxHeight: number;
  maxClearance: number;
  maxGridUnits: number;
  needsSplit: boolean;
  heightRange: string;
}

export interface ConfirmDeleteState {
  title: string;
  message: string;
}

export interface UseBinInspectorReturn {
  // Selection state
  selectedBins: Bin[];
  isMultiSelect: boolean;
  bin: Bin | null;
  category: Category | null;
  layer: Layer | null;

  // Constraints (derived)
  constraints: BinConstraints;

  // Update handlers
  updateField: (field: BinField, value: string | number) => void;
  updateCustomProperties: (properties: Record<string, string>) => void;
  updateMultiCustomProperty: (key: string, value: string) => void;
  updateMultiCategory: (categoryId: string) => void;
  updateMultiHeight: (delta: number) => void;
  updateMultiClearance: (delta: number) => void;

  // Layer movement
  moveToLayer: (targetLayerId: string) => void;
  updateMultiLayer: (targetLayerId: string) => void;

  // Actions
  requestDelete: () => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  moveToStaging: () => void;
  clearSelection: () => void;
  rotateBin: () => boolean;

  // Confirmation state
  deleteConfirmState: ConfirmDeleteState | null;

  // Context
  layout: Layout;
  categories: Category[];
  /** All unique custom property keys used across all bins in the layout */
  existingPropertyKeys: string[];
}

/**
 * Shared hook for bin inspector logic.
 * Extracts all common state and handlers used by RightPanel and MobileInspector.
 */
export function useBinInspector(): UseBinInspectorReturn {
  const [deleteConfirmState, setDeleteConfirmState] = useState<ConfirmDeleteState | null>(null);

  // UI Store
  const { selectedBinIds, setSelectedBins, closeMobilePanel } = useUIStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      setSelectedBins: state.setSelectedBins,
      closeMobilePanel: state.closeMobilePanel,
    }))
  );

  // Layout Store
  const { layout, updateBin, deleteBin, moveBinToStaging } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      updateBin: state.updateBin,
      deleteBin: state.deleteBin,
      moveBinToStaging: state.moveBinToStaging,
    }))
  );

  const { execute } = useUndoableAction();

  // Derived selection state
  const selectedBins = useMemo(
    () => layout.bins.filter((b) => selectedBinIds.includes(b.id)),
    [layout.bins, selectedBinIds]
  );
  const isMultiSelect = selectedBins.length > 1;
  const bin = selectedBins.length === 1 ? selectedBins[0] : null;
  const category = bin ? layout.categories.find((c) => c.id === bin.category) ?? null : null;
  const layer = bin ? layout.layers.find((l) => l.id === bin.layerId) ?? null : null;

  // Calculate constraints
  const constraints = useMemo<BinConstraints>(() => {
    if (!bin) {
      return {
        minHeight: 1,
        maxHeight: 1,
        maxClearance: 0,
        maxGridUnits: 5,
        needsSplit: false,
        heightRange: '1u',
      };
    }

    const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
    const needsSplit = bin.width > maxGridUnits || bin.depth > maxGridUnits;

    // For bins in staging, use full drawer height range
    // They're not on a layer yet, so no layer-based constraints apply
    if (bin.layerId === STAGING_ID || !layer) {
      const minHeight = 1;
      const maxHeight = layout.drawer.height;
      const maxClearance = maxHeight - bin.height;
      return {
        minHeight,
        maxHeight,
        maxClearance,
        maxGridUnits,
        needsSplit,
        heightRange: `${minHeight}u – ${maxHeight}u`,
      };
    }

    const minHeight = layer.height;
    const maxHeight = layout.drawer.height - getLayerZStart(bin.layerId, layout.layers);
    const maxClearance = maxHeight - bin.height;

    return {
      minHeight,
      maxHeight,
      maxClearance,
      maxGridUnits,
      needsSplit,
      heightRange: `${minHeight}u – ${maxHeight}u`,
    };
  }, [bin, layer, layout.drawer.height, layout.layers, layout.printBedSize, layout.gridUnitMm]);

  // Collect all unique custom property keys from all bins in the layout (for suggestions)
  const existingPropertyKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const b of layout.bins) {
      if (b.customProperties) {
        for (const key of Object.keys(b.customProperties)) {
          keys.add(key);
        }
      }
    }
    return Array.from(keys).sort();
  }, [layout.bins]);

  const addToast = useToastStore((state) => state.addToast);

  const updateField = useCallback(
    (field: BinField, value: string | number) => {
      if (!bin) return;

      execute(() => {
        if (field === 'width' || field === 'depth') {
          // Support fractional values for half-bin mode
          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0.5;
          // Minimum 0.5 (for half-bin mode compatibility)
          updateBin(bin.id, { [field]: Math.max(0.5, numValue) });
        } else if (field === 'height') {
          const minHeight = layer?.height || 1;
          const newHeight = clamp(
            typeof value === 'number' ? value : parseInt(value as string, 10) || minHeight,
            minHeight,
            constraints.maxHeight
          );

          // Preserve clearance total if bin has clearance
          if (bin.clearanceHeight && bin.clearanceHeight > 0) {
            const currentTotal = bin.height + bin.clearanceHeight;
            const newClearance = Math.max(0, currentTotal - newHeight);
            updateBin(bin.id, { height: newHeight, clearanceHeight: newClearance });
          } else {
            updateBin(bin.id, { height: newHeight });
          }
        } else if (field === 'clearanceHeight') {
          const newClearance = clamp(
            typeof value === 'number' ? value : parseInt(value as string, 10) || 0,
            0,
            constraints.maxClearance
          );
          updateBin(bin.id, { clearanceHeight: newClearance });
        } else {
          updateBin(bin.id, { [field]: value });
        }
      });
    },
    [bin, layer, constraints.maxHeight, constraints.maxClearance, execute, updateBin]
  );

  const updateCustomProperties = useCallback(
    (properties: Record<string, string>) => {
      if (!bin) return;

      // Validate properties before updating
      const validation = validateCustomProperties(properties);
      if (!validation.success) {
        addToast(validation.error ?? 'Invalid custom properties', 'error');
        return;
      }

      execute(() => {
        updateBin(bin.id, { customProperties: properties });
      });
    },
    [bin, execute, updateBin, addToast]
  );

  const updateMultiCategory = useCallback(
    (categoryId: string) => {
      if (selectedBins.length === 0) return;

      execute(() => {
        for (const b of selectedBins) {
          updateBin(b.id, { category: categoryId });
        }
      });
    },
    [selectedBins, execute, updateBin]
  );

  // Update/add a custom property on multiple bins
  const updateMultiCustomProperty = useCallback(
    (key: string, value: string) => {
      if (selectedBins.length === 0) return;
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      if (!trimmedKey) return;

      execute(() => {
        for (const b of selectedBins) {
          const existing = b.customProperties || {};
          updateBin(b.id, {
            customProperties: { ...existing, [trimmedKey]: trimmedValue },
          });
        }
      });

      addToast(`Set "${trimmedKey}" on ${selectedBins.length} bins`, 'success');
    },
    [selectedBins, execute, updateBin, addToast]
  );

  const updateMultiHeight = useCallback(
    (delta: number) => {
      if (selectedBins.length === 0) return;

      execute(() => {
        for (const b of selectedBins) {
          const binLayer = layout.layers.find((l) => l.id === b.layerId);
          const minHeight = binLayer?.height || 1;
          // For staging bins, use full drawer height; for placed bins, account for layer position
          const binMaxHeight = b.layerId === STAGING_ID || !binLayer
            ? layout.drawer.height
            : layout.drawer.height - getLayerZStart(b.layerId, layout.layers);
          const newHeight = clamp(b.height + delta, minHeight, binMaxHeight);
          updateBin(b.id, { height: newHeight });
        }
      });
    },
    [selectedBins, layout.drawer.height, layout.layers, execute, updateBin]
  );

  const updateMultiClearance = useCallback(
    (delta: number) => {
      if (selectedBins.length === 0) return;

      execute(() => {
        for (const b of selectedBins) {
          const binLayer = layout.layers.find((l) => l.id === b.layerId);
          // For staging bins, use full drawer height; for placed bins, account for layer position
          const binMaxHeight = b.layerId === STAGING_ID || !binLayer
            ? layout.drawer.height
            : layout.drawer.height - getLayerZStart(b.layerId, layout.layers);
          const maxClearance = binMaxHeight - b.height;
          const newClearance = clamp((b.clearanceHeight || 0) + delta, 0, maxClearance);
          updateBin(b.id, { clearanceHeight: newClearance });
        }
      });
    },
    [selectedBins, layout.drawer.height, layout.layers, execute, updateBin]
  );

  // Move single bin to a different layer
  const moveToLayer = useCallback(
    (targetLayerId: string) => {
      if (!bin || bin.layerId === targetLayerId) return;
      if (bin.layerId === STAGING_ID) {
        addToast('Drag bin from stash to place it on a layer', 'info');
        return;
      }

      const targetLayer = layout.layers.find(l => l.id === targetLayerId);
      if (!targetLayer) return;

      // Validate placement on target layer using bin's actual height (no auto-adjustment)
      const result = canPlaceBin(
        { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth, height: bin.height },
        targetLayerId,
        layout,
        bin.id
      );

      if (!result.valid) {
        const reasons: Record<string, string> = {
          collision: 'Another bin occupies this position',
          blocked_zone: 'Blocked by a taller bin below',
          exceeds_height: 'Bin would exceed drawer height',
        };
        addToast(reasons[result.reason ?? ''] || 'Cannot move bin here', 'error');
        return;
      }

      execute(() => {
        updateBin(bin.id, {
          layerId: targetLayerId,
          // Keep bin's original height - don't auto-adjust to layer minimum
        });
      });

      addToast(`Moved to ${targetLayer.name}`, 'success');
    },
    [bin, layout, execute, updateBin, addToast]
  );

  // Move multiple bins to a different layer
  const updateMultiLayer = useCallback(
    (targetLayerId: string) => {
      if (selectedBins.length === 0) return;

      const targetLayer = layout.layers.find(l => l.id === targetLayerId);
      if (!targetLayer) return;

      // Filter out staging bins and bins already on target layer
      const binsToMove = selectedBins.filter(
        b => b.layerId !== STAGING_ID && b.layerId !== targetLayerId
      );

      if (binsToMove.length === 0) return;

      // Check which bins can be moved using their actual heights (no auto-adjustment)
      const movable: Bin[] = [];
      const blocked: Bin[] = [];

      for (const b of binsToMove) {
        const result = canPlaceBin(
          { x: b.x, y: b.y, width: b.width, depth: b.depth, height: b.height },
          targetLayerId,
          layout,
          b.id
        );
        if (result.valid) {
          movable.push(b);
        } else {
          blocked.push(b);
        }
      }

      if (movable.length === 0) {
        addToast('No bins can be moved to this layer (collisions)', 'error');
        return;
      }

      execute(() => {
        for (const b of movable) {
          updateBin(b.id, {
            layerId: targetLayerId,
            // Keep bin's original height - don't auto-adjust to layer minimum
          });
        }
      });

      if (blocked.length > 0) {
        addToast(`Moved ${movable.length} of ${binsToMove.length} bins (${blocked.length} blocked)`, 'info');
      } else {
        addToast(`Moved ${movable.length} bins to ${targetLayer.name}`, 'success');
      }
    },
    [selectedBins, layout, execute, updateBin, addToast]
  );

  // Request delete (shows confirmation)
  const requestDelete = useCallback(() => {
    if (selectedBins.length === 0) return;

    setDeleteConfirmState({
      title: selectedBins.length > 1 ? 'Delete Bins' : 'Delete Bin',
      message:
        selectedBins.length > 1
          ? `Delete ${selectedBins.length} selected bins?`
          : `Delete this ${bin?.width}×${bin?.depth} bin?`,
    });
  }, [selectedBins, bin]);

  // Confirm delete
  const confirmDeleteAction = useCallback(() => {
    if (selectedBins.length === 0) return;

    execute(() => {
      for (const b of selectedBins) {
        deleteBin(b.id);
      }
    });

    setSelectedBins([]);
    setDeleteConfirmState(null);
    closeMobilePanel();
  }, [selectedBins, execute, deleteBin, setSelectedBins, closeMobilePanel]);

  // Cancel delete
  const cancelDelete = useCallback(() => {
    setDeleteConfirmState(null);
  }, []);

  const moveToStaging = useCallback(() => {
    if (selectedBins.length === 0) return;

    execute(() => {
      for (const b of selectedBins) {
        moveBinToStaging(b.id);
      }
    });

    closeMobilePanel();
  }, [selectedBins, execute, moveBinToStaging, closeMobilePanel]);

  const clearSelection = useCallback(() => {
    setSelectedBins([]);
  }, [setSelectedBins]);

  // Rotate bin (swap width and depth)
  // Returns true if rotation succeeded, false if blocked by collision
  const rotateBin = useCallback(() => {
    if (!bin) return false;

    const result = validateBinRotation(bin, layout);
    if (!result.valid) {
      addToast(result.message, 'error');
      return false;
    }

    // Rotation is valid, perform it
    execute(() => {
      updateBin(bin.id, { width: bin.depth, depth: bin.width });
    });
    return true;
  }, [bin, layout, execute, updateBin, addToast]);

  return {
    // Selection state
    selectedBins,
    isMultiSelect,
    bin,
    category,
    layer,

    // Constraints
    constraints,

    // Update handlers
    updateField,
    updateCustomProperties,
    updateMultiCustomProperty,
    updateMultiCategory,
    updateMultiHeight,
    updateMultiClearance,

    // Layer movement
    moveToLayer,
    updateMultiLayer,

    // Actions
    requestDelete,
    confirmDelete: confirmDeleteAction,
    cancelDelete,
    moveToStaging,
    clearSelection,
    rotateBin,

    // Confirmation state
    deleteConfirmState,

    // Context
    layout,
    categories: layout.categories,
    existingPropertyKeys,
  };
}
