import type { Category, CategoryId } from '@/core/types';
import type { Result, LayoutError } from '@/core/result';
import {
  ok,
  err,
  OK,
  isOk,
  layoutCategoryLimit,
  layoutLastEntity,
  layoutInvalidOperation,
} from '@/core/result';
import { generateCategoryId, CONSTRAINTS } from '@/core/constants';
import { requireCategory } from './helpers';
import type { SetLocal, GetState } from './types';

export function createCategoryActions(setLocal: SetLocal, get: GetState) {
  return {
    addCategory: (categoryData: Omit<Category, 'id'>): Result<CategoryId, LayoutError> => {
      const { layout } = get();
      if (layout.categories.length >= CONSTRAINTS.CATEGORIES_MAX) {
        return err(layoutCategoryLimit(layout.categories.length, CONSTRAINTS.CATEGORIES_MAX));
      }

      const id = generateCategoryId();
      setLocal((state) => {
        state.layout.categories.push({ ...categoryData, id });
      });
      return ok(id);
    },

    updateCategory: (id: CategoryId, updates: Partial<Category>): Result<void, LayoutError> => {
      const { layout } = get();
      const found = requireCategory(layout.categories, id, 'updateCategory');
      if (!isOk(found)) return found;

      setLocal((state) => {
        const c = state.layout.categories.find((c) => c.id === id);
        if (c) Object.assign(c, updates);
      });

      return OK;
    },

    deleteCategory: (id: CategoryId): Result<void, LayoutError> => {
      const { layout } = get();

      const binsUsingCategory = layout.bins.filter((b) => b.category === id);
      if (binsUsingCategory.length > 0) {
        return err(
          layoutInvalidOperation(
            'deleteCategory',
            `Category is in use by ${binsUsingCategory.length} bin${binsUsingCategory.length > 1 ? 's' : ''}`
          )
        );
      }

      if (layout.categories.length <= CONSTRAINTS.CATEGORIES_MIN) {
        return err(layoutLastEntity('category'));
      }

      const found = requireCategory(layout.categories, id, 'deleteCategory');
      if (!isOk(found)) return found;

      setLocal((state) => {
        state.layout.categories = state.layout.categories.filter((c) => c.id !== id);
      });

      return OK;
    },
  };
}
