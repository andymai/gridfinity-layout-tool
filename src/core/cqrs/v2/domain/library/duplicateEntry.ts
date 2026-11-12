/**
 * Duplicate a library entry. Validates the source exists, generates a
 * new LayoutId, and names the copy with the translated "(copy)" suffix.
 * The event carries the full new entry.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import { generateLayoutId } from '@/shared/utils';
import { layoutCopyName } from '@/core/storage';
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
      name: layoutCopyName(source.name),
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
