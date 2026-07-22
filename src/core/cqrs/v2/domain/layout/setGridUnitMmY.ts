/**
 * Set (or clear) the depth-axis (Y) grid pitch for a non-square grid.
 * A number clamps to [1, 200]; `null` clears back to a square grid
 * (`gridUnitMmY === undefined`). Captures `previousMmY` for undo.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import { mm } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ mm: z.number().nullable() });

export const setGridUnitMmY = defineCommand({
  type: 'layout.setGridUnitMmY',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.gridUnitMmYSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetGridUnitMmY',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const prev = ctx.aggregate.gridUnitMmY as number | undefined;
    const previousMmY = prev === undefined ? null : prev;
    const newMm = payload.mm === null ? null : clamp(payload.mm, 1, 200);
    return ok({
      value: undefined,
      event: { payload: { mm: newMm, previousMmY } },
    });
  },
  apply: (event, draft) => {
    draft.gridUnitMmY = event.payload.mm === null ? undefined : mm(event.payload.mm);
  },
});
