/**
 * Extracted selectors for commonly used store state derivations.
 *
 * Guidelines (for selector functions, e.g. `select*`):
 * - Only extract selectors used 3+ times OR that compute derived data
 * - Simple property access (s => s.layout) doesn't need extraction
 * - Selector functions are plain functions, not hooks — use them inside useStore() calls
 * - For cross-store or more complex derived computations, export custom hooks instead
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { STAGING_ID } from '@/core/constants';
import type { Bin, Layer, LayerId } from '@/core/types';
import { getLayerBins } from '@/shared/utils/bins';
import { useLayoutStore } from './layout';
import { useSelectionStore } from './selection';

// Layout Selectors (pure functions for use with useStore)

/** Select just the bins array from layout state. */
export const selectBins = (state: { layout: { bins: Bin[] } }): Bin[] => state.layout.bins;

/** Select just the layers array from layout state. */
export const selectLayers = (state: { layout: { layers: Layer[] } }): Layer[] =>
  state.layout.layers;

// Computed Hooks (cross-store or derived data)

/**
 * Get bins on the active layer (excluding staging).
 * This is the most commonly duplicated computation in the codebase (10+ instances).
 * Combines layout store (bins) with selection store (activeLayerId).
 *
 * @returns Memoized array of bins on the active layer
 */
export function useActiveLayerBins(): Bin[] {
  const bins = useLayoutStore(selectBins);
  const activeLayerId = useSelectionStore((s) => s.activeLayerId);

  return useMemo(() => getLayerBins(bins, activeLayerId), [bins, activeLayerId]);
}

/**
 * Get the active layer object from the layout.
 * Combines layout store (layers) with selection store (activeLayerId).
 *
 * @returns The active Layer object, or undefined if not found
 */
export function useActiveLayer(): Layer | undefined {
  const layers = useLayoutStore(selectLayers);
  const activeLayerId = useSelectionStore((s) => s.activeLayerId);

  return useMemo(() => layers.find((l) => l.id === activeLayerId), [layers, activeLayerId]);
}

/**
 * Get the count of bins per layer (excluding staging).
 * Useful for layer panels that display bin counts.
 *
 * @returns Map from LayerId to bin count
 */
export function useLayerBinCounts(): Map<LayerId, number> {
  const bins = useLayoutStore(selectBins);

  return useMemo(() => {
    const counts = new Map<LayerId, number>();
    for (const bin of bins) {
      if (bin.layerId === STAGING_ID) continue;
      counts.set(bin.layerId, (counts.get(bin.layerId) ?? 0) + 1);
    }
    return counts;
  }, [bins]);
}

/**
 * Get staging (stash) bins.
 *
 * @returns Memoized array of bins in the stash
 */
export function useStagingBins(): Bin[] {
  const bins = useLayoutStore(selectBins);

  return useMemo(() => bins.filter((b) => b.layerId === STAGING_ID), [bins]);
}

/**
 * Get the selected bins as full Bin objects (not just IDs).
 * Combines layout store (bins) with selection store (selectedBinIds).
 *
 * @returns Memoized array of selected Bin objects
 */
export function useSelectedBins(): Bin[] {
  const bins = useLayoutStore(selectBins);
  const selectedBinIds = useSelectionStore(useShallow((s) => s.selectedBinIds));

  return useMemo(() => {
    if (selectedBinIds.length === 0) return [];
    const idSet = new Set(selectedBinIds);
    return bins.filter((b) => idSet.has(b.id));
  }, [bins, selectedBinIds]);
}
