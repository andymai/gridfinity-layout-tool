import type { Drawer, GridUnits, HeightUnits } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import { minDrawerUnitsForOutline } from '@/shared/utils/drawerOutline';
import { computeDisplacedBins } from '@/core/cqrs/v2/domain/drawer/displacement';
import type { SetLocal } from './types';

export function createDrawerActions(setLocal: SetLocal) {
  return {
    updateDrawer: (updates: Partial<Drawer>): void => {
      setLocal((state) => {
        const drawer = state.layout.drawer;
        const oldWidth = drawer.width as number;
        const oldDepth = drawer.depth as number;

        // With a custom outline active the shrink floor rises to the
        // outline's bounding half-unit grid — a resize must never mutate the
        // user's shape (#3149); same rule as the CQRS updateDrawer command.
        const outlineMin =
          drawer.outline !== undefined
            ? minDrawerUnitsForOutline(
                drawer.outline,
                state.layout.gridUnitMm,
                effectiveGridUnitMmY(state.layout)
              )
            : undefined;
        const axisFloor = (min: number | undefined): number =>
          Math.min(CONSTRAINTS.GRID_MAX, Math.max(CONSTRAINTS.GRID_MIN, min ?? 0));

        if (updates.width !== undefined) {
          drawer.width = clamp(
            updates.width,
            axisFloor(outlineMin?.width),
            CONSTRAINTS.GRID_MAX
          ) as GridUnits;
        }
        if (updates.depth !== undefined) {
          drawer.depth = clamp(
            updates.depth,
            axisFloor(outlineMin?.depth),
            CONSTRAINTS.GRID_MAX
          ) as GridUnits;
        }
        if (updates.height !== undefined) {
          const totalLayerHeight = state.layout.layers.reduce((sum, l) => sum + l.height, 0);
          drawer.height = Math.max(totalLayerHeight, updates.height) as HeightUnits;
        }
        if (updates.fractionalEdgeX !== undefined) {
          drawer.fractionalEdgeX = updates.fractionalEdgeX;
        }
        if (updates.fractionalEdgeY !== undefined) {
          drawer.fractionalEdgeY = updates.fractionalEdgeY;
        }

        // Move bins that no longer fit (bounds or outline) to staging. Planar
        // fit only depends on width/depth/outline — skip the geometry pass for
        // height/fractional-edge updates (this action runs per pointermove).
        const planarChanged =
          (drawer.width as number) !== oldWidth || (drawer.depth as number) !== oldDepth;
        if (!planarChanged) return;
        const displaced = new Set(
          computeDisplacedBins(
            state.layout.bins,
            drawer,
            state.layout.gridUnitMm,
            effectiveGridUnitMmY(state.layout)
          )
        );
        if (displaced.size > 0) {
          state.layout.bins = state.layout.bins.map((bin) =>
            displaced.has(bin.id) && bin.layerId !== STAGING_ID
              ? { ...bin, layerId: STAGING_ID }
              : bin
          );
        }
      });
    },
  };
}
