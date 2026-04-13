import type { Layer, LayerId, HeightUnits } from '@/core/types';
import type { Result, LayoutError } from '@/core/result';
import {
  ok,
  err,
  OK,
  isOk,
  layoutLayerLimit,
  layoutLastEntity,
  layoutInvalidOperation,
} from '@/core/result';
import { generateLayerId, CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import { checkLayerReorderCollisions } from '@/shared/utils/collision';
import { useSettingsStore } from '../settings';
import { requireLayer } from './helpers';
import type { SetLocal, GetState } from './types';

export function createLayerActions(setLocal: SetLocal, get: GetState) {
  return {
    addLayer: (): Result<LayerId, LayoutError> => {
      const { layout } = get();
      if (layout.layers.length >= CONSTRAINTS.LAYERS_MAX) {
        return err(layoutLayerLimit(layout.layers.length, CONSTRAINTS.LAYERS_MAX));
      }

      const totalHeight = layout.layers.reduce((sum, l) => sum + l.height, 0);
      const remaining = layout.drawer.height - totalHeight;
      if (remaining < CONSTRAINTS.MIN_LAYER_HEIGHT) {
        return err(layoutInvalidOperation('addLayer', 'No remaining height in drawer'));
      }

      const defaultLayerHeight = useSettingsStore.getState().settings.defaultLayerHeight;

      const id = generateLayerId();
      const newLayer: Layer = {
        id,
        name: `Layer ${layout.layers.length + 1}`,
        height: Math.min(remaining, defaultLayerHeight) as HeightUnits,
      };

      setLocal((state) => {
        state.layout.layers.push(newLayer);
      });

      return ok(id);
    },

    updateLayer: (id: LayerId, updates: Partial<Layer>): Result<void, LayoutError> => {
      const { layout } = get();
      const found = requireLayer(layout.layers, id, 'updateLayer');
      if (!isOk(found)) return found;

      setLocal((state) => {
        const l = state.layout.layers.find((l) => l.id === id);
        if (l) {
          if (updates.height !== undefined) {
            const othersHeight = state.layout.layers
              .filter((layer) => layer.id !== id)
              .reduce((sum, layer) => sum + layer.height, 0);
            const maxHeight = state.layout.drawer.height - othersHeight;
            updates.height = clamp(
              updates.height,
              CONSTRAINTS.MIN_LAYER_HEIGHT,
              maxHeight
            ) as HeightUnits;
          }
          const { id: _stripId, ...safeUpdates } = updates;
          Object.assign(l, safeUpdates);
        }
      });

      return OK;
    },

    deleteLayer: (id: LayerId): Result<void, LayoutError> => {
      const { layout } = get();
      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) {
        return err(layoutLastEntity('layer'));
      }

      const found = requireLayer(layout.layers, id, 'deleteLayer');
      if (!isOk(found)) return found;

      setLocal((state) => {
        state.layout.layers = state.layout.layers.filter((l) => l.id !== id);
        state.layout.bins = state.layout.bins.map((b) =>
          b.layerId === id ? { ...b, layerId: STAGING_ID } : b
        );
      });

      return OK;
    },

    reorderLayers: (fromIndex: number, toIndex: number): Result<void, LayoutError> => {
      const { layout } = get();

      if (fromIndex === toIndex) return OK;
      if (fromIndex < 0 || fromIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid source index'));
      }
      if (toIndex < 0 || toIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid target index'));
      }

      const newLayers = [...layout.layers];
      const [moved] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, moved);

      const collisions = checkLayerReorderCollisions(layout.bins, layout.layers, newLayers);
      if (collisions.length > 0) {
        return err(
          layoutInvalidOperation(
            'reorderLayers',
            `Reordering would cause ${collisions.length} bin collision${collisions.length > 1 ? 's' : ''}`
          )
        );
      }

      setLocal((state) => {
        state.layout.layers = newLayers;
      });

      return OK;
    },
  };
}
