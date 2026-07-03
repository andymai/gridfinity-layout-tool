/**
 * Set baseplate params. handle() clamps padding (≥ 0), magnet diameter
 * ([0.5, 20] mm), magnet depth ([0.5, 10] mm), and optional baseplate
 * grid dims ([0.5, 50]). The normalized object goes into the event
 * alongside `previousParams` for undo.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { clamp } from '@/shared/utils/validation';
import type { StoredBaseplateParams, GridUnits, Mm } from '@/core/types';
import { defineCommand } from '../../defineCommand';

// StoredBaseplateParams has many fields, most optional; the schema is permissive
// (passes shape through). Validation focuses on the required boolean +
// numeric fields v1 always supplies.
const payloadSchema = z.object({
  params: z.object({
    magnetHoles: z.boolean(),
    magnetDiameter: z.number(),
    magnetDepth: z.number(),
    paddingLeft: z.number(),
    paddingRight: z.number(),
    paddingFront: z.number(),
    paddingBack: z.number(),
    paddingAnchor: z
      .enum(['tl', 'tc', 'tr', 'ml', 'c', 'mr', 'bl', 'bc', 'br', 'custom'])
      .optional(),
    connectorNubs: z.boolean().optional(),
    connectorStyle: z.enum(['dovetail', 'dovetailKey']).optional(),
    lightweight: z.boolean().optional(),
    syncWithLayout: z.boolean().optional(),
    baseplateWidth: z.number().optional(),
    baseplateDepth: z.number().optional(),
    invertDovetails: z.boolean().optional(),
    fractionalEdgeX: z.enum(['start', 'end']).optional(),
    fractionalEdgeY: z.enum(['start', 'end']).optional(),
    cornerRadius: z.number().optional(),
    cornerRadii: z
      .object({
        tl: z.number(),
        tr: z.number(),
        bl: z.number(),
        br: z.number(),
      })
      .optional(),
  }),
});

export const setBaseplateParams = defineCommand({
  type: 'layout.setBaseplateParams',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.baseplateParamsSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetBaseplateParams',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousParams = ctx.aggregate.baseplateParams
      ? { ...ctx.aggregate.baseplateParams }
      : undefined;

    const p = payload.params;
    const params: StoredBaseplateParams = {
      ...p,
      paddingLeft: Math.max(0, p.paddingLeft) as Mm,
      paddingRight: Math.max(0, p.paddingRight) as Mm,
      paddingFront: Math.max(0, p.paddingFront) as Mm,
      paddingBack: Math.max(0, p.paddingBack) as Mm,
      magnetDiameter: clamp(p.magnetDiameter, 0.5, 20) as Mm,
      magnetDepth: clamp(p.magnetDepth, 0.5, 10) as Mm,
      ...(p.baseplateWidth !== undefined
        ? { baseplateWidth: clamp(p.baseplateWidth, 0.5, 50) as GridUnits }
        : {}),
      ...(p.baseplateDepth !== undefined
        ? { baseplateDepth: clamp(p.baseplateDepth, 0.5, 50) as GridUnits }
        : {}),
    } as StoredBaseplateParams;

    return ok({
      value: undefined,
      event: { payload: { params, previousParams } },
    });
  },
  apply: (event, draft) => {
    draft.baseplateParams = event.payload.params;
  },
});
