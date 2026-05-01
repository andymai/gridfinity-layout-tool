/**
 * bin.clearLayer — v2 (defineCommand) shape.
 *
 * Capture the full set of bins being removed in the event payload so undo
 * can restore them. v1 reported `binsRemoved` as a count — v2 keeps that
 * for backward compatibility but the source of truth is `bins.length`.
 *
 * No validation: clearing an empty layer is a no-op (emits an event with
 * an empty bins array, which apply() short-circuits on).
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { layerId as toLayerId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ layerId: z.string().min(1) });

export const clearLayer = defineCommand({
  type: 'bin.clearLayer',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.layerCleared',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layerClear',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const layerId = toLayerId(payload.layerId);
    const bins = ctx.aggregate.bins.filter((b) => b.layerId === layerId).map((b) => ({ ...b }));

    return ok({
      value: bins.length,
      event: { payload: { layerId, binsRemoved: bins.length, bins } },
    });
  },
  apply: (event, draft) => {
    if (event.payload.bins.length === 0) return;
    draft.bins = draft.bins.filter((b) => b.layerId !== event.payload.layerId);
  },
});
