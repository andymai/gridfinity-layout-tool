/**
 * The layout owns the designer's X grid unit, height unit, magnet anchor and
 * low-profile base, so a designed bin mates with the baseplate. This hook
 * copies them into the designer's BinParams when either store changes. The Y
 * grid pitch stays a per-design override (see `usePhysicalUnitsSection`).
 *
 * The copy pushes no undo entry: the user changed the layout, not the design.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import type { Layout } from '@/core/types';
import { withLowProfileBase } from '@/shared/generation/lowProfileBase';
import { useDesignerStore } from '../store';
import { setPendingMeshCache } from '../store/helpers';
import type { BinParams } from '../types';
import { withSyncedLidHeight } from '../utils/lidHeightUnits';
import { heldCutoutFillMm, reanchorCutoutFill } from '../utils/cutoutFill';
import { withResolvedCutoutDepths } from '@/shared/utils/cutoutDepth';

type LayoutUnits = Pick<Layout, 'gridUnitMm' | 'heightUnitMm' | 'magnetAnchor' | 'lowProfileBase'>;

function withLayoutUnits(params: BinParams, layout: LayoutUnits): BinParams {
  const sameUnits =
    params.gridUnitMm === layout.gridUnitMm &&
    params.heightUnitMm === layout.heightUnitMm &&
    params.magnetAnchor === layout.magnetAnchor;
  const withUnits = sameUnits
    ? params
    : withSyncedLidHeight({
        ...params,
        gridUnitMm: layout.gridUnitMm,
        heightUnitMm: layout.heightUnitMm,
        magnetAnchor: layout.magnetAnchor,
      });
  const synced = withLowProfileBase(withUnits, layout.lowProfileBase);
  return withResolvedCutoutDepths(withHeldCutoutFill(synced, params));
}

// The height unit and the low-profile base both move the wall height, and a
// fill held to the floor keeps its height across that, as it does across every
// param action (`applyCutoutFillAnchor`).
function withHeldCutoutFill(next: BinParams, prev: BinParams): BinParams {
  if (next === prev) return next;
  const topOffset = reanchorCutoutFill(next, heldCutoutFillMm(prev));
  return topOffset === undefined
    ? next
    : { ...next, cutoutConfig: { ...next.cutoutConfig, topOffset } };
}

function syncParams(layout: LayoutUnits, alreadyRegenerating: boolean): void {
  const { params, generation } = useDesignerStore.getState();
  const synced = withLayoutUnits(params, layout);
  if (synced === params) return;

  // The pending mesh has the old units, so it must not attach to the next undo
  // entry.
  setPendingMeshCache(null);

  useDesignerStore.setState({
    params: synced,
    generation: {
      ...generation,
      epoch: alreadyRegenerating ? generation.epoch : generation.epoch + 1,
    },
  });
}

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
    syncParams({ gridUnitMm, heightUnitMm, magnetAnchor, lowProfileBase }, false);
  }, [gridUnitMm, heightUnitMm, magnetAnchor, lowProfileBase]);

  // The effect above runs only when the LAYOUT changes. A design load, a version
  // restore and an undo replace the params with the units of the saved state,
  // and the preview and the export would then use a pitch the drawer does not
  // have. A replacement that bumped the epoch already regenerates from the
  // synced params. A cache-hit undo does not, and its cached mesh has the old
  // units.
  useEffect(
    () =>
      useDesignerStore.subscribe((state, prev) => {
        if (state.params === prev.params) return;
        syncParams(
          useLayoutStore.getState().layout,
          state.generation.epoch !== prev.generation.epoch
        );
      }),
    []
  );
}
