import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { addCategory } from './addCategory';
import { makeLayout, makeCategory } from './_testHelpers';

describe('v2 category.add', () => {
  it('emits an event with a generated category', () => {
    const layout = makeLayout();
    const result = addCategory.handle({ name: 'New', color: '#ff0000' }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.category.name).toBe('New');
    expect(result.value.event.payload.category.color).toBe('#ff0000');
    expect(result.value.event.payload.category.id).toBe(result.value.value);
  });

  it('errors when the category-count limit is reached', () => {
    const categories = Array.from({ length: CONSTRAINTS.CATEGORIES_MAX }, (_, i) =>
      makeCategory(`cat_${String(i)}`)
    );
    const layout = makeLayout({ categories });
    const result = addCategory.handle(
      { name: 'Overflow', color: '#000000' },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('apply() pushes the new category onto the draft', () => {
    const layout = makeLayout();
    const result = addCategory.handle({ name: 'New', color: '#00ff00' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      addCategory.apply({ type: 'category.added', payload: result.value.event.payload }, draft);
    });

    expect(applied.categories).toHaveLength(2);
    expect(applied.categories[1]).toEqual(result.value.event.payload.category);
  });
});
