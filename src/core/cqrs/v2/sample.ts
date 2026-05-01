/**
 * Sample command defs used by `types.test.ts` to drive end-to-end
 * type-inference assertions for `defineCommand` + `createRegistry` +
 * `Mutations<typeof registry>`. Not registered with the live commandBus.
 */

import { z } from 'zod';
import { ok, err } from '@/core/result';
import type { ValidationError, LayoutError } from '@/core/result';
import { validationOutOfBounds, layoutInvalidOperation } from '@/core/result';
import { defineCommand } from './defineCommand';
import { createRegistry } from './createRegistry';

export const sampleAddBin = defineCommand({
  type: 'sample.bin.add',
  aggregate: 'layout',
  aggregateId: () => 'sample-layout',
  payload: z.object({
    layerId: z.string().min(1),
    x: z.number().gte(0),
    y: z.number().gte(0),
  }),
  emitted: 'sample.bin.added',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binAdd',
  middleware: { undoCapture: true, validate: true },
  handle: (payload, _ctx) => {
    if (payload.x > 100) {
      return err<ValidationError>(validationOutOfBounds('out_of_bounds'));
    }
    return ok({
      value: 'bin_123' as const,
      event: { payload: { id: 'bin_123', layerId: payload.layerId, x: payload.x, y: payload.y } },
    });
  },
  apply: (_event, _draft) => {
    // Pure draft mutation — sample only, no real Layout shape coupling
  },
});

export const sampleDeleteBin = defineCommand({
  type: 'sample.bin.delete',
  aggregate: 'layout',
  aggregateId: () => 'sample-layout',
  payload: z.object({ id: z.string().min(1) }),
  emitted: 'sample.bin.deleted',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binDelete',
  handle: (payload, _ctx) => {
    if (!payload.id.startsWith('bin_')) {
      return err<LayoutError>(layoutInvalidOperation('deleteBin', `Bad id ${payload.id}`));
    }
    return ok({ value: undefined, event: { payload: { id: payload.id } } });
  },
  apply: (_event, _draft) => {
    // Pure draft mutation — sample only
  },
});

export const sampleRegistry = createRegistry([sampleAddBin, sampleDeleteBin] as const);
