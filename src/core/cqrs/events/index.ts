/**
 * Domain Events barrel
 */

export type {
  BinEvent,
  BinAddedEvent,
  BinUpdatedEvent,
  BinDeletedEvent,
  BinsDeletedEvent,
  BinDuplicatedEvent,
  BinMovedToStagingEvent,
  BinMovedFromStagingEvent,
  LayerFilledEvent,
  LayerClearedEvent,
} from './binEvents';

export type {
  LayerEvent,
  LayerAddedEvent,
  LayerUpdatedEvent,
  LayerDeletedEvent,
  LayersReorderedEvent,
} from './layerEvents';

export type {
  CategoryEvent,
  CategoryAddedEvent,
  CategoryUpdatedEvent,
  CategoryDeletedEvent,
} from './categoryEvents';

export type {
  DrawerEvent,
  DrawerUpdatedEvent,
  LayoutNameSetEvent,
  PrintBedSizeSetEvent,
  GridUnitMmSetEvent,
  HeightUnitMmSetEvent,
  BaseplateParamsSetEvent,
} from './drawerEvents';

import type { BinEvent } from './binEvents';
import type { LayerEvent } from './layerEvents';
import type { CategoryEvent } from './categoryEvents';
import type { DrawerEvent } from './drawerEvents';

/** Union of all domain events */
export type DomainEvent = BinEvent | LayerEvent | CategoryEvent | DrawerEvent;

/** All possible event type strings */
export type DomainEventType = DomainEvent['type'];
