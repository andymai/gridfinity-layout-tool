import type { CategoryId, LayerId } from '@/core/types';
import { calcMaxGridUnits } from '@/core/constants';
import { fillAllWithSize, fillGaps } from '@/shared/utils/fill';
import type { SetLocal, GetState } from './types';

export function createBulkActions(setLocal: SetLocal, get: GetState) {
  return {
    fillLayer: (
      layerId: LayerId,
      width: number,
      depth: number,
      categoryId: CategoryId,
      halfBinMode = false
    ): number => {
      const { layout } = get();
      const result = fillAllWithSize(layout, layerId, width, depth, categoryId, halfBinMode);

      if (result.bins.length > 0) {
        const layer = layout.layers.find((l) => l.id === layerId);
        setLocal((state) => {
          state.layout.bins.push(...result.bins);
          state._fillMeta = {
            type: 'uniform',
            count: result.bins.length,
            layerId,
            width,
            depth,
            layerHeight: layer?.height ?? 1,
          };
        });
      }

      return result.bins.length;
    },

    fillLayerGaps: (layerId: LayerId, categoryId: CategoryId, halfBinMode = false): number => {
      const { layout } = get();
      const maxGrid = calcMaxGridUnits(
        layout.printBedSize,
        layout.gridUnitMm,
        layout.printBedDepth
      );
      const result = fillGaps(
        layout,
        layerId,
        categoryId,
        Math.min(maxGrid.width, maxGrid.depth),
        halfBinMode
      );

      if (result.bins.length > 0) {
        setLocal((state) => {
          state.layout.bins.push(...result.bins);
          state._fillMeta = {
            type: 'gaps',
            count: result.bins.length,
            layerId,
          };
        });
      }

      return result.addedCount;
    },

    clearLayer: (layerId: LayerId): number => {
      const { layout } = get();
      const count = layout.bins.filter((b) => b.layerId === layerId).length;

      if (count === 0) return 0;

      setLocal((state) => {
        state.layout.bins = state.layout.bins.filter((b) => b.layerId !== layerId);
      });

      return count;
    },
  };
}
