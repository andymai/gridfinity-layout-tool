/**
 * Set print-bed dimensions. Clamps both `size` and optional `depth` to the
 * configured print-bed bounds (CONSTRAINTS.PRINT_BED_MM_MIN/MAX); captures
 * `previousSize` and `previousDepth` for undo.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import { CONSTRAINTS } from '@/core/constants';
import { mm } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  size: z.number(),
  depth: z.number().optional(),
});

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
    const size = clamp(payload.size, CONSTRAINTS.PRINT_BED_MM_MIN, CONSTRAINTS.PRINT_BED_MM_MAX);
    const depth =
      payload.depth !== undefined
        ? clamp(payload.depth, CONSTRAINTS.PRINT_BED_MM_MIN, CONSTRAINTS.PRINT_BED_MM_MAX)
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
