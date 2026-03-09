/**
 * Layer Domain Events
 */

import type { BaseDomainEvent } from '../types';
import type { Layer, LayerId } from '@/core/types';

export type LayerAddedEvent = BaseDomainEvent<'layer.added', { readonly layer: Layer }>;

export type LayerUpdatedEvent = BaseDomainEvent<
  'layer.updated',
  {
    readonly id: LayerId;
    readonly changes: Partial<Layer>;
    readonly previous: Partial<Layer>;
  }
>;

export type LayerDeletedEvent = BaseDomainEvent<
  'layer.deleted',
  { readonly layer: Layer; readonly deletedBinCount: number }
>;

export type LayersReorderedEvent = BaseDomainEvent<
  'layer.reordered',
  { readonly fromIndex: number; readonly toIndex: number }
>;

export type LayerEvent =
  | LayerAddedEvent
  | LayerUpdatedEvent
  | LayerDeletedEvent
  | LayersReorderedEvent;
