/**
 * Layer Domain Events
 */

import type { BaseDomainEvent } from '../types';
import type { BinId, Layer, LayerId } from '@/core/types';

export type LayerAddedEvent = BaseDomainEvent<'layer.added', { readonly layer: Layer }>;

export type LayerUpdatedEvent = BaseDomainEvent<
  'layer.updated',
  {
    readonly id: LayerId;
    readonly changes: Partial<Layer>;
    readonly previous: Partial<Layer>;
  }
>;

// `displacedBinIds` records the exact set of bins that cascaded to
// staging when the layer was deleted. Optional only for back-compat
// with persisted events that predate the field — projection/replay.ts
// falls back to the "all bins on layer" heuristic in that case.
export type LayerDeletedEvent = BaseDomainEvent<
  'layer.deleted',
  {
    readonly layer: Layer;
    readonly deletedBinCount: number;
    readonly displacedBinIds?: ReadonlyArray<BinId>;
  }
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
