/**
 * bin.fillGaps — v2 (defineCommand) shape.
 *
 * Sibling to fillLayer. Same shape: planning runs in handle() against the
 * frozen layout snapshot; the resulting bins are encoded in the event
 * payload with `fillType: 'gaps'` so the analytics subscriber can
 * distinguish uniform vs gap-fill operations.
 *
 * Returns `result.addedCount` (matching v1's return). Today this equals
 * `bins.length`, but the underlying helper distinguishes the two for
 * forward compatibility — keep the v1 return shape so callers that
 * already destructure `addedCount` aren't broken if the helper diverges.
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
  halfBinMode: z.boolean().optional(),
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
      payload.halfBinMode ?? false
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
