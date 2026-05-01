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

/**
 * `displacedBinIds` was added in the v2 migration so apply() can target
 * the exact set of bins that moved to staging. v1-era persisted events
 * have no `displacedBinIds` — replay against those falls back to the
 * "all bins on layer" heuristic in projection/replay.ts (lossy if the
 * layout has diverged since the event was emitted, but no worse than v1).
 */
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
