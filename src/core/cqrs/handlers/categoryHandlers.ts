/**
 * Category Command Handlers
 */

import { useLayoutStore } from '@/core/store/layout';
import { ok, err, isErr } from '@/core/result';
import type { CommandResult } from '../types';
import type { AddCategoryCommand, UpdateCategoryCommand, DeleteCategoryCommand } from '../commands';
import type { DomainEvent } from '../events';
import { createEventMeta, capturePrevious } from './shared';

export function handleAddCategory(command: AddCategoryCommand): CommandResult<string, DomainEvent> {
  const store = useLayoutStore.getState();
  const result = store.addCategory(command.payload);
  if (isErr(result)) return err(result.error);

  const categoryId = result.value;
  // Re-read from store — Zustand+Immer creates a new state object after mutation
  const category = useLayoutStore.getState().layout.categories.find((c) => c.id === categoryId);

  return ok({
    value: categoryId,
    events: category
      ? [
          {
            type: 'category.added' as const,
            payload: { category: { ...category } },
            meta: createEventMeta(command.meta, 'category.added'),
          },
        ]
      : [],
  });
}

export function handleUpdateCategory(
  command: UpdateCategoryCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id, updates } = command.payload;

  const existing = store.layout.categories.find((c) => c.id === id);
  if (!existing) {
    const result = store.updateCategory(id, updates);
    if (isErr(result)) return err(result.error);
    return ok({ value: undefined, events: [] });
  }

  const previous = capturePrevious(existing, updates);
  const result = store.updateCategory(id, updates);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: [
      {
        type: 'category.updated' as const,
        payload: { id, changes: updates, previous },
        meta: createEventMeta(command.meta, 'category.updated'),
      },
    ],
  });
}

export function handleDeleteCategory(
  command: DeleteCategoryCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id } = command.payload;

  const category = store.layout.categories.find((c) => c.id === id);

  const result = store.deleteCategory(id);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: category
      ? [
          {
            type: 'category.deleted' as const,
            payload: { category: { ...category } },
            meta: createEventMeta(command.meta, 'category.deleted'),
          },
        ]
      : [],
  });
}

export const categoryHandlers = {
  'category.add': handleAddCategory,
  'category.update': handleUpdateCategory,
  'category.delete': handleDeleteCategory,
} as const;
