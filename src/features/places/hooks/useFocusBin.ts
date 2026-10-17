import { useCallback } from 'react';
import { STAGING_ID } from '@/core/constants';
import { isErr } from '@/core/result';
import { useLayoutStore, useSelectionStore } from '@/core/store';
import type { BinId, LayoutId } from '@/core/types';
import { revealBin } from '@/shared/events/revealBin';
import { useLayoutSwitcher } from '@/shared/hooks';

/**
 * Opens the bin's layout if it is not the active one, then selects the bin on
 * its own layer. Selecting is the highlight: a selected bin already gets the
 * ring in the grid and the glow in the 3D preview.
 */
export function useFocusBin(): (layoutId: LayoutId, binId: BinId) => Promise<void> {
  const { switchLayout } = useLayoutSwitcher();

  return useCallback(
    async (layoutId: LayoutId, binId: BinId) => {
      if (useLayoutStore.getState().activeLayoutId !== layoutId) {
        const switched = await switchLayout(layoutId);
        if (isErr(switched)) return;
      }
      const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
      if (!bin) return;
      const selection = useSelectionStore.getState();
      // Activating a layer clears the selection, so the layer comes first.
      if (bin.layerId !== STAGING_ID) selection.setActiveLayer(bin.layerId);
      selection.setSelectedBins([binId]);
      revealBin(binId);
    },
    [switchLayout]
  );
}
