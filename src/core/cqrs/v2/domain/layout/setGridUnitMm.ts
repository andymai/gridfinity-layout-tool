/**
 * layout.setGridUnitMm — v2 (defineCommand) shape.
 * Clamps to [1, 200] mm. Captures previousMm for undo replay.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import { mm } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ mm: z.number() });

export const setGridUnitMm = defineCommand({
  type: 'layout.setGridUnitMm',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.gridUnitMmSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetGridUnitMm',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousMm = ctx.aggregate.gridUnitMm as number;
    const newMm = clamp(payload.mm, 1, 200);
    return ok({
      value: undefined,
      event: { payload: { mm: newMm, previousMm } },
    });
  },
  apply: (event, draft) => {
    draft.gridUnitMm = mm(event.payload.mm);
  },
});
