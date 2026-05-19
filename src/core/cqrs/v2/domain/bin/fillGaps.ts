/**
 * Fill empty gaps in a layer. Sibling to fillLayer; emits the same
 * `bin.layerFilled` event but with `fillType: 'gaps'` so the analytics
 * subscriber can distinguish the two.
 *
 * Returns `result.addedCount`. Today this equals `bins.length`, but the
 * underlying helper distinguishes them for forward compatibility — keep
 * this shape so callers that already destructure `addedCount` aren't
 * broken if the helper diverges.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { calcMaxGridUnits } from '@/core/constants';
import { fillGaps as runFillGaps } from '@/shared/utils/fill';
import { layerId as toLayerId, categoryId as toCategoryId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  layerId: z.string().min(1),
  categoryId: z.string().min(1),
  halfGridMode: z.boolean().optional(),
});

export const fillGaps = defineCommand({
  type: 'bin.fillGaps',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.layerFilled',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layerFillGaps',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const layerId = toLayerId(payload.layerId);
    const categoryId = toCategoryId(payload.categoryId);

    const maxGrid = calcMaxGridUnits(
      ctx.aggregate.printBedSize,
      ctx.aggregate.gridUnitMm,
      ctx.aggregate.printBedDepth
    );
    const result = runFillGaps(
      ctx.aggregate,
      layerId,
      categoryId,
      Math.min(maxGrid.width, maxGrid.depth),
      payload.halfGridMode ?? false
    );

    return ok({
      value: result.addedCount,
      event: {
        payload: {
          layerId,
          binsCreated: result.bins.length,
          bins: result.bins,
          fillType: 'gaps' as const,
        },
      },
    });
  },
  apply: (event, draft) => {
    if (event.payload.bins.length === 0) return;
    draft.bins.push(...event.payload.bins);
  },
});
