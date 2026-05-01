import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { categoryId } from '@/core/types';
import { deleteCategory } from './deleteCategory';
import { makeLayout, makeCategory, makeBin } from './_testHelpers';

describe('v2 category.delete', () => {
  it('rejects when any bin still references the category (precondition, not cascade)', () => {
    const layout = makeLayout({
      categories: [makeCategory('cat_1'), makeCategory('cat_2')],
      bins: [makeBin('bin_a', 'cat_1')],
    });
    const result = deleteCategory.handle({ id: 'cat_1' }, { aggregate: layout });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
    if (result.error.code === 'LAYOUT_INVALID_OPERATION') {
      expect(result.error.reason).toMatch(/in use/);
    }
  });

  it('errors at the category-count minimum', () => {
    const layout = makeLayout(); // single category
    const result = deleteCategory.handle({ id: 'cat_1' }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('errors when the category does not exist', () => {
    const layout = makeLayout({
      categories: [makeCategory('cat_1'), makeCategory('cat_2')],
    });
    const result = deleteCategory.handle({ id: 'cat_gone' }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('apply() removes the category when no bins reference it', () => {
    const layout = makeLayout({
      categories: [makeCategory('cat_1'), makeCategory('cat_2')],
    });
    const result = deleteCategory.handle({ id: 'cat_1' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      deleteCategory.apply(
        { type: 'category.deleted', payload: result.value.event.payload },
        draft
      );
    });

    expect(applied.categories).toHaveLength(1);
    expect(applied.categories[0].id).toBe(categoryId('cat_2'));
  });
});
