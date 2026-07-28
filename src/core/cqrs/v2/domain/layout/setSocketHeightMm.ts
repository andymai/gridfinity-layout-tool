/** Set the base-profile (socket) depth in mm. Clamps to [MIN, MAX]; captures
 * `previousMm` for undo. */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import { mm } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ mm: z.number() });

export const setSocketHeightMm = defineCommand({
  type: 'layout.setSocketHeightMm',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.socketHeightMmSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetSocketHeightMm',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousMm =
      (ctx.aggregate.socketHeightMm as number | undefined) ?? CONSTRAINTS.SOCKET_HEIGHT_MM_DEFAULT;
    const newMm = clamp(
      payload.mm,
      CONSTRAINTS.SOCKET_HEIGHT_MM_MIN,
      CONSTRAINTS.SOCKET_HEIGHT_MM_MAX
    );
    return ok({
      value: undefined,
      event: { payload: { mm: newMm, previousMm } },
    });
  },
  apply: (event, draft) => {
    draft.socketHeightMm = mm(event.payload.mm);
  },
});
