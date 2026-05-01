/**
 * Per-command boost multipliers based on current app state.
 *
 * The frecency score (frequency × recency) is multiplied by these boosts so
 * the palette can surface the most-relevant commands first. e.g. when bins
 * are selected, alignment commands get a 2× boost; when staging is empty,
 * `clear-staging` gets a 0.3× damping.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useLayoutStore,
  useHistoryStore,
  useSelectionStore,
  useViewStore,
  useInteractionStore,
} from '@/core/store';
import { getStagingBins } from '@/shared/utils';

export function useContextBoosts(): Record<string, number> {
  const selectedBinIds = useSelectionStore((s) => s.selectedBinIds);
  const layout = useLayoutStore((s) => s.layout);
  const activeLayerId = useSelectionStore((s) => s.activeLayerId);
  const showIsometricPreview = useViewStore((s) => s.showIsometricPreview);
  const { canUndo, canRedo } = useHistoryStore(
    useShallow((s) => ({ canUndo: s.canUndo, canRedo: s.canRedo }))
  );
  const paintSize = useInteractionStore((s) => s.paintSize);

  return useMemo(() => {
    const hasBinsSelected = selectedBinIds.length > 0;
    const hasSingleBin = selectedBinIds.length === 1;
    const hasMultipleBins = selectedBinIds.length >= 2;
    const hasMultipleLayers = layout.layers.length > 1;
    const hasLayerBins = layout.bins.some((b) => b.layerId === activeLayerId);
    const hasStagingBins = getStagingBins(layout.bins).length > 0;

    return {
      // Edit commands - boost when bins selected
      'delete-selected': hasBinsSelected ? 2.0 : 0.4,
      'duplicate-selected': hasBinsSelected ? 2.0 : 0.4,
      'rotate-bin': hasSingleBin ? 2.0 : 0.3,
      'quick-label': hasSingleBin ? 1.8 : 0.4,
      'clear-selection': hasBinsSelected ? 1.5 : 0.3,
      'align-left': hasMultipleBins ? 2.0 : 0.3,
      'align-right': hasMultipleBins ? 2.0 : 0.3,
      'align-top': hasMultipleBins ? 2.0 : 0.3,
      'align-bottom': hasMultipleBins ? 2.0 : 0.3,
      'rotate-all': hasMultipleBins ? 2.0 : 0.3,
      'match-height': hasMultipleBins ? 2.0 : 0.3,
      'move-to-stash': hasBinsSelected ? 1.8 : 0.4,

      // Layer commands - boost when multiple layers
      'layer-up': hasMultipleLayers ? 1.5 : 0.5,
      'layer-down': hasMultipleLayers ? 1.5 : 0.5,
      'add-layer': layout.layers.length < 10 ? 1.3 : 0.5,
      'clear-layer': hasLayerBins ? 1.5 : 0.3,

      // 3D preview commands - boost when preview visible
      'expand-preview': showIsometricPreview ? 1.8 : 0.3,
      'toggle-preview': showIsometricPreview ? 1.0 : 1.5,

      // Undo/redo - boost when available
      undo: canUndo ? 1.5 : 0.3,
      redo: canRedo ? 1.5 : 0.3,

      // Category navigation - boost when bins selected
      'prev-category': hasBinsSelected ? 1.8 : 0.8,
      'next-category': hasBinsSelected ? 1.8 : 0.8,

      // Selection - boost select-all when no selection, select-none when selection exists
      'select-all': hasBinsSelected ? 0.5 : 1.8,
      'select-none': hasBinsSelected ? 1.5 : 0.3,

      // Paint mode - boost when not in paint mode
      'toggle-paint-mode': paintSize ? 1.2 : 1.5,

      // Fill operations - boost when layer has space
      'fill-layer': hasLayerBins ? 0.8 : 1.8,
      'fill-gaps': hasLayerBins ? 1.5 : 0.5,

      // Staging operations - boost when staging has bins
      'clear-staging': hasStagingBins ? 1.8 : 0.3,
      'restore-from-staging': hasStagingBins ? 2.0 : 0.3,

      // Advanced selection
      // invert-selection is boosted when the layer has any bins to invert against
      'invert-selection': hasLayerBins ? 1.5 : 0.3,
      // select-by-category needs an existing selection to read the source category from
      'select-by-category': hasBinsSelected ? 1.8 : 0.3,
    };
  }, [
    selectedBinIds.length,
    layout.layers.length,
    layout.bins,
    activeLayerId,
    showIsometricPreview,
    canUndo,
    canRedo,
    paintSize,
  ]);
}
