/**
 * Add a category. Validates the per-layout count limit; the event
 * payload carries the full Category so apply() is a deterministic push.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutCategoryLimit } from '@/core/result';
import { generateCategoryId, CONSTRAINTS } from '@/core/constants';
import type { Category, CategoryId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  name: z.string().min(1).max(CONSTRAINTS.LABEL_MAX_LENGTH),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const addCategory = defineCommand({
  type: 'category.add',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'category.added',
  schemaVersion: 1,
  descriptionKey: 'undo.action.categoryAdd',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<{ value: CategoryId; event: { payload: { category: Category } } }, LayoutError> => {
    const layout = ctx.aggregate;
    if (layout.categories.length >= CONSTRAINTS.CATEGORIES_MAX) {
      return err(layoutCategoryLimit(layout.categories.length, CONSTRAINTS.CATEGORIES_MAX));
    }

    const category: Category = { ...payload, id: generateCategoryId() };
    return ok({ value: category.id, event: { payload: { category } } });
  },
  apply: (event, draft) => {
    draft.categories.push(event.payload.category);
  },
});
