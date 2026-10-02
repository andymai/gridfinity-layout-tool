/**
 * Syncs gridUnitMm, heightUnitMm, the magnet anchor and the low-profile base from
 * the layout store into the designer store's BinParams. This ensures the bin
 * designer always uses the layout's physical unit settings — and its
 * layout-scoped base geometry — for generation and export, so a designed bin
 * mates with the baseplate.
 *
 * Updates are applied WITHOUT pushing history (no undo entry) since the user
 * changed the value in the layout store, not via the designer panel.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { withLowProfileBase } from '@/shared/generation/lowProfileBase';
import { useDesignerStore } from '../store';
import { setPendingMeshCache } from '../store/helpers';

export function useSyncPhysicalUnits(): void {
  const { gridUnitMm, heightUnitMm, magnetAnchor, lowProfileBase } = useLayoutStore(
    useShallow((state) => ({
      gridUnitMm: state.layout.gridUnitMm,
      heightUnitMm: state.layout.heightUnitMm,
      magnetAnchor: state.layout.magnetAnchor,
      lowProfileBase: state.layout.lowProfileBase,
    }))
  );

  useEffect(() => {
    const { params } = useDesignerStore.getState();
    if (
      params.gridUnitMm === gridUnitMm &&
      params.heightUnitMm === heightUnitMm &&
      params.magnetAnchor === magnetAnchor &&
      withLowProfileBase(params, lowProfileBase) === params
    ) {
      return;
    }

    // Clear pending mesh cache — the old mesh was generated with different
    // physical units and would be incorrectly associated with the next undo entry.
    setPendingMeshCache(null);

    // Update params without history push — epoch increments to trigger regeneration
    useDesignerStore.setState((state) => ({
      params: {
        ...withLowProfileBase(state.params, lowProfileBase),
        gridUnitMm,
        heightUnitMm,
        magnetAnchor,
      },
      generation: {
        ...state.generation,
        epoch: state.generation.epoch + 1,
      },
    }));
  }, [gridUnitMm, heightUnitMm, magnetAnchor, lowProfileBase]);

  // The effect above only fires when the LAYOUT changes. Opening another design
  // replaces the params wholesale, and a design saved in a standard drawer would
  // then preview and export standard feet inside a low-profile one. The other
  // fields carry their own value in the design; this one never may.
  useEffect(
    () =>
      useDesignerStore.subscribe((state, prev) => {
        if (state.params === prev.params) return;
        const synced = withLowProfileBase(
          state.params,
          useLayoutStore.getState().layout.lowProfileBase
        );
        if (synced === state.params) return;
        setPendingMeshCache(null);
        useDesignerStore.setState({
          params: synced,
          generation: { ...state.generation, epoch: state.generation.epoch + 1 },
        });
      }),
    []
  );
}
