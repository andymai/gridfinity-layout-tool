/**
 * layout.setPrintBedSize — v2 (defineCommand) shape.
 *
 * Clamps both `size` and optional `depth` to [42, 500] mm. Captures
 * previousSize + previousDepth for undo replay.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import { mm } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  size: z.number(),
  depth: z.number().optional(),
});

const MIN_PRINT_BED_MM = 42;
const MAX_PRINT_BED_MM = 500;

export const setPrintBedSize = defineCommand({
  type: 'layout.setPrintBedSize',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.printBedSizeSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetPrintBedSize',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousSize = ctx.aggregate.printBedSize as number;
    const previousDepth = ctx.aggregate.printBedDepth as number | undefined;
    const size = clamp(payload.size, MIN_PRINT_BED_MM, MAX_PRINT_BED_MM);
    const depth =
      payload.depth !== undefined
        ? clamp(payload.depth, MIN_PRINT_BED_MM, MAX_PRINT_BED_MM)
        : undefined;

    return ok({
      value: undefined,
      event: { payload: { size, previousSize, depth, previousDepth } },
    });
  },
  apply: (event, draft) => {
    draft.printBedSize = mm(event.payload.size);
    draft.printBedDepth = event.payload.depth !== undefined ? mm(event.payload.depth) : undefined;
  },
});
