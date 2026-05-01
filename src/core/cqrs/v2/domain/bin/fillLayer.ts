/**
 * Fill a layer with uniform-sized bins. `fillAllWithSize` runs against
 * the frozen layout snapshot; the resulting bins go into the event
 * payload alongside `fillType: 'uniform'`, `width`, `depth` so apply()
 * is a deterministic push and the fill-analytics subscriber has
 * everything it needs without reading transient store state.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { fillAllWithSize } from '@/shared/utils/fill';
import { layerId as toLayerId, categoryId as toCategoryId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  layerId: z.string().min(1),
  width: z.number().gt(0).max(CONSTRAINTS.GRID_MAX),
  depth: z.number().gt(0).max(CONSTRAINTS.GRID_MAX),
  categoryId: z.string().min(1),
  halfBinMode: z.boolean().optional(),
});

export const fillLayer = defineCommand({
  type: 'bin.fillLayer',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.layerFilled',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layerFill',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const layerId = toLayerId(payload.layerId);
    const categoryId = toCategoryId(payload.categoryId);

    const result = fillAllWithSize(
      ctx.aggregate,
      layerId,
      payload.width,
      payload.depth,
      categoryId,
      payload.halfBinMode ?? false
    );

    return ok({
      value: result.bins.length,
      event: {
        payload: {
          layerId,
          binsCreated: result.bins.length,
          bins: result.bins,
          fillType: 'uniform' as const,
          width: payload.width,
          depth: payload.depth,
        },
      },
    });
  },
  apply: (event, draft) => {
    if (event.payload.bins.length === 0) return;
    draft.bins.push(...event.payload.bins);
  },
});
