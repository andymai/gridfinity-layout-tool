/**
 * library.setAuthorName — v2 (defineCommand) shape, library aggregate.
 *
 * Truncates to NAME_MAX_LENGTH (matches v1 behavior) and captures
 * previousName for undo replay.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { defineCommand } from '../../defineCommand';

// Match the central library.setAuthorName schema (validation/librarySchemas.ts):
// name has min(1).max(NAME_MAX_LENGTH).
const payloadSchema = z.object({
  name: z.string().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH),
});

export const setAuthorName = defineCommand({
  type: 'library.setAuthorName',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.authorNameSet',
  schemaVersion: 1,
  descriptionKey: 'undo.action.librarySetAuthorName',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const previousName = ctx.aggregate.settings.authorName ?? '';
    const name = payload.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
    return ok({
      value: undefined,
      event: { payload: { name, previousName } },
    });
  },
  apply: (event, draft) => {
    draft.settings.authorName = event.payload.name;
  },
});
