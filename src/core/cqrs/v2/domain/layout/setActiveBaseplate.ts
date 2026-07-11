/**
 * Point the layout at a baseplate library design. The caller resolves the
 * design's params (already materialized for this layout) and passes both the
 * pointer id and the materialized params, so apply() sets BOTH
 * `activeBaseplateId` and `baseplateParams`. `handle()` captures the previous
 * pointer + params for undo. `designId === null` = detached inline draft.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  designId: z.string().min(1).nullable(),
  params: z.object({
    magnetHoles: z.boolean(),
    magnetDiameter: z.number(),
    magnetDepth: z.number(),
    paddingLeft: z.number(),
    paddingRight: z.number(),
    paddingFront: z.number(),
    paddingBack: z.number(),
  }),
});

export const setActiveBaseplate = defineCommand({
  type: 'layout.setActiveBaseplate',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layout.activeBaseplateSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layoutSetActiveBaseplate',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousActiveBaseplateId: BaseplateDesignId | null =
      ctx.aggregate.activeBaseplateId ?? null;
    const previousParams = ctx.aggregate.baseplateParams
      ? { ...ctx.aggregate.baseplateParams }
      : undefined;

    const designId: BaseplateDesignId | null =
      payload.designId === null ? null : baseplateDesignId(payload.designId);
    const params = payload.params as StoredBaseplateParams;

    return ok({
      value: undefined,
      event: {
        payload: { designId, params, previousActiveBaseplateId, previousParams },
      },
    });
  },
  apply: (event, draft) => {
    draft.activeBaseplateId = event.payload.designId;
    draft.baseplateParams = event.payload.params;
  },
});
