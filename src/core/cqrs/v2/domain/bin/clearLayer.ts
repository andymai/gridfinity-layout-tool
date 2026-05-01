/**
 * Clear all bins on a layer. Captures the full set in the event payload
 * so undo can restore them; `binsRemoved: number` is preserved for v1
 * consumer compatibility even though it duplicates `bins.length`.
 * Empty layer is a valid no-op.
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
