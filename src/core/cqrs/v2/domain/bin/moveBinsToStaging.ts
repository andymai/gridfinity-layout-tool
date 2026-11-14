/**
 * Move several bins to staging in one store update. A loop of
 * `bin.moveToStaging` costs one full-list search and one store write per
 * bin, which grows with the square of the count on a full layer.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { binId as toBinId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  ids: z.array(z.string().min(1)).readonly(),
});

export const moveBinsToStaging = defineCommand({
  type: 'bin.moveToStagingBatch',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.batchMovedToStaging',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const idSet = new Set(payload.ids.map(toBinId));
    const moves = ctx.aggregate.bins
      .filter((b) => idSet.has(b.id) && b.layerId !== STAGING_ID)
      .map((b) => ({ id: b.id, previousLayerId: b.layerId }));

    return ok({
      value: undefined,
      event: { payload: { moves } },
    });
  },
  apply: (event, draft) => {
    if (event.payload.moves.length === 0) return;
    const idSet = new Set(event.payload.moves.map((m) => m.id));
    for (const bin of draft.bins) {
      if (idSet.has(bin.id)) bin.layerId = STAGING_ID;
    }
  },
});
