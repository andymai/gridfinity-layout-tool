/**
 * Shared hook for bin inspector logic.
 *
 * Extracts all common state and handlers used by RightPanel and
 * MobileInspector. Multi-selection callbacks live in
 * `useBinInspectorMultiActions`; type definitions and the linked-bin
 * sync helper live in `binInspectorTypes` (no `use` prefix — those
 * are pure types and a plain helper, not a hook).
 */

import { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useToastStore } from '@/core/store';
import { batch } from '@/core/cqrs';
import { useSelectionStore } from '@/core/store/selection';
import { useMobileStore } from '@/core/store/mobile';
import { useMutations } from '@/shared/contexts';
import { calcMaxGridUnits, CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { getLayerZStartResult } from '@/shared/utils/collision';
import { isOk, isErr } from '@/core/result';
import { clamp, canPlaceBin, validateCustomProperties } from '@/shared/utils/validation';
import { validateBinRotation } from '@/shared/utils/binLocation';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { GridUnits, HeightUnits, Bin, LayerId } from '@/core/types';
import { layerId as toLayerId, categoryId as toCategoryId } from '@/core/types';
import { useTranslation } from '@/i18n';
import {
  emitLinkedBinResize,
  type BinConstraints,
  type BinField,
  type ConfirmDeleteState,
  type UseBinInspectorReturn,
} from './binInspectorTypes';
import { useBinInspectorMultiActions } from './useBinInspectorMultiActions';

export type {
  BinConstraints,
  BinField,
  ConfirmDeleteState,
  MaxHeightReason,
  MinHeightReason,
  UseBinInspectorReturn,
} from './binInspectorTypes';

/**
 * Shared hook for bin inspector logic.
 * Extracts all common state and handlers used by RightPanel and MobileInspector.
 */
export function useBinInspector(): UseBinInspectorReturn {
  const t = useTranslation();
  const [deleteConfirmState, setDeleteConfirmState] = useState<ConfirmDeleteState | null>(null);

  const { selectedBinIds, setSelectedBins } = useSelectionStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      setSelectedBins: state.setSelectedBins,
    }))
  );

  const closeMobilePanel = useMobileStore((state) => state.closeMobilePanel);

  const layout = useLayoutStore((state) => state.layout);
  const { updateBin, deleteBin, moveBinToStaging } = useMutations();

  const selectedBins = useMemo(
    () => layout.bins.filter((b) => selectedBinIds.includes(b.id)),
    [layout.bins, selectedBinIds]
  );
  const isMultiSelect = selectedBins.length > 1;
  const bin = selectedBins.length === 1 ? selectedBins[0] : null;
  const category = bin ? (layout.categories.find((c) => c.id === bin.category) ?? null) : null;
  const layer = bin ? (layout.layers.find((l) => l.id === bin.layerId) ?? null) : null;

  const constraints = useMemo<BinConstraints>(() => {
    if (!bin) {
      return {
        minHeight: CONSTRAINTS.MIN_BIN_HEIGHT,
        maxHeight: CONSTRAINTS.MIN_BIN_HEIGHT,
        maxClearance: 0,
        maxGridUnits: { width: 5, depth: 5 },
        needsSplit: false,
        heightRange: `${CONSTRAINTS.MIN_BIN_HEIGHT}u`,
        minHeightReason: 'global_minimum',
        maxHeightReason: 'drawer_height',
      };
    }

    const maxGrid = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm, layout.printBedDepth);
    const needsSplit = bin.width > maxGrid.width || bin.depth > maxGrid.depth;

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
        maxGridUnits: maxGrid,
        needsSplit,
        heightRange: `${minHeight}u – ${maxHeight}u`,
        minHeightReason: 'global_minimum',
        maxHeightReason: 'drawer_height',
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
      maxGridUnits: maxGrid,
      needsSplit,
      heightRange: `${minHeight}u – ${maxHeight}u`,
      minHeightReason:
        layer.height > CONSTRAINTS.MIN_BIN_HEIGHT ? 'layer_height' : 'global_minimum',
      maxHeightReason: 'remaining_space',
    };
  }, [
    bin,
    layer,
    layout.drawer.height,
    layout.layers,
    layout.printBedSize,
    layout.printBedDepth,
    layout.gridUnitMm,
  ]);

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

      batch(() => {
        if (field === 'width' || field === 'depth') {
          // Support fractional values for half-bin mode
          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0.5;
          const clampedValue = Math.max(0.5, numValue);
          if (isErr(updateBin(bin.id, { [field]: clampedValue }))) return;

          // Sync dimension change to linked design and sibling bins
          emitLinkedBinResize(bin, {
            width: field === 'width' ? clampedValue : bin.width,
            depth: field === 'depth' ? clampedValue : bin.depth,
            height: bin.height,
          });
        } else if (field === 'height') {
          const newHeight = clamp(
            typeof value === 'number' ? value : parseInt(value, 10) || constraints.minHeight,
            constraints.minHeight,
            constraints.maxHeight
          ) as HeightUnits;

          // Preserve clearance total if bin has clearance
          let heightUpdateFailed = false;
          if (bin.clearanceHeight && bin.clearanceHeight > 0) {
            const currentTotal = bin.height + bin.clearanceHeight;
            const newClearance = Math.max(0, currentTotal - newHeight) as HeightUnits;
            if (isErr(updateBin(bin.id, { height: newHeight, clearanceHeight: newClearance }))) {
              heightUpdateFailed = true;
            }
          } else {
            if (isErr(updateBin(bin.id, { height: newHeight }))) {
              heightUpdateFailed = true;
            }
          }

          // Sync height change to linked design and sibling bins
          if (!heightUpdateFailed) {
            emitLinkedBinResize(bin, { width: bin.width, depth: bin.depth, height: newHeight });
          }
        } else if (field === 'clearanceHeight') {
          const newClearance = clamp(
            typeof value === 'number' ? value : parseInt(value, 10) || 0,
            0,
            constraints.maxClearance
          ) as HeightUnits;
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
        } else {
          updateBin(bin.id, { notes: value as string });
        }
      });
    },
    [
      bin,
      constraints.minHeight,
      constraints.maxHeight,
      constraints.maxClearance,
      updateBin,
      layout.categories,
    ]
  );

  const updateCustomProperties = useCallback(
    (properties: Record<string, string>) => {
      if (!bin) return;

      const validation = validateCustomProperties(properties);
      if (isErr(validation)) {
        addToast(validation.error.message, 'error');
        return;
      }

      batch(() => {
        updateBin(bin.id, { customProperties: properties });
      });
    },
    [bin, updateBin, addToast]
  );

  const {
    updateMultiCategory,
    updateMultiCustomProperty,
    updateMultiHeight,
    updateMultiClearance,
    updateMultiLayer,
  } = useBinInspectorMultiActions({ selectedBins, layout, updateBin, addToast, t });

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
        addToast(reasons[result.reason] || 'Cannot move bin here', 'error');
        return;
      }

      // Track layer move BEFORE executing (capture original layer)
      const fromLayerId = bin.layerId;

      batch(() => {
        updateBin(bin.id, {
          layerId: targetLayerId,
          // Keep bin's original height - don't auto-adjust to layer minimum
        });
      });

      // Track layer movement after execution
      mlTracking.trackLayerMove(bin, fromLayerId, targetLayerId, 'inspector', 1);

      addToast(t('toast.movedToLayer', { name: targetLayer.name }), 'success');
    },
    [bin, layout, updateBin, addToast, t]
  );

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

  const confirmDeleteAction = useCallback(() => {
    if (selectedBins.length === 0) return;

    // Track deletion BEFORE executing (need bin data)
    mlTracking.trackBinsDeletion(selectedBins, 'inspector');

    batch(() => {
      for (const b of selectedBins) {
        deleteBin(b.id);
      }
    });

    // Selection cleanup handled by CQRS selectionPruning subscriber
    setDeleteConfirmState(null);
    closeMobilePanel();
  }, [selectedBins, deleteBin, closeMobilePanel]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmState(null);
  }, []);

  const moveToStaging = useCallback(() => {
    if (selectedBins.length === 0) return;

    batch(() => {
      for (const b of selectedBins) {
        moveBinToStaging(b.id);
      }
    });

    closeMobilePanel();
  }, [selectedBins, moveBinToStaging, closeMobilePanel]);

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

    batch(() => {
      const updates: Partial<Bin> = { width: bin.depth, depth: bin.width };
      if (result.movedTo) {
        updates.x = result.movedTo.x as GridUnits;
        updates.y = result.movedTo.y as GridUnits;
      }
      updateBin(bin.id, updates);
    });

    emitLinkedBinResize(bin, { width: bin.depth, depth: bin.width, height: bin.height });

    if (result.movedTo) {
      addToast(t('toast.rotateRepositioned', { distance: result.movedTo.distance }), 'info');
    }

    return true;
  }, [bin, layout, updateBin, addToast, t]);

  return {
    selectedBins,
    isMultiSelect,
    bin,
    category,
    layer,

    constraints,

    updateField,
    updateCustomProperties,
    updateMultiCustomProperty,
    updateMultiCategory,
    updateMultiHeight,
    updateMultiClearance,

    moveToLayer,
    updateMultiLayer,

    requestDelete,
    confirmDelete: confirmDeleteAction,
    cancelDelete,
    moveToStaging,
    clearSelection,
    rotateBin,

    deleteConfirmState,

    layout,
    categories: layout.categories,
    existingPropertyKeys,
  };
}
