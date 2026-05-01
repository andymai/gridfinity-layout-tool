/**
 * library.switchActive — v2 (defineCommand) shape, library aggregate.
 *
 * Captures previousLayoutId so undo replay can restore the prior active
 * selection. v1 didn't validate that the target id exists in entries —
 * v2 keeps that lenient behavior (the layout-activation hook handles
 * the lookup downstream).
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { layoutId as toLayoutId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ layoutId: z.string().min(1) });

export const switchActive = defineCommand({
  type: 'library.switchActive',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.activeLayoutSwitched',
  schemaVersion: 1,
  descriptionKey: 'undo.action.librarySwitchActive',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const newLayoutId = toLayoutId(payload.layoutId);
    const previousLayoutId = ctx.aggregate.activeLayoutId;
    return ok({
      value: undefined,
      event: { payload: { previousLayoutId, newLayoutId } },
    });
  },
  apply: (event, draft) => {
    draft.activeLayoutId = event.payload.newLayoutId;
  },
});
