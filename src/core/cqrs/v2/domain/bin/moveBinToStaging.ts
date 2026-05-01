/**
 * Move a bin to staging. The bin stays in the layout; only `layerId`
 * changes to STAGING_ID. Captures `previousLayerId` so undo restores
 * the prior placement.
 */

import { z } from 'zod';
import { ok, err } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { layoutInvalidOperation } from '@/core/result';
import { binId as toBinId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ id: z.string().min(1) });

export const moveBinToStaging = defineCommand({
  type: 'bin.moveToStaging',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.movedToStaging',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binMoveToStaging',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const id = toBinId(payload.id);
    const bin = ctx.aggregate.bins.find((b) => b.id === id);
    if (!bin) {
      return err(layoutInvalidOperation('moveBinToStaging', `Bin ${id} not found`));
    }
    return ok({
      value: undefined,
      event: { payload: { id, previousLayerId: bin.layerId } },
    });
  },
  apply: (event, draft) => {
    const bin = draft.bins.find((b) => b.id === event.payload.id);
    if (bin) bin.layerId = STAGING_ID;
  },
});
