/**
 * category.update — v2 (defineCommand) shape.
 *
 * Validates the category exists, captures previous values for the fields
 * being updated, and emits `category.updated`. apply() does Object.assign
 * over the matching draft entry.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import type { Category, CategoryId } from '@/core/types';
import { categoryId as toCategoryId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const updatesSchema = z
  .object({
    name: z.string().min(1).max(CONSTRAINTS.LABEL_MAX_LENGTH),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .partial();

const payloadSchema = z.object({
  id: z.string().min(1),
  updates: updatesSchema,
});

function capturePrevious(category: Category, changes: Partial<Category>): Partial<Category> {
  const previous: Partial<Category> = {};
  for (const key of Object.keys(changes) as Array<keyof Category>) {
    (previous as Record<string, unknown>)[key as string] = category[key];
  }
  return previous;
}

export const updateCategory = defineCommand({
  type: 'category.update',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'category.updated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.categoryUpdate',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: undefined;
      event: {
        payload: { id: CategoryId; changes: Partial<Category>; previous: Partial<Category> };
      };
    },
    LayoutError
  > => {
    const id = toCategoryId(payload.id);
    const existing = ctx.aggregate.categories.find((c) => c.id === id);
    if (!existing) {
      return err(layoutInvalidOperation('updateCategory', `Category ${id} not found`));
    }

    const changes: Partial<Category> = {};
    if (payload.updates.name !== undefined) changes.name = payload.updates.name;
    if (payload.updates.color !== undefined) changes.color = payload.updates.color;

    return ok({
      value: undefined,
      event: { payload: { id, changes, previous: capturePrevious(existing, changes) } },
    });
  },
  apply: (event, draft) => {
    const category = draft.categories.find((c) => c.id === event.payload.id);
    if (category) Object.assign(category, event.payload.changes);
  },
});
