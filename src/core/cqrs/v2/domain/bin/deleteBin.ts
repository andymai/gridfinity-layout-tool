/**
 * bin.delete — v2 (defineCommand) shape.
 *
 * Capture the bin in the event payload before removing it. Replay-complete:
 * `apply()` filters the bin from the draft, but the full bin lives in the
 * event for undo (and as the audit-log record of what was deleted).
 */

import { z } from 'zod';
import { ok, err } from '@/core/result';
import { layoutInvalidOperation } from '@/core/result';
import { binId as toBinId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ id: z.string().min(1) });

export const deleteBin = defineCommand({
  type: 'bin.delete',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.deleted',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binDelete',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const id = toBinId(payload.id);
    const bin = ctx.aggregate.bins.find((b) => b.id === id);
    if (!bin) {
      return err(layoutInvalidOperation('deleteBin', `Bin ${id} not found`));
    }
    return ok({
      value: undefined,
      event: { payload: { bin: { ...bin } } },
    });
  },
  apply: (event, draft) => {
    draft.bins = draft.bins.filter((b) => b.id !== event.payload.bin.id);
  },
});
