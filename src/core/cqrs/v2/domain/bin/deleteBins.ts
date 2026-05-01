/**
 * Delete multiple bins. The event payload carries the full Bin objects
 * so undo can reconstruct them, not just their ids. Lenient on
 * empty-or-missing ids: empty `bins` is a valid no-op result.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { binId as toBinId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  ids: z.array(z.string().min(1)).readonly(),
});

export const deleteBins = defineCommand({
  type: 'bin.deleteBatch',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.batchDeleted',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binDeleteBatch',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const idSet = new Set(payload.ids.map(toBinId));
    const bins = ctx.aggregate.bins.filter((b) => idSet.has(b.id)).map((b) => ({ ...b }));

    return ok({
      value: undefined,
      event: { payload: { bins } },
    });
  },
  apply: (event, draft) => {
    if (event.payload.bins.length === 0) return;
    const idSet = new Set(event.payload.bins.map((b) => b.id));
    draft.bins = draft.bins.filter((b) => !idSet.has(b.id));
  },
});
