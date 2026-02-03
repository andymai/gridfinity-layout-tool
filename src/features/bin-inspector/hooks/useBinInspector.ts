import { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore, useUndoableAction, useToastStore } from '@/core/store';
import { calcMaxGridUnits, CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { getLayerZStartResult } from '@/shared/utils/collision';
import { isOk, isErr } from '@/core/result';
import { clamp, canPlaceBin, validateCustomProperties } from '@/shared/utils/validation';
import { validateBinRotation } from '@/utils/binLocation';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { Bin, Category, Layer, Layout, LayerId, CategoryId } from '@/core/types';
import { layerId as toLayerId, categoryId as toCategoryId } from '@/core/types';
import { useTranslation } from '@/i18n';

export type BinField =
  | 'width'
  | 'depth'
  | 'height'
  | 'clearanceHeight'
  | 'category'
  | 'label'
  | 'notes';

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
  const t = useTranslation();
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
  const category = bin ? (layout.categories.find((c) => c.id === bin.category) ?? null) : null;
  const layer = bin ? (layout.layers.find((l) => l.id === bin.layerId) ?? null) : null;

  // Calculate constraints
  const constraints = useMemo<BinConstraints>(() => {
    if (!bin) {
      return {
        minHeight: CONSTRAINTS.MIN_BIN_HEIGHT,
        maxHeight: CONSTRAINTS.MIN_BIN_HEIGHT,
        maxClearance: 0,
        maxGridUnits: 5,
        needsSplit: false,
        heightRange: `${CONSTRAINTS.MIN_BIN_HEIGHT}u`,
      };
    }

    const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
    const needsSplit = bin.width > maxGridUnits || bin.depth > maxGridUnits;

    // For bins in staging, use full drawer height range
    // They're not on a layer yet, so no layer-based constraints apply
    if (bin.layerId === STAGING_ID || !layer) {
      const minHeight = CONSTRAINTS.MIN_BIN_HEIGHT;
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

    const minHeight = Math.max(CONSTRAINTS.MIN_BIN_HEIGHT, layer.height);
    const zStartResult = getLayerZStartResult(bin.layerId, layout.layers);
    const maxHeight =
      layout.drawer.height - (isOk(zStartResult) ? zStartResult.value : layout.drawer.height);
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
          const newHeight = clamp(
            typeof value === 'number' ? value : parseInt(value, 10) || constraints.minHeight,
            constraints.minHeight,
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
            typeof value === 'number' ? value : parseInt(value, 10) || 0,
            0,
            constraints.maxClearance
          );
          updateBin(bin.id, { clearanceHeight: newClearance });
        } else if (field === 'label') {
          const oldLabel = bin.label;
          updateBin(bin.id, { label: value as string });
          mlTracking.trackLabel(bin, oldLabel, value as string);
        } else if (field === 'category') {
          const newCategoryId = toCategoryId(value as string);
          // Skip no-op updates
          if (bin.category === newCategoryId) return;
          updateBin(bin.id, { category: newCategoryId });
          // Track category change with the category name (not ID)
          const newCategory = layout.categories.find((c) => c.id === newCategoryId);
          if (newCategory) {
            mlTracking.trackCategory(bin, newCategory.name);
          }
        } else if (field === 'notes') {
          updateBin(bin.id, { notes: value as string });
        }
      });
    },
    [
      bin,
      constraints.minHeight,
      constraints.maxHeight,
      constraints.maxClearance,
      execute,
      updateBin,
      layout.categories,
    ]
  );

  const updateCustomProperties = useCallback(
    (properties: Record<string, string>) => {
      if (!bin) return;

      // Validate properties before updating
      const validation = validateCustomProperties(properties);
      if (isErr(validation)) {
        addToast(validation.error.message ?? 'Invalid custom properties', 'error');
        return;
      }

      execute(() => {
        updateBin(bin.id, { customProperties: properties });
      });
    },
    [bin, execute, updateBin, addToast]
  );

  const updateMultiCategory = useCallback(
    (rawCategoryId: string) => {
      if (selectedBins.length === 0) return;
      const brandedCategoryId: CategoryId = toCategoryId(rawCategoryId);

      // Filter to only bins whose category actually changes
      const binsToUpdate = selectedBins.filter((b) => b.category !== brandedCategoryId);
      if (binsToUpdate.length === 0) return;

      const batchSize = binsToUpdate.length;
      const category = layout.categories.find((c) => c.id === brandedCategoryId);

      execute(() => {
        for (const b of binsToUpdate) {
          if (isErr(updateBin(b.id, { category: brandedCategoryId }))) break;
        }
      });

      // Track once per batch with category name (not per bin)
      if (category && binsToUpdate.length > 0) {
        mlTracking.trackCategory(binsToUpdate[0], category.name, batchSize);
      }
    },
    [selectedBins, layout.categories, execute, updateBin]
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

      addToast(
        t('toast.customPropertySet', { key: trimmedKey, count: selectedBins.length }),
        'success'
      );
    },
    [selectedBins, execute, updateBin, addToast, t]
  );

  const updateMultiHeight = useCallback(
    (delta: number) => {
      if (selectedBins.length === 0) return;

      execute(() => {
        for (const b of selectedBins) {
          const binLayer = layout.layers.find((l) => l.id === b.layerId);
          const minHeight = Math.max(
            CONSTRAINTS.MIN_BIN_HEIGHT,
            binLayer?.height || CONSTRAINTS.MIN_BIN_HEIGHT
          );
          // For staging bins, use full drawer height; for placed bins, account for layer position
          let binMaxHeight = layout.drawer.height;
          if (b.layerId !== STAGING_ID && binLayer) {
            const zR = getLayerZStartResult(b.layerId, layout.layers);
            binMaxHeight = layout.drawer.height - (isOk(zR) ? zR.value : layout.drawer.height);
          }
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
          let binMaxHeight = layout.drawer.height;
          if (b.layerId !== STAGING_ID && binLayer) {
            const zR = getLayerZStartResult(b.layerId, layout.layers);
            binMaxHeight = layout.drawer.height - (isOk(zR) ? zR.value : layout.drawer.height);
          }
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
    (rawTargetLayerId: string) => {
      const targetLayerId: LayerId = toLayerId(rawTargetLayerId);
      if (!bin || bin.layerId === targetLayerId) return;
      if (bin.layerId === STAGING_ID) {
        addToast(t('toast.dragFromStash'), 'info');
        return;
      }

      const targetLayer = layout.layers.find((l) => l.id === targetLayerId);
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

      // Track layer move BEFORE executing (capture original layer)
      const fromLayerId = bin.layerId;

      execute(() => {
        updateBin(bin.id, {
          layerId: targetLayerId,
          // Keep bin's original height - don't auto-adjust to layer minimum
        });
      });

      // Track layer movement after execution
      mlTracking.trackLayerMove(bin, fromLayerId, targetLayerId, 'inspector', 1);

      addToast(t('toast.movedToLayer', { name: targetLayer.name }), 'success');
    },
    [bin, layout, execute, updateBin, addToast, t]
  );

  // Move multiple bins to a different layer
  const updateMultiLayer = useCallback(
    (rawTargetLayerId: string) => {
      if (selectedBins.length === 0) return;
      const targetLayerId: LayerId = toLayerId(rawTargetLayerId);

      const targetLayer = layout.layers.find((l) => l.id === targetLayerId);
      if (!targetLayer) return;

      // Filter out staging bins and bins already on target layer
      const binsToMove = selectedBins.filter(
        (b) => b.layerId !== STAGING_ID && b.layerId !== targetLayerId
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
        addToast(t('toast.noMovableCollisions'), 'error');
        return;
      }

      // Capture original layer IDs for tracking (use first bin as representative)
      const firstBin = movable[0];
      const fromLayerId = firstBin.layerId;

      execute(() => {
        for (const b of movable) {
          updateBin(b.id, {
            layerId: targetLayerId,
            // Keep bin's original height - don't auto-adjust to layer minimum
          });
        }
      });

      // Track layer movement after execution
      mlTracking.trackLayerMove(firstBin, fromLayerId, targetLayerId, 'inspector', movable.length);

      if (blocked.length > 0) {
        addToast(
          `Moved ${movable.length} of ${binsToMove.length} bins (${blocked.length} blocked)`,
          'info'
        );
      } else {
        addToast(
          t('toast.movedMultiToLayer', { count: movable.length, name: targetLayer.name }),
          'success'
        );
      }
    },
    [selectedBins, layout, execute, updateBin, addToast, t]
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

    // Track deletion BEFORE executing (need bin data)
    mlTracking.trackDeletion(selectedBins[0], 'inspector', selectedBins.length);

    // Track quick corrections for each deleted bin
    for (const bin of selectedBins) {
      mlTracking.trackQuickCorrect('delete', bin.id, bin);
    }

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
  // Smart rotation: if rotation doesn't fit in place, finds nearby valid position
  // Returns true if rotation succeeded, false if blocked by collision
  const rotateBin = useCallback(() => {
    if (!bin) return false;

    const result = validateBinRotation(bin, layout);
    if (!result.valid) {
      addToast(result.message, 'error');
      return false;
    }

    // Track rotation BEFORE executing (capture original dimensions)
    mlTracking.trackRotation(bin, 1);

    // Rotation is valid, perform it (may include position change)
    execute(() => {
      const updates: Partial<Bin> = { width: bin.depth, depth: bin.width };
      if (result.movedTo) {
        updates.x = result.movedTo.x;
        updates.y = result.movedTo.y;
      }
      updateBin(bin.id, updates);
    });

    // Show toast if bin was relocated to fit rotation
    if (result.movedTo) {
      addToast(t('toast.rotateRepositioned', { distance: result.movedTo.distance }), 'info');
    }

    return true;
  }, [bin, layout, execute, updateBin, addToast, t]);

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
