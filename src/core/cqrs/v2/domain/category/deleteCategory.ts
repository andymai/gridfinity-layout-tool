/**
 * Delete a category. Precondition enforcement, NOT a cascade — handle()
 * rejects when any bin references the category. Validation order is
 * deliberate (in-use → min-count → exists) so the first-failure error
 * matches what users have been seeing for years; reordering would break
 * tests that assert specific failure types.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutLastEntity, layoutInvalidOperation } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import type { Category } from '@/core/types';
import { categoryId as toCategoryId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ id: z.string().min(1) });

export const deleteCategory = defineCommand({
  type: 'category.delete',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'category.deleted',
  schemaVersion: 1,
  descriptionKey: 'undo.action.categoryDelete',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<{ value: undefined; event: { payload: { category: Category } } }, LayoutError> => {
    const id = toCategoryId(payload.id);
    const layout = ctx.aggregate;

    const inUse = layout.bins.filter((b) => b.category === id);
    if (inUse.length > 0) {
      return err(
        layoutInvalidOperation(
          'deleteCategory',
          `Category is in use by ${String(inUse.length)} bin${inUse.length > 1 ? 's' : ''}`
        )
      );
    }

    if (layout.categories.length <= CONSTRAINTS.CATEGORIES_MIN) {
      return err(layoutLastEntity('category'));
    }

    const category = layout.categories.find((c) => c.id === id);
    if (!category) {
      return err(layoutInvalidOperation('deleteCategory', `Category ${id} not found`));
    }

    return ok({
      value: undefined,
      event: { payload: { category: { ...category } } },
    });
  },
  apply: (event, draft) => {
    draft.categories = draft.categories.filter((c) => c.id !== event.payload.category.id);
  },
});
