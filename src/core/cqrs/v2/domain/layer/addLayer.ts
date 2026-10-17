/**
 * Add a layer. Validates the layer-count limit before generating one. A
 * layer's height is only the default for bins drawn on it, so layers never
 * share out the drawer height. Reads `defaultLayerHeight` from the settings
 * store directly — settings are config-not-state, outside the layout
 * aggregate snapshot.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutLayerLimit } from '@/core/result';
import { generateLayerId, CONSTRAINTS } from '@/core/constants';
import { useSettingsStore } from '@/core/store/settings';
import type { Layer, LayerId } from '@/core/types';
import { heightUnits } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({}).optional();

export const addLayer = defineCommand({
  type: 'layer.add',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layer.added',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    _payload,
    ctx
  ): Result<{ value: LayerId; event: { payload: { layer: Layer } } }, LayoutError> => {
    const layout = ctx.aggregate;

    if (layout.layers.length >= CONSTRAINTS.LAYERS_MAX) {
      return err(layoutLayerLimit(layout.layers.length, CONSTRAINTS.LAYERS_MAX));
    }

    const defaultLayerHeight = useSettingsStore.getState().settings.defaultLayerHeight;
    const id = generateLayerId();
    const layer: Layer = {
      id,
      name: `Layer ${String(layout.layers.length + 1)}`,
      height: heightUnits(
        Math.max(CONSTRAINTS.MIN_LAYER_HEIGHT, Math.min(layout.drawer.height, defaultLayerHeight))
      ),
    };

    return ok({
      value: id,
      event: { payload: { layer } },
    });
  },
  apply: (event, draft) => {
    draft.layers.push(event.payload.layer);
  },
});
