/** Set the layout-scoped low-profile base. Captures `previousEnabled` for undo. */

import { z } from 'zod';
import { ok } from '@/core/result';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ enabled: z.boolean() });

export const setLowProfileBase = defineCommand({
  type: 'layout.setLowProfileBase',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.lowProfileBaseSet',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousEnabled = ctx.aggregate.lowProfileBase === true;
    return ok({
      value: undefined,
      event: { payload: { enabled: payload.enabled, previousEnabled } },
    });
  },
  apply: (event, draft) => {
    // Absent rather than `false`, so a standard layout's stored shape and
    // share fingerprint stay what they were before the setting existed.
    if (event.payload.enabled) draft.lowProfileBase = true;
    else delete draft.lowProfileBase;
  },
});
