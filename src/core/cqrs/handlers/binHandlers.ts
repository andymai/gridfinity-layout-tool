/**
 * Bin Command Handlers
 *
 * Each handler calls the existing layout store mutation and produces
 * domain events that describe what happened. The store remains the
 * source of truth — handlers are thin wrappers that add event production.
 */

import { useLayoutStore } from '@/core/store/layout';
import { ok, err, isErr } from '@/core/result';
import type { CommandResult } from '../types';
import type {
  AddBinCommand,
  UpdateBinCommand,
  DeleteBinCommand,
  DeleteBinsCommand,
  DuplicateBinCommand,
  MoveBinToStagingCommand,
  MoveBinFromStagingCommand,
  FillLayerCommand,
  ClearLayerCommand,
} from '../commands';
import type { DomainEvent } from '../events';
import { createEventMeta, capturePrevious } from './shared';

export function handleAddBin(command: AddBinCommand): CommandResult<string, DomainEvent> {
  const store = useLayoutStore.getState();
  const result = store.addBin(command.payload);

  if (isErr(result)) return err(result.error);

  const binId = result.value;
  // Re-read from store — Zustand+Immer creates a new state object after mutation
  const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
  if (!bin) return ok({ value: binId, events: [] });

  return ok({
    value: binId,
    events: [
      {
        type: 'bin.added' as const,
        payload: { bin: { ...bin } },
        meta: createEventMeta(command.meta, 'bin.added'),
      },
    ],
  });
}

export function handleUpdateBin(command: UpdateBinCommand): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id, updates } = command.payload;

  const existingBin = store.layout.bins.find((b) => b.id === id);
  if (!existingBin) {
    const storeResult = store.updateBin(id, updates);
    if (isErr(storeResult)) return err(storeResult.error);
    return ok({ value: undefined, events: [] });
  }

  const previous = capturePrevious(existingBin, updates);
  const result = store.updateBin(id, updates);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: [
      {
        type: 'bin.updated' as const,
        payload: { id, changes: updates, previous },
        meta: createEventMeta(command.meta, 'bin.updated'),
      },
    ],
  });
}

export function handleDeleteBin(command: DeleteBinCommand): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id } = command.payload;

  // Capture bin before deletion
  const bin = store.layout.bins.find((b) => b.id === id);
  const result = store.deleteBin(id);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: bin
      ? [
          {
            type: 'bin.deleted' as const,
            payload: { bin: { ...bin } },
            meta: createEventMeta(command.meta, 'bin.deleted'),
          },
        ]
      : [],
  });
}

export function handleDeleteBins(command: DeleteBinsCommand): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { ids } = command.payload;

  // Capture bins before deletion
  const idSet = new Set(ids);
  const bins = store.layout.bins.filter((b) => idSet.has(b.id)).map((b) => ({ ...b }));

  const result = store.deleteBins([...ids]);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events:
      bins.length > 0
        ? [
            {
              type: 'bin.batchDeleted' as const,
              payload: { bins },
              meta: createEventMeta(command.meta, 'bin.batchDeleted'),
            },
          ]
        : [],
  });
}

export function handleDuplicateBin(
  command: DuplicateBinCommand
): CommandResult<string, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id } = command.payload;

  const result = store.duplicateBin(id);
  if (isErr(result)) return err(result.error);

  const newBinId = result.value;
  // Re-read from store — Zustand+Immer creates a new state object after mutation
  const newBin = useLayoutStore.getState().layout.bins.find((b) => b.id === newBinId);

  return ok({
    value: newBinId,
    events: newBin
      ? [
          {
            type: 'bin.duplicated' as const,
            payload: { sourceId: id, newBin: { ...newBin } },
            meta: createEventMeta(command.meta, 'bin.duplicated'),
          },
        ]
      : [],
  });
}

export function handleMoveBinToStaging(
  command: MoveBinToStagingCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id } = command.payload;

  const bin = store.layout.bins.find((b) => b.id === id);
  const previousLayerId = bin?.layerId;

  const result = store.moveBinToStaging(id);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: previousLayerId
      ? [
          {
            type: 'bin.movedToStaging' as const,
            payload: { id, previousLayerId },
            meta: createEventMeta(command.meta, 'bin.movedToStaging'),
          },
        ]
      : [],
  });
}

export function handleMoveBinFromStaging(
  command: MoveBinFromStagingCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id, layerId, x, y } = command.payload;

  const result = store.moveBinFromStaging(id, layerId, x, y);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: [
      {
        type: 'bin.movedFromStaging' as const,
        payload: { id, layerId, x, y },
        meta: createEventMeta(command.meta, 'bin.movedFromStaging'),
      },
    ],
  });
}

export function handleFillLayer(command: FillLayerCommand): CommandResult<number, DomainEvent> {
  const store = useLayoutStore.getState();
  const { layerId, width, depth, categoryId, halfBinMode } = command.payload;

  const previousIds = new Set(store.layout.bins.map((b) => b.id));
  const count = store.fillLayer(layerId, width, depth, categoryId, halfBinMode);

  // Re-read from store — Zustand+Immer creates a new state object after mutation
  const currentBins = useLayoutStore.getState().layout.bins;
  const newBins = currentBins.filter((b) => !previousIds.has(b.id)).map((b) => ({ ...b }));

  return ok({
    value: count,
    events:
      count > 0
        ? [
            {
              type: 'bin.layerFilled' as const,
              payload: { layerId, binsCreated: count, bins: newBins },
              meta: createEventMeta(command.meta, 'bin.layerFilled'),
            },
          ]
        : [],
  });
}

export function handleClearLayer(command: ClearLayerCommand): CommandResult<number, DomainEvent> {
  const store = useLayoutStore.getState();
  const { layerId } = command.payload;

  // Capture bins before clearing
  const binsOnLayer = store.layout.bins.filter((b) => b.layerId === layerId).map((b) => ({ ...b }));

  const count = store.clearLayer(layerId);

  return ok({
    value: count,
    events:
      count > 0
        ? [
            {
              type: 'bin.layerCleared' as const,
              payload: { layerId, binsRemoved: count, bins: binsOnLayer },
              meta: createEventMeta(command.meta, 'bin.layerCleared'),
            },
          ]
        : [],
  });
}

/** Map of bin command types to their handlers */
export const binHandlers = {
  'bin.add': handleAddBin,
  'bin.update': handleUpdateBin,
  'bin.delete': handleDeleteBin,
  'bin.deleteBatch': handleDeleteBins,
  'bin.duplicate': handleDuplicateBin,
  'bin.moveToStaging': handleMoveBinToStaging,
  'bin.moveFromStaging': handleMoveBinFromStaging,
  'bin.fillLayer': handleFillLayer,
  'bin.clearLayer': handleClearLayer,
} as const;
