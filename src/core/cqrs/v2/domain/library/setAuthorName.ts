/**
 * Set the library's default author name. Truncates to NAME_MAX_LENGTH;
 * captures `previousName` for undo.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { defineCommand } from '../../defineCommand';

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
