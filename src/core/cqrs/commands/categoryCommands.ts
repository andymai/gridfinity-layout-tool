/**
 * Category Domain Commands
 */

import type { BaseCommand } from '../types';
import type { Category, CategoryId } from '@/core/types';

export type AddCategoryCommand = BaseCommand<'category.add', Omit<Category, 'id'>>;

export type UpdateCategoryCommand = BaseCommand<
  'category.update',
  { readonly id: CategoryId; readonly updates: Partial<Category> }
>;

export type DeleteCategoryCommand = BaseCommand<'category.delete', { readonly id: CategoryId }>;

export type CategoryCommand = AddCategoryCommand | UpdateCategoryCommand | DeleteCategoryCommand;
