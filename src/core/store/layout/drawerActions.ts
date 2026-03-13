import type { Drawer, GridUnits, HeightUnits } from '@/core/types';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import type { SetLocal } from './types';

export function createDrawerActions(setLocal: SetLocal) {
  return {
    updateDrawer: (updates: Partial<Drawer>): void => {
      setLocal((state) => {
        const drawer = state.layout.drawer;

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

        // Move out-of-bounds bins to staging
        state.layout.bins = state.layout.bins.map((bin) => {
          if (bin.layerId === STAGING_ID) return bin;

          if (bin.x + bin.width > drawer.width || bin.y + bin.depth > drawer.depth) {
            return { ...bin, layerId: STAGING_ID };
          }
          return bin;
        });
      });
    },
  };
}
