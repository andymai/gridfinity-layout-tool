/**
 * Syncs gridUnitMm and heightUnitMm from the layout store into the designer
 * store's BinParams. This ensures the bin designer always uses the layout's
 * physical unit settings for generation and export.
 *
 * Updates are applied WITHOUT pushing history (no undo entry) since the user
 * changed the value in the layout store, not via the designer panel.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useDesignerStore } from '../store';

export function useSyncPhysicalUnits(): void {
  const { gridUnitMm, heightUnitMm } = useLayoutStore(
    useShallow((state) => ({
      gridUnitMm: state.layout.gridUnitMm,
      heightUnitMm: state.layout.heightUnitMm,
    }))
  );

  useEffect(() => {
    const { params } = useDesignerStore.getState();
    if (params.gridUnitMm === gridUnitMm && params.heightUnitMm === heightUnitMm) {
      return;
    }

    // Update params without history push — epoch increments to trigger regeneration
    useDesignerStore.setState((state) => ({
      params: {
        ...state.params,
        gridUnitMm,
        heightUnitMm,
      },
      generation: {
        ...state.generation,
        epoch: state.generation.epoch + 1,
      },
    }));
  }, [gridUnitMm, heightUnitMm]);
}
