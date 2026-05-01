/**
 * layout.setHeightUnitMm — v2 (defineCommand) shape.
 * Clamps to [1, 50] mm. Captures previousMm for undo replay.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import { mm } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ mm: z.number() });

export const setHeightUnitMm = defineCommand({
  type: 'layout.setHeightUnitMm',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.heightUnitMmSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetHeightUnitMm',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousMm = ctx.aggregate.heightUnitMm as number;
    const newMm = clamp(payload.mm, 1, 50);
    return ok({
      value: undefined,
      event: { payload: { mm: newMm, previousMm } },
    });
  },
  apply: (event, draft) => {
    draft.heightUnitMm = mm(event.payload.mm);
  },
});
