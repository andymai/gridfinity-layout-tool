import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { CONSTRAINTS } from '@/core/constants';
import { categoryId } from '@/core/types';
import { isOk, isErr } from '@/core/result';
import { resetAllStores, expectOk } from '@/test/testUtils';

describe('categoryActions', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('addCategory', () => {
    it('adds a category and returns the new id', () => {
      const initialCount = useLayoutStore.getState().layout.categories.length;
      const { addCategory } = useLayoutStore.getState();
      const result = addCategory({ name: 'Tools', color: '#ff0000' });
      expect(isOk(result)).toBe(true);
      expect(useLayoutStore.getState().layout.categories).toHaveLength(initialCount + 1);
    });

    it('returns error when at max categories', () => {
      // Fill up to max
      const cats = Array.from({ length: CONSTRAINTS.CATEGORIES_MAX }, (_, i) => ({
        id: categoryId(`cat-${i}`),
        name: `Cat ${i}`,
        color: '#000',
      }));
      useLayoutStore.setState((s) => ({
        layout: { ...s.layout, categories: cats },
      }));

      const result = useLayoutStore.getState().addCategory({ name: 'Over limit', color: '#fff' });
      expect(isErr(result)).toBe(true);
    });
  });

  describe('updateCategory', () => {
    it('updates category name', () => {
      const { layout, updateCategory } = useLayoutStore.getState();
      const catId = layout.categories[0].id;
      const result = updateCategory(catId, { name: 'Renamed' });
      expectOk(result);
      expect(useLayoutStore.getState().layout.categories[0].name).toBe('Renamed');
    });

    it('updates category color', () => {
      const { layout, updateCategory } = useLayoutStore.getState();
      const catId = layout.categories[0].id;
      updateCategory(catId, { color: '#00ff00' });
      expect(useLayoutStore.getState().layout.categories[0].color).toBe('#00ff00');
    });

    it('returns error for non-existent category', () => {
      const result = useLayoutStore
        .getState()
        .updateCategory(categoryId('nonexistent'), { name: 'X' });
      expect(isErr(result)).toBe(true);
    });
  });

  describe('deleteCategory', () => {
    it('deletes a category when not in use and not the last one', () => {
      const initialCount = useLayoutStore.getState().layout.categories.length;
      const { addCategory } = useLayoutStore.getState();
      const result = addCategory({ name: 'Extra', color: '#00f' });
      const newId = expectOk(result);

      const deleteResult = useLayoutStore.getState().deleteCategory(newId);
      expectOk(deleteResult);
      expect(useLayoutStore.getState().layout.categories).toHaveLength(initialCount);
    });

    it('returns error when deleting last category', () => {
      // Reduce to exactly 1 category
      const cats = useLayoutStore.getState().layout.categories;
      for (let i = cats.length - 1; i > 0; i--) {
        useLayoutStore.getState().deleteCategory(cats[i].id);
      }
      expect(useLayoutStore.getState().layout.categories).toHaveLength(1);

      const result = useLayoutStore
        .getState()
        .deleteCategory(useLayoutStore.getState().layout.categories[0].id);
      expect(isErr(result)).toBe(true);
    });

    it('returns error when category is in use by bins', () => {
      const { addBin, addCategory, layout } = useLayoutStore.getState();
      const secondCatResult = addCategory({ name: 'InUse', color: '#f00' });
      const secondCatId = expectOk(secondCatResult);

      addBin({
        layerId: layout.layers[0].id,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: secondCatId,
        label: '',
        notes: '',
      });

      const result = useLayoutStore.getState().deleteCategory(secondCatId);
      expect(isErr(result)).toBe(true);
    });

    it('returns error for non-existent category', () => {
      // Add a second category so we're not hitting the "last entity" check
      useLayoutStore.getState().addCategory({ name: 'Extra', color: '#0f0' });
      const result = useLayoutStore.getState().deleteCategory(categoryId('ghost'));
      expect(isErr(result)).toBe(true);
    });
  });
});
