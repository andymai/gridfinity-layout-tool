/**
 * layer.update — v2 (defineCommand) shape.
 *
 * Per-command refactor: the v1 store action did the height-clamp inside
 * the setLocal mutator (so clamping was a hidden side effect of the
 * write). v2 inlines the clamp into handle so the event payload's
 * `changes.height` always reflects the value that will actually be
 * stored — no replay drift between native and apply paths.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import type { Layer, LayerId } from '@/core/types';
import { layerId as toLayerId, heightUnits } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const updatesSchema = z
  .object({
    name: z.string().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH),
    height: z.number().min(CONSTRAINTS.MIN_LAYER_HEIGHT),
  })
  .partial();

const payloadSchema = z.object({
  id: z.string().min(1),
  updates: updatesSchema,
});

function capturePrevious(layer: Layer, changes: Partial<Layer>): Partial<Layer> {
  const previous: Partial<Layer> = {};
  for (const key of Object.keys(changes) as Array<keyof Layer>) {
    (previous as Record<string, unknown>)[key as string] = layer[key];
  }
  return previous;
}

export const updateLayer = defineCommand({
  type: 'layer.update',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layer.updated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layerUpdate',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: undefined;
      event: { payload: { id: LayerId; changes: Partial<Layer>; previous: Partial<Layer> } };
    },
    LayoutError
  > => {
    const id = toLayerId(payload.id);
    const layout = ctx.aggregate;
    const existing = layout.layers.find((l) => l.id === id);
    if (!existing) {
      return err(layoutInvalidOperation('updateLayer', `Layer ${id} not found`));
    }

    const changes: Partial<Layer> = {};
    if (payload.updates.name !== undefined) changes.name = payload.updates.name;
    if (payload.updates.height !== undefined) {
      // Inline the clamp so the event records the value that will actually
      // be stored. Other layers' heights cap how much room remains.
      const othersHeight = layout.layers
        .filter((l) => l.id !== id)
        .reduce((sum, l) => sum + (l.height as number), 0);
      const maxHeight = (layout.drawer.height as number) - othersHeight;
      changes.height = heightUnits(
        clamp(payload.updates.height, CONSTRAINTS.MIN_LAYER_HEIGHT, maxHeight)
      );
    }

    return ok({
      value: undefined,
      event: { payload: { id, changes, previous: capturePrevious(existing, changes) } },
    });
  },
  apply: (event, draft) => {
    const layer = draft.layers.find((l) => l.id === event.payload.id);
    if (layer) Object.assign(layer, event.payload.changes);
  },
});
