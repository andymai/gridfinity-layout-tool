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

/**
 * `height` was added in the v2 migration so apply() can reproduce the
 * full mutation without consulting current layout state. v1-era persisted
 * events have no height — the optional shape keeps them readable; the
 * v2 apply() falls back to leaving height untouched when missing.
 */
export type BinMovedFromStagingEvent = BaseDomainEvent<
  'bin.movedFromStaging',
  {
    readonly id: BinId;
    readonly layerId: LayerId;
    readonly x: number;
    readonly y: number;
    readonly height?: number;
  }
>;

/**
 * `fillType`, `width`, `depth` were added in the v2 migration so the fill
 * analytics subscriber can derive what the v1 `_fillMeta` field used to
 * carry. v1-era persisted events have no `fillType` — the subscriber
 * silently ignores those (re-emitting them would distort current-period
 * metrics).
 */
export type LayerFilledEvent = BaseDomainEvent<
  'bin.layerFilled',
  {
    readonly layerId: LayerId;
    readonly binsCreated: number;
    readonly bins: ReadonlyArray<Bin>;
    readonly fillType?: 'uniform' | 'gaps';
    readonly width?: number;
    readonly depth?: number;
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
