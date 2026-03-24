import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { canPlaceBin } from '@/shared/utils/validation';
import { STAGING_ID } from '@/core/constants';
import type { CategoryId, LayerId, HeightUnits } from '@/core/types';
import { batch } from '@/core/cqrs';

/**
 * Hook providing bulk actions for multi-selected bins.
 *
 * All actions wrap mutations in a single `batch()` call for one-step undo.
 * Collision-aware operations skip bins that can't be placed and report via toast.
 */
export function useSelectionActions() {
  const t = useTranslation();
  const { bins, layout, updateBin, deleteBins, moveBinToStaging } = useLayoutStore(
    useShallow((s) => ({
      bins: s.layout.bins,
      layout: s.layout,
      updateBin: s.updateBin,
      deleteBins: s.deleteBins,
      moveBinToStaging: s.moveBinToStaging,
    }))
  );
  const { selectedBinIds, clearSelection } = useSelectionStore(
    useShallow((s) => ({
      selectedBinIds: s.selectedBinIds,
      clearSelection: s.clearSelection,
    }))
  );
  const addToast = useToastStore((s) => s.addToast);

  const getSelectedBins = useCallback(
    () => bins.filter((b) => selectedBinIds.includes(b.id) && b.layerId !== STAGING_ID),
    [bins, selectedBinIds]
  );

  const setCategory = useCallback(
    (categoryId: CategoryId) => {
      const selected = getSelectedBins();
      if (selected.length === 0) return;

      const needsUpdate = selected.filter((b) => b.category !== categoryId);
      if (needsUpdate.length === 0) return;

      batch(() => {
        for (const bin of needsUpdate) {
          updateBin(bin.id, { category: categoryId });
        }
      });

      const category = layout.categories.find((c) => c.id === categoryId);
      addToast({
        message: t('toast.categoryChanged', {
          count: needsUpdate.length,
          name: category?.name ?? '',
        }),
        type: 'success',
        duration: 2000,
      });
    },
    [getSelectedBins, updateBin, layout.categories, addToast, t]
  );

  const rotateAll = useCallback(() => {
    const selected = getSelectedBins();
    if (selected.length === 0) return;

    const excludeIds = new Set(selectedBinIds);
    const rotatable = selected.filter((bin) => {
      // Square bins don't need rotation
      if (bin.width === bin.depth) return false;

      const validation = canPlaceBin(
        {
          x: bin.x,
          y: bin.y,
          width: bin.depth,
          depth: bin.width,
          height: bin.height,
          clearanceHeight: bin.clearanceHeight,
        },
        bin.layerId,
        layout,
        bin.id,
        excludeIds
      );
      return validation.valid;
    });

    const total = selected.filter((b) => b.width !== b.depth).length;
    const skipped = total - rotatable.length;

    if (rotatable.length === 0) {
      if (total > 0) {
        addToast({
          message: t('toast.rotateAllPartial', { rotated: 0, total, skipped: total }),
          type: 'info',
          duration: 3000,
        });
      }
      return;
    }

    batch(() => {
      for (const bin of rotatable) {
        updateBin(bin.id, { width: bin.depth, depth: bin.width });
      }
    });

    if (skipped > 0) {
      addToast({
        message: t('toast.rotateAllPartial', { rotated: rotatable.length, total, skipped }),
        type: 'info',
        duration: 3000,
      });
    } else {
      addToast({
        message: t('toast.rotateAllComplete', { rotated: rotatable.length }),
        type: 'success',
        duration: 2000,
      });
    }
  }, [getSelectedBins, selectedBinIds, layout, updateBin, addToast, t]);

  const matchHeight = useCallback(() => {
    const selected = getSelectedBins();
    if (selected.length === 0) return;

    const maxHeight = Math.max(...selected.map((b) => b.height)) as HeightUnits;
    const candidates = selected.filter((b) => b.height !== maxHeight);
    if (candidates.length === 0) return;

    // Validate height is legal per-layer (higher layers have less vertical budget)
    const excludeIds = new Set(selectedBinIds);
    const updatable = candidates.filter((bin) => {
      const validation = canPlaceBin(
        {
          x: bin.x,
          y: bin.y,
          width: bin.width,
          depth: bin.depth,
          height: maxHeight,
          clearanceHeight: bin.clearanceHeight,
        },
        bin.layerId,
        layout,
        bin.id,
        excludeIds
      );
      return validation.valid;
    });

    if (updatable.length === 0) return;

    batch(() => {
      for (const bin of updatable) {
        updateBin(bin.id, { height: maxHeight });
      }
    });

    addToast({
      message: t('toast.matchHeightComplete', { count: updatable.length, height: maxHeight }),
      type: 'success',
      duration: 2000,
    });
  }, [getSelectedBins, selectedBinIds, layout, updateBin, addToast, t]);

  const moveToLayer = useCallback(
    (targetLayerId: LayerId) => {
      const selected = getSelectedBins();
      if (selected.length === 0) return;

      const targetLayer = layout.layers.find((l) => l.id === targetLayerId);
      if (!targetLayer) return;

      // Only move bins not already on the target layer
      const candidates = selected.filter((b) => b.layerId !== targetLayerId);
      if (candidates.length === 0) return;

      const excludeIds = new Set(selectedBinIds);
      const movable = candidates.filter((bin) => {
        const validation = canPlaceBin(
          {
            x: bin.x,
            y: bin.y,
            width: bin.width,
            depth: bin.depth,
            height: targetLayer.height,
            clearanceHeight: bin.clearanceHeight,
          },
          targetLayerId,
          layout,
          bin.id,
          excludeIds
        );
        return validation.valid;
      });

      const skipped = candidates.length - movable.length;

      if (movable.length === 0) {
        addToast({
          message: t('toast.moveToLayerPartial', {
            moved: 0,
            total: candidates.length,
            skipped: candidates.length,
            name: targetLayer.name,
          }),
          type: 'info',
          duration: 3000,
        });
        return;
      }

      batch(() => {
        for (const bin of movable) {
          updateBin(bin.id, { layerId: targetLayerId, height: targetLayer.height });
        }
      });

      clearSelection();

      if (skipped > 0) {
        addToast({
          message: t('toast.moveToLayerPartial', {
            moved: movable.length,
            total: candidates.length,
            skipped,
            name: targetLayer.name,
          }),
          type: 'info',
          duration: 3000,
        });
      } else {
        addToast({
          message: t('toast.moveToLayerComplete', {
            count: movable.length,
            name: targetLayer.name,
          }),
          type: 'success',
          duration: 2000,
        });
      }
    },
    [getSelectedBins, selectedBinIds, layout, updateBin, clearSelection, addToast, t]
  );

  const moveToStash = useCallback(() => {
    const count = selectedBinIds.length;
    if (count === 0) return;

    batch(() => {
      for (const id of selectedBinIds) {
        moveBinToStaging(id);
      }
    });

    clearSelection();
    addToast({
      message: t('toast.movedToStash', { count }),
      type: 'success',
      duration: 2000,
    });
  }, [selectedBinIds, moveBinToStaging, clearSelection, addToast, t]);

  const deleteAll = useCallback(() => {
    const count = selectedBinIds.length;
    if (count === 0) return;

    batch(() => {
      deleteBins([...selectedBinIds]);
    });

    clearSelection();
    addToast({
      message: t('toast.binsDeleted', { count }),
      type: 'success',
      duration: 2000,
    });
  }, [selectedBinIds, deleteBins, clearSelection, addToast, t]);

  return { setCategory, rotateAll, matchHeight, moveToLayer, moveToStash, deleteAll };
}
