/**
 * layout.setName — v2 (defineCommand) shape.
 *
 * Truncates to NAME_MAX_LENGTH (matches v1 behavior). Captures previousName
 * for undo replay.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  name: z.string(),
});

export const setName = defineCommand({
  type: 'layout.setName',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.nameSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetName',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousName = ctx.aggregate.name;
    const name = payload.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
    return ok({
      value: undefined,
      event: { payload: { name, previousName } },
    });
  },
  apply: (event, draft) => {
    draft.name = event.payload.name;
  },
});
