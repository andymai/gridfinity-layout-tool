/**
 * CQRS + Event Sourcing Infrastructure
 *
 * Provides a command/event system that wraps existing Zustand store mutations.
 * Commands represent user intent, events represent facts that happened.
 * The event store persists events to IndexedDB for audit trail and replay.
 *
 * @example
 * ```ts
 * import { commandBus, createCommand, eventBus } from '@/core/cqrs';
 *
 * // Dispatch a command
 * const result = commandBus.dispatch(createCommand('bin.add', { ... }));
 *
 * // Subscribe to events
 * eventBus.subscribe('bin.added', (event) => {
 *   console.debug('Bin added:', event.payload.bin.id);
 * });
 * ```
 */

export type {
  CommandId,
  EventId,
  CorrelationId,
  CommandSource,
  CommandMeta,
  EventMeta,
  BaseCommand,
  BaseDomainEvent,
  CommandSuccess,
  CommandResult,
  CommandHandler,
  Middleware,
  UnsubscribeFn,
} from './types';

export { commandId, eventId, correlationId } from './types';

export type { Command, CommandType } from './commands';
export { createCommand } from './commands';
// Re-export individual command types for type-narrowing
export type {
  AddBinCommand,
  UpdateBinCommand,
  DeleteBinCommand,
  DeleteBinsCommand,
  DuplicateBinCommand,
  MoveBinToStagingCommand,
  MoveBinFromStagingCommand,
  FillLayerCommand,
  ClearLayerCommand,
  BinCommand,
  AddLayerCommand,
  UpdateLayerCommand,
  DeleteLayerCommand,
  ReorderLayersCommand,
  LayerCommand,
  AddCategoryCommand,
  UpdateCategoryCommand,
  DeleteCategoryCommand,
  CategoryCommand,
  UpdateDrawerCommand,
  SetNameCommand,
  SetPrintBedSizeCommand,
  SetGridUnitMmCommand,
  SetHeightUnitMmCommand,
  SetBaseplateParamsCommand,
  DrawerCommand,
} from './commands';

export type { DomainEvent, DomainEventType } from './events';
export type {
  BinAddedEvent,
  BinUpdatedEvent,
  BinDeletedEvent,
  BinsDeletedEvent,
  BinDuplicatedEvent,
  BinMovedToStagingEvent,
  BinMovedFromStagingEvent,
  LayerFilledEvent,
  LayerClearedEvent,
  BinEvent,
  LayerAddedEvent,
  LayerUpdatedEvent,
  LayerDeletedEvent,
  LayersReorderedEvent,
  LayerEvent,
  CategoryAddedEvent,
  CategoryUpdatedEvent,
  CategoryDeletedEvent,
  CategoryEvent,
  DrawerUpdatedEvent,
  LayoutNameSetEvent,
  PrintBedSizeSetEvent,
  GridUnitMmSetEvent,
  HeightUnitMmSetEvent,
  BaseplateParamsSetEvent,
  DrawerEvent,
} from './events';

export { commandBus, createCommandBus } from './bus/commandBus';
export type { CommandBus } from './bus/commandBus';
export { eventBus, createEventBus } from './bus/eventBus';
export type { EventBus } from './bus/eventBus';

export { eventStore, connectEventStoreToBus, resetEventStoreDb } from './store/eventStore';
export type { EventStore, EventStoreQuery } from './store/eventStore';

export { getPendingRetryCount, clearRetryQueue } from './store/retryQueue';

export { undoCaptureMiddleware, _resetUndoCaptureState } from './middleware/undoCapture';
export { loggingMiddleware } from './middleware/logging';
export { analyticsMiddleware } from './middleware/analytics';
/** @deprecated Use `getDefaultPipeline()` instead */
export { defaultPipeline, getDefaultPipeline } from './middleware';

export { validationMiddleware, COMMAND_SCHEMAS, getCommandSchema } from './validation';

export { createCqrsMutations } from './integration/mutationsAdapter';

export { applyEvent, replayEvents, replayFromStore } from './projection/replay';

export { connectSelectionPruning } from './subscribers';
