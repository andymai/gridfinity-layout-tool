/**
 * library.renameEntry — v2 (defineCommand) shape, library aggregate.
 *
 * Captures previousName for undo replay. Truncates inside handle()
 * even though the central schema enforces a max — keeps event payload
 * identical to what apply() installs.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { layoutId as toLayoutId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  layoutId: z.string().min(1),
  name: z.string().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH),
});

export const renameEntry = defineCommand({
  type: 'library.renameEntry',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.entryRenamed',
  schemaVersion: 1,
  descriptionKey: 'undo.action.libraryRenameEntry',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const layoutId = toLayoutId(payload.layoutId);
    const entry = ctx.aggregate.entries.find((e) => e.id === layoutId);
    const previousName = entry?.name ?? '';
    const name = payload.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
    return ok({
      value: undefined,
      event: { payload: { layoutId, name, previousName } },
    });
  },
  apply: (event, draft) => {
    const entry = draft.entries.find((e) => e.id === event.payload.layoutId);
    if (entry) entry.name = event.payload.name;
  },
});
