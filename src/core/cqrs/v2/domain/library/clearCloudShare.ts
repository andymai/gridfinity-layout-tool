/**
 * Clear cloudShare metadata from a library entry. The
 * `cqrs/subscribers/libraryPersistence` subscriber listens for
 * `library.cloudShareCleared` and persists the library snapshot.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { layoutId as toLayoutId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ layoutId: z.string().min(1) });

export const clearCloudShare = defineCommand({
  type: 'library.clearCloudShare',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.cloudShareCleared',
  schemaVersion: 1,
  descriptionKey: 'undo.action.libraryClearCloudShare',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (payload) => {
    const layoutId = toLayoutId(payload.layoutId);
    return ok({
      value: undefined,
      event: { payload: { layoutId } },
    });
  },
  apply: (event, draft) => {
    const entry = draft.entries.find((e) => e.id === event.payload.layoutId);
    if (entry) entry.cloudShare = undefined;
  },
});
