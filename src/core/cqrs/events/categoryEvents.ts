/**
 * Category Domain Events
 */

import type { BaseDomainEvent } from '../types';
import type { Category, CategoryId } from '@/core/types';

export type CategoryAddedEvent = BaseDomainEvent<'category.added', { readonly category: Category }>;

export type CategoryUpdatedEvent = BaseDomainEvent<
  'category.updated',
  {
    readonly id: CategoryId;
    readonly changes: Partial<Category>;
    readonly previous: Partial<Category>;
  }
>;

export type CategoryDeletedEvent = BaseDomainEvent<
  'category.deleted',
  { readonly category: Category }
>;

export type CategoryEvent = CategoryAddedEvent | CategoryUpdatedEvent | CategoryDeletedEvent;
