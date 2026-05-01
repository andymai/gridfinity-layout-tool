import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { updateCategory } from './updateCategory';
import { makeLayout, makeCategory } from './_testHelpers';

describe('v2 category.update', () => {
  it('captures previous values for the fields being changed', () => {
    const layout = makeLayout({ categories: [makeCategory('cat_1', 'OldName', '#abcdef')] });
    const result = updateCategory.handle(
      { id: 'cat_1', updates: { name: 'NewName' } },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.previous).toEqual({ name: 'OldName' });
    expect(result.value.event.payload.changes).toEqual({ name: 'NewName' });
  });

  it('errors when the category does not exist', () => {
    const layout = makeLayout();
    const result = updateCategory.handle(
      { id: 'cat_gone', updates: { name: 'X' } },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('apply() round-trip equals native Object.assign', () => {
    const layout = makeLayout();
    const result = updateCategory.handle(
      { id: 'cat_1', updates: { color: '#aaaaaa' } },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      updateCategory.apply(
        { type: 'category.updated', payload: result.value.event.payload },
        draft
      );
    });

    expect(applied.categories[0].color).toBe('#aaaaaa');
  });
});
