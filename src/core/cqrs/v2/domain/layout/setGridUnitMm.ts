/**
 * Set the grid unit in mm. Clamps to the pitch range; with a custom drawer
 * outline active the floor rises so the mm extent keeps containing the shape —
 * the outline is stored in absolute mm, and a smaller pitch would leave it
 * overhanging for the read-side normalizer to clip on the next load.
 * Captures `previousMm` for undo.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import { mm } from '@/core/types';
import { GRID_PITCH_MM_MAX, gridPitchFloors } from '@/shared/utils/drawerOutline';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ mm: z.number() });

export const setGridUnitMm = defineCommand({
  type: 'layout.setGridUnitMm',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.gridUnitMmSet',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const layout = ctx.aggregate;
    const previousMm = layout.gridUnitMm as number;
    const newMm = clamp(payload.mm, gridPitchFloors(layout).x, GRID_PITCH_MM_MAX);
    return ok({
      value: undefined,
      event: { payload: { mm: newMm, previousMm } },
    });
  },
  apply: (event, draft) => {
    draft.gridUnitMm = mm(event.payload.mm);
  },
});
