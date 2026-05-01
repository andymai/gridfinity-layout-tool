/**
 * Duplicate a library entry. Validates the source exists, generates a
 * new LayoutId, suffixes the name with " (copy)" (truncated to
 * NAME_MAX_LENGTH). The event carries the full new entry.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { generateLayoutId } from '@/shared/utils';
import { layoutId as toLayoutId } from '@/core/types';
import type { LayoutEntry, LayoutId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ sourceLayoutId: z.string().min(1) });

export const duplicateEntry = defineCommand({
  type: 'library.duplicateEntry',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.entryDuplicated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.libraryDuplicateEntry',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: LayoutId;
      event: {
        payload: { sourceLayoutId: LayoutId; newLayoutId: LayoutId; entry: LayoutEntry };
      };
    },
    LayoutError
  > => {
    const sourceLayoutId = toLayoutId(payload.sourceLayoutId);
    const source = ctx.aggregate.entries.find((e) => e.id === sourceLayoutId);
    if (!source) {
      return err(
        layoutInvalidOperation(
          'library.duplicateEntry',
          `Source layout ${sourceLayoutId} not found`
        )
      );
    }

    const newLayoutId = generateLayoutId();
    const now = Date.now();
    const entry: LayoutEntry = {
      id: newLayoutId,
      name: `${source.name} (copy)`.slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
      createdAt: now,
      modifiedAt: now,
      author: ctx.aggregate.settings.authorName,
      preview: { ...source.preview },
    };

    return ok({
      value: newLayoutId,
      event: { payload: { sourceLayoutId, newLayoutId, entry } },
    });
  },
  apply: (event, draft) => {
    draft.entries.push(event.payload.entry);
  },
});
