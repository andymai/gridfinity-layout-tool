import type { Drawer, GridUnits, HeightUnits } from '@/core/types';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import { resizeDrawerOutline } from '@/shared/utils/drawerOutline';
import { computeDisplacedBins } from '@/core/cqrs/v2/domain/drawer/displacement';
import type { SetLocal } from './types';

export function createDrawerActions(setLocal: SetLocal) {
  return {
    updateDrawer: (updates: Partial<Drawer>): void => {
      setLocal((state) => {
        const drawer = state.layout.drawer;
        const oldWidth = drawer.width as number;
        const oldDepth = drawer.depth as number;

        if (updates.width !== undefined) {
          drawer.width = clamp(
            updates.width,
            CONSTRAINTS.GRID_MIN,
            CONSTRAINTS.GRID_MAX
          ) as GridUnits;
        }
        if (updates.depth !== undefined) {
          drawer.depth = clamp(
            updates.depth,
            CONSTRAINTS.GRID_MIN,
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

        // Adapt the outline to the new dims (crop/extend; degenerate result →
        // back to the plain rectangle) — same rule as the CQRS updateDrawer
        // command, shared via resizeDrawerOutline.
        if (
          drawer.outline !== undefined &&
          ((drawer.width as number) !== oldWidth || (drawer.depth as number) !== oldDepth)
        ) {
          const u = state.layout.gridUnitMm as number;
          const resized = resizeDrawerOutline(
            drawer.outline,
            oldWidth * u,
            oldDepth * u,
            (drawer.width as number) * u,
            (drawer.depth as number) * u,
            u
          );
          if (resized === undefined) {
            delete drawer.outline;
          } else {
            drawer.outline = resized;
          }
        }

        // Move bins that no longer fit (bounds or outline) to staging. Planar
        // fit only depends on width/depth/outline — skip the geometry pass for
        // height/fractional-edge updates (this action runs per pointermove).
        const planarChanged =
          (drawer.width as number) !== oldWidth || (drawer.depth as number) !== oldDepth;
        if (!planarChanged) return;
        const displaced = new Set(
          computeDisplacedBins(state.layout.bins, drawer, state.layout.gridUnitMm)
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
