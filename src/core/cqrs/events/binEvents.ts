/**
 * Bin Domain Events
 *
 * Events are past-tense facts that describe what happened.
 * They carry enough data to reconstruct the change in both directions.
 */

import type { BaseDomainEvent } from '../types';
import type { Bin, BinId, LayerId } from '@/core/types';

export type BinAddedEvent = BaseDomainEvent<'bin.added', { readonly bin: Bin }>;

export type BinUpdatedEvent = BaseDomainEvent<
  'bin.updated',
  {
    readonly id: BinId;
    readonly changes: Partial<Bin>;
    readonly previous: Partial<Bin>;
  }
>;

export type BinDeletedEvent = BaseDomainEvent<'bin.deleted', { readonly bin: Bin }>;

export type BinsDeletedEvent = BaseDomainEvent<
  'bin.batchDeleted',
  { readonly bins: ReadonlyArray<Bin> }
>;

export type BinDuplicatedEvent = BaseDomainEvent<
  'bin.duplicated',
  { readonly sourceId: BinId; readonly newBin: Bin }
>;

export type BinMovedToStagingEvent = BaseDomainEvent<
  'bin.movedToStaging',
  { readonly id: BinId; readonly previousLayerId: LayerId }
>;

export type BinMovedFromStagingEvent = BaseDomainEvent<
  'bin.movedFromStaging',
  {
    readonly id: BinId;
    readonly layerId: LayerId;
    readonly x: number;
    readonly y: number;
  }
>;

export type LayerFilledEvent = BaseDomainEvent<
  'bin.layerFilled',
  {
    readonly layerId: LayerId;
    readonly binsCreated: number;
    readonly bins: ReadonlyArray<Bin>;
  }
>;

export type LayerClearedEvent = BaseDomainEvent<
  'bin.layerCleared',
  {
    readonly layerId: LayerId;
    readonly binsRemoved: number;
    readonly bins: ReadonlyArray<Bin>;
  }
>;

export type BinEvent =
  | BinAddedEvent
  | BinUpdatedEvent
  | BinDeletedEvent
  | BinsDeletedEvent
  | BinDuplicatedEvent
  | BinMovedToStagingEvent
  | BinMovedFromStagingEvent
  | LayerFilledEvent
  | LayerClearedEvent;
