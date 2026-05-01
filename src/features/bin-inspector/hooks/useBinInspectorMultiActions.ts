/**
 * Multi-selection bin actions: bulk category change, custom-property
 * upserts, height/clearance nudges, and layer moves.
 *
 * Returns a memoized object of callbacks. Each callback batches the
 * underlying `updateBin` writes so the CQRS pipeline records a single
 * undo entry per user action instead of one per bin.
 *
 * Pulled out of `useBinInspector` to keep the main hook at a
 * reviewable size — the bulk paths share enough scaffolding that they
 * read better together than scattered through a 600-line hook.
 */

import { useCallback } from 'react';
import { batch } from '@/core/cqrs';
import type { Bin, BinId, CategoryId, HeightUnits, LayerId, Layout } from '@/core/types';
import { categoryId as toCategoryId, layerId as toLayerId } from '@/core/types';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { getLayerZStartResult } from '@/shared/utils/collision';
import { isErr, isOk, type Result } from '@/core/result';
import type { LayoutError } from '@/core/result';
import { clamp, canPlaceBin } from '@/shared/utils/validation';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { TFunction } from '@/i18n/context';
import { emitLinkedBinResize } from './binInspectorTypes';

export interface MultiActionDeps {
  selectedBins: Bin[];
  layout: Layout;
  updateBin: (id: BinId, patch: Partial<Bin>) => Result<void, LayoutError>;
  addToast: (message: string, kind: 'success' | 'error' | 'info') => void;
  t: TFunction;
}

export interface MultiActions {
  updateMultiCategory: (rawCategoryId: string) => void;
  updateMultiCustomProperty: (key: string, value: string) => void;
  updateMultiHeight: (delta: number) => void;
  updateMultiClearance: (delta: number) => void;
  updateMultiLayer: (rawTargetLayerId: string) => void;
}

export function useBinInspectorMultiActions(deps: MultiActionDeps): MultiActions {
  const { selectedBins, layout, updateBin, addToast, t } = deps;

  const updateMultiCategory = useCallback(
    (rawCategoryId: string) => {
      if (selectedBins.length === 0) return;
      const brandedCategoryId: CategoryId = toCategoryId(rawCategoryId);

      const binsToUpdate = selectedBins.filter((b) => b.category !== brandedCategoryId);
      if (binsToUpdate.length === 0) return;

      const batchSize = binsToUpdate.length;
      const category = layout.categories.find((c) => c.id === brandedCategoryId);

      batch(() => {
        for (const b of binsToUpdate) {
          if (isErr(updateBin(b.id, { category: brandedCategoryId }))) break;
        }
      });

      // Track once per batch with category name (not per bin)
      if (category && binsToUpdate.length > 0) {
        mlTracking.trackCategory(binsToUpdate[0], category.name, batchSize);
      }
    },
    [selectedBins, layout.categories, updateBin]
  );

  // Update/add a custom property on multiple bins
  const updateMultiCustomProperty = useCallback(
    (key: string, value: string) => {
      if (selectedBins.length === 0) return;
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      if (!trimmedKey) return;

      batch(() => {
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
    [selectedBins, updateBin, addToast, t]
  );

  const updateMultiHeight = useCallback(
    (delta: number) => {
      if (selectedBins.length === 0) return;

      // Pre-compute new heights before execute mutates state (needed for sync events)
      const updates = selectedBins.map((b) => {
        const binLayer = layout.layers.find((l) => l.id === b.layerId);
        const minHeight = Math.max(
          CONSTRAINTS.MIN_BIN_HEIGHT,
          binLayer?.height || CONSTRAINTS.MIN_BIN_HEIGHT
        );
        let binMaxHeight = layout.drawer.height as number;
        if (b.layerId !== STAGING_ID && binLayer) {
          const zR = getLayerZStartResult(b.layerId, layout.layers);
          binMaxHeight = layout.drawer.height - (isOk(zR) ? zR.value : layout.drawer.height);
        }
        const newHeight = clamp(b.height + delta, minHeight, binMaxHeight) as HeightUnits;
        return { bin: b, newHeight };
      });

      const succeededBinIds = new Set<BinId>();
      batch(() => {
        for (const { bin: b, newHeight } of updates) {
          if (isErr(updateBin(b.id, { height: newHeight }))) break;
          succeededBinIds.add(b.id);
        }
      });

      // Emit sync events only for bins that were successfully updated.
      // Deduplicate by linkedDesignId to avoid concurrent IDB writes.
      // linkedDesignId isn't branded, so a plain string set is correct here.
      const emittedDesigns = new Set<string>();
      for (const { bin: b, newHeight } of updates) {
        if (!succeededBinIds.has(b.id)) continue;
        if (!b.linkedDesignId || newHeight === b.height) continue;
        if (emittedDesigns.has(b.linkedDesignId)) continue;
        emittedDesigns.add(b.linkedDesignId);
        emitLinkedBinResize(b, { width: b.width, depth: b.depth, height: newHeight });
      }
    },
    [selectedBins, layout.drawer.height, layout.layers, updateBin]
  );

  const updateMultiClearance = useCallback(
    (delta: number) => {
      if (selectedBins.length === 0) return;

      batch(() => {
        for (const b of selectedBins) {
          const binLayer = layout.layers.find((l) => l.id === b.layerId);
          // For staging bins, use full drawer height; for placed bins, account for layer position
          let binMaxHeight = layout.drawer.height as number;
          if (b.layerId !== STAGING_ID && binLayer) {
            const zR = getLayerZStartResult(b.layerId, layout.layers);
            binMaxHeight = layout.drawer.height - (isOk(zR) ? zR.value : layout.drawer.height);
          }
          const maxClearance = binMaxHeight - b.height;
          const newClearance = clamp(
            (b.clearanceHeight || 0) + delta,
            0,
            maxClearance
          ) as HeightUnits;
          updateBin(b.id, { clearanceHeight: newClearance });
        }
      });
    },
    [selectedBins, layout.drawer.height, layout.layers, updateBin]
  );

  const updateMultiLayer = useCallback(
    (rawTargetLayerId: string) => {
      if (selectedBins.length === 0) return;
      const targetLayerId: LayerId = toLayerId(rawTargetLayerId);

      const targetLayer = layout.layers.find((l) => l.id === targetLayerId);
      if (!targetLayer) return;

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

      batch(() => {
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
          t('toast.movedPartialToLayer', {
            moved: movable.length,
            total: binsToMove.length,
            blocked: blocked.length,
          }),
          'info'
        );
      } else {
        addToast(
          t('toast.movedMultiToLayer', { count: movable.length, name: targetLayer.name }),
          'success'
        );
      }
    },
    [selectedBins, layout, updateBin, addToast, t]
  );

  return {
    updateMultiCategory,
    updateMultiCustomProperty,
    updateMultiHeight,
    updateMultiClearance,
    updateMultiLayer,
  };
}
