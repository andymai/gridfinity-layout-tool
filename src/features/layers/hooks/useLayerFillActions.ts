/**
 * Fill/clear actions for the active layer, shared by the desktop
 * ActiveLayerPanel and the mobile ToolsTab so the two surfaces can't drift.
 *
 * The added-count toasts read the store AFTER the batch commits (via
 * setTimeout(0)) because fill mutations dispatch through CQRS — the bin list
 * captured before the batch is the baseline, the post-commit read is the
 * result. `onAfterAction` runs synchronously after each action's batch
 * (mobile closes its panel there); the toast still fires afterwards.
 */

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { useToastStore } from '@/core/store/toast';
import { getLayerBins } from '@/shared/utils';
import { useTranslation } from '@/i18n';
import { batch } from '@/core/cqrs';
import type { Bin, Layer } from '@/core/types';

export interface LayerFillActions {
  activeLayer: Layer | undefined;
  layerBins: Bin[];
  totalCells: number;
  emptyCells: number;
  clearConfirmOpen: boolean;
  setClearConfirmOpen: (open: boolean) => void;
  fillGaps: () => void;
  /** Clears the layer and deselects; closes the confirm dialog. */
  confirmClear: () => void;
  /** Fills with the given size and exits paint mode. */
  fillWithSize: (width: number, depth: number) => void;
}

export function useLayerFillActions(options?: { onAfterAction?: () => void }): LayerFillActions {
  const t = useTranslation();
  const onAfterAction = options?.onAfterAction;
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const layout = useLayoutStore((state) => state.layout);
  const { fillLayer, fillLayerGaps, clearLayer } = useMutations();

  const { activeLayerId, activeCategoryId, setSelectedBins } = useSelectionStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      activeCategoryId: state.activeCategoryId,
      setSelectedBins: state.setSelectedBins,
    }))
  );
  const setPaintSize = useInteractionStore((state) => state.setPaintSize);
  const halfGridMode = useHalfGridModeStore((state) => state.halfGridMode);
  const addToast = useToastStore((state) => state.addToast);

  const activeLayer = layout.layers.find((l) => l.id === activeLayerId);
  const layerBins = getLayerBins(layout.bins, activeLayerId);

  const totalCells = layout.drawer.width * layout.drawer.depth;
  const coveredCells = layerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const emptyCells = totalCells - coveredCells;

  const fillGaps = () => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    batch(() => {
      fillLayerGaps(activeLayerId, activeCategoryId, halfGridMode);
    });
    onAfterAction?.();
    setTimeout(() => {
      const afterCount = getLayerBins(useLayoutStore.getState().layout.bins, activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(t('toast.fillComplete', { count: added }), 'success');
      }
    }, 0);
  };

  const confirmClear = () => {
    if (!activeLayerId || layerBins.length === 0) return;
    const count = layerBins.length;
    batch(() => {
      clearLayer(activeLayerId);
      setSelectedBins([]);
    });
    addToast(t('toast.clearComplete', { count }), 'success');
    setClearConfirmOpen(false);
    onAfterAction?.();
  };

  const fillWithSize = (width: number, depth: number) => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    batch(() => {
      fillLayer(activeLayerId, width, depth, activeCategoryId, halfGridMode);
    });
    // Exit paint mode after filling
    setPaintSize(null);
    onAfterAction?.();
    setTimeout(() => {
      const afterCount = getLayerBins(useLayoutStore.getState().layout.bins, activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(t('toast.fillWithSize', { count: added, width, depth }), 'success');
      }
    }, 0);
  };

  return {
    activeLayer,
    layerBins,
    totalCells,
    emptyCells,
    clearConfirmOpen,
    setClearConfirmOpen,
    fillGaps,
    confirmClear,
    fillWithSize,
  };
}
