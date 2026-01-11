import { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore, useUndoableAction, useToastStore } from '../../store';
import { calcMaxGridUnits, STAGING_ID } from '../../constants';
import { getLayerZStart } from '../../utils/collision';
import { clamp } from '../../utils/validation';
import { validateRotation } from '../../utils/rotation';
import type { Bin, Category, Layer, Layout } from '../../types';

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
  updateMultiCategory: (categoryId: string) => void;
  updateMultiHeight: (delta: number) => void;
  updateMultiClearance: (delta: number) => void;

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
    if (!bin || !layer) {
      return {
        minHeight: 1,
        maxHeight: 1,
        maxClearance: 0,
        maxGridUnits: 5,
        needsSplit: false,
        heightRange: '1u',
      };
    }

    const minHeight = layer.height;
    const maxHeight = layout.drawer.height - getLayerZStart(bin.layerId, layout.layers);
    const maxClearance = maxHeight - bin.height;
    const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
    const needsSplit = bin.width > maxGridUnits || bin.depth > maxGridUnits;

    return {
      minHeight,
      maxHeight,
      maxClearance,
      maxGridUnits,
      needsSplit,
      heightRange: `${minHeight}u – ${maxHeight}u`,
    };
  }, [bin, layer, layout.drawer.height, layout.layers, layout.printBedSize, layout.gridUnitMm]);

  // Update single bin field
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

  // Update category for multiple bins
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

  // Update height delta for multiple bins
  const updateMultiHeight = useCallback(
    (delta: number) => {
      if (selectedBins.length === 0) return;

      execute(() => {
        for (const b of selectedBins) {
          const binLayer = layout.layers.find((l) => l.id === b.layerId);
          const minHeight = binLayer?.height || 1;
          const binMaxHeight = layout.drawer.height - getLayerZStart(b.layerId, layout.layers);
          const newHeight = clamp(b.height + delta, minHeight, binMaxHeight);
          updateBin(b.id, { height: newHeight });
        }
      });
    },
    [selectedBins, layout.drawer.height, layout.layers, execute, updateBin]
  );

  // Update clearance delta for multiple bins
  const updateMultiClearance = useCallback(
    (delta: number) => {
      if (selectedBins.length === 0) return;

      execute(() => {
        for (const b of selectedBins) {
          const binMaxHeight = layout.drawer.height - getLayerZStart(b.layerId, layout.layers);
          const maxClearance = binMaxHeight - b.height;
          const newClearance = clamp((b.clearanceHeight || 0) + delta, 0, maxClearance);
          updateBin(b.id, { clearanceHeight: newClearance });
        }
      });
    },
    [selectedBins, layout.drawer.height, layout.layers, execute, updateBin]
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

  // Move to staging
  const moveToStaging = useCallback(() => {
    if (selectedBins.length === 0) return;

    execute(() => {
      for (const b of selectedBins) {
        moveBinToStaging(b.id);
      }
    });

    closeMobilePanel();
  }, [selectedBins, execute, moveBinToStaging, closeMobilePanel]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedBins([]);
  }, [setSelectedBins]);

  // Get toast store for error messages
  const addToast = useToastStore((state) => state.addToast);

  // Rotate bin (swap width and depth)
  // Returns true if rotation succeeded, false if blocked by collision
  const rotateBin = useCallback(() => {
    if (!bin || bin.layerId === STAGING_ID) return false;

    const result = validateRotation(bin, layout);
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
    updateMultiCategory,
    updateMultiHeight,
    updateMultiClearance,

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
  };
}
