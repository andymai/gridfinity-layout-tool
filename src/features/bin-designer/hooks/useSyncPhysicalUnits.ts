/**
 * Syncs gridUnitMm, heightUnitMm, and the magnet anchor from the layout store
 * into the designer store's BinParams. This ensures the bin designer always uses
 * the layout's physical unit settings — and its layout-scoped magnet anchor — for
 * generation and export, so a designed bin's magnets mate with the baseplate.
 *
 * Updates are applied WITHOUT pushing history (no undo entry) since the user
 * changed the value in the layout store, not via the designer panel.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useDesignerStore } from '../store';
import { setPendingMeshCache } from '../store/helpers';

export function useSyncPhysicalUnits(): void {
  const { gridUnitMm, heightUnitMm, magnetAnchor } = useLayoutStore(
    useShallow((state) => ({
      gridUnitMm: state.layout.gridUnitMm,
      heightUnitMm: state.layout.heightUnitMm,
      magnetAnchor: state.layout.magnetAnchor,
    }))
  );

  useEffect(() => {
    const { params } = useDesignerStore.getState();
    if (
      params.gridUnitMm === gridUnitMm &&
      params.heightUnitMm === heightUnitMm &&
      params.magnetAnchor === magnetAnchor
    ) {
      return;
    }

    // Clear pending mesh cache — the old mesh was generated with different
    // physical units and would be incorrectly associated with the next undo entry.
    setPendingMeshCache(null);

    // Update params without history push — epoch increments to trigger regeneration
    useDesignerStore.setState((state) => ({
      params: {
        ...state.params,
        gridUnitMm,
        heightUnitMm,
        magnetAnchor,
      },
      generation: {
        ...state.generation,
        epoch: state.generation.epoch + 1,
      },
    }));
  }, [gridUnitMm, heightUnitMm, magnetAnchor]);
}
