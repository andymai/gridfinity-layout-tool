/**
 * layer.reorder — v2 (defineCommand) shape.
 *
 * Validates indices and runs the reorder collision check against the
 * frozen layout snapshot before emitting. apply() does the actual array
 * splice on the draft.
 *
 * The event payload (`{fromIndex, toIndex}`) is sufficient for replay:
 * given the layout state at replay time, applying the same move
 * deterministically produces the same ordering.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import { checkLayerReorderCollisions } from '@/shared/utils/collision';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
});

export const reorderLayers = defineCommand({
  type: 'layer.reorder',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layer.reordered',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layerReorder',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    { value: undefined; event: { payload: { fromIndex: number; toIndex: number } } },
    LayoutError
  > => {
    const { fromIndex, toIndex } = payload;
    const layout = ctx.aggregate;

    // Self-move: succeed and emit; apply is a no-op. Matches v1 (the v1
    // store action returns OK without doing anything; the v1 handler
    // emits the event regardless). The event in the audit log is benign
    // signal that the user attempted a reorder.
    if (fromIndex === toIndex) {
      return ok({ value: undefined, event: { payload: { fromIndex, toIndex } } });
    }
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
          `Reordering would cause ${String(collisions.length)} bin collision${collisions.length > 1 ? 's' : ''}`
        )
      );
    }

    return ok({ value: undefined, event: { payload: { fromIndex, toIndex } } });
  },
  apply: (event, draft) => {
    const { fromIndex, toIndex } = event.payload;
    if (fromIndex === toIndex) return;
    const [moved] = draft.layers.splice(fromIndex, 1);
    draft.layers.splice(toIndex, 0, moved);
  },
});
