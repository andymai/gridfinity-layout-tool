/**
 * Add a layer. Validates layer-count limit and remaining drawer height
 * before generating one. Reads `defaultLayerHeight` from the settings
 * store directly — settings are config-not-state, outside the layout
 * aggregate snapshot.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutLayerLimit, layoutInvalidOperation } from '@/core/result';
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
  descriptionKey: 'undo.action.layerAdd',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    _payload,
    ctx
  ): Result<{ value: LayerId; event: { payload: { layer: Layer } } }, LayoutError> => {
    const layout = ctx.aggregate;

    if (layout.layers.length >= CONSTRAINTS.LAYERS_MAX) {
      return err(layoutLayerLimit(layout.layers.length, CONSTRAINTS.LAYERS_MAX));
    }

    const totalHeight = layout.layers.reduce((sum, l) => sum + (l.height as number), 0);
    const remaining = (layout.drawer.height as number) - totalHeight;
    if (remaining < CONSTRAINTS.MIN_LAYER_HEIGHT) {
      return err(layoutInvalidOperation('addLayer', 'No remaining height in drawer'));
    }

    const defaultLayerHeight = useSettingsStore.getState().settings.defaultLayerHeight;
    const id = generateLayerId();
    const layer: Layer = {
      id,
      name: `Layer ${String(layout.layers.length + 1)}`,
      height: heightUnits(Math.min(remaining, defaultLayerHeight)),
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
