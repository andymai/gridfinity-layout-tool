/** Set the layout-scoped magnet anchor. Captures `previousAnchor` for undo. */

import { z } from 'zod';
import { ok } from '@/core/result';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ anchor: z.enum(['edge', 'center']) });

export const setMagnetAnchor = defineCommand({
  type: 'layout.setMagnetAnchor',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.magnetAnchorSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetMagnetAnchor',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousAnchor = ctx.aggregate.magnetAnchor ?? 'edge';
    return ok({
      value: undefined,
      event: { payload: { anchor: payload.anchor, previousAnchor } },
    });
  },
  apply: (event, draft) => {
    draft.magnetAnchor = event.payload.anchor;
  },
});
