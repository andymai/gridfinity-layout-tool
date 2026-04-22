/**
 * Layer Command Handlers
 */

import { useLayoutStore } from '@/core/store/layout';
import { ok, err, isErr, layoutInvalidOperation } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import type { CommandResult } from '../types';
import type {
  AddLayerCommand,
  UpdateLayerCommand,
  DeleteLayerCommand,
  ReorderLayersCommand,
} from '../commands';
import type { DomainEvent } from '../events';
import { createEventMeta, capturePrevious } from './shared';

export function handleAddLayer(command: AddLayerCommand): CommandResult<string, DomainEvent> {
  const store = useLayoutStore.getState();
  const result = store.addLayer();
  if (isErr(result)) return err(result.error);

  const layerId = result.value;
  // Re-read from store — Zustand+Immer creates a new state object after mutation
  const layer = useLayoutStore.getState().layout.layers.find((l) => l.id === layerId);

  return ok({
    value: layerId,
    events: layer
      ? [
          {
            type: 'layer.added' as const,
            payload: { layer: { ...layer } },
            meta: createEventMeta(command.meta, 'layer.added'),
          },
        ]
      : [],
  });
}

export function handleUpdateLayer(command: UpdateLayerCommand): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id, updates } = command.payload;

  // Fail fast if the layer is missing (symmetry with handleUpdateBin).
  const existing = store.layout.layers.find((l) => l.id === id);
  if (!existing) {
    return err(layoutInvalidOperation('updateLayer', `Layer ${id} not found`));
  }

  const previous = capturePrevious(existing, updates);
  const result = store.updateLayer(id, updates);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: [
      {
        type: 'layer.updated' as const,
        payload: { id, changes: updates, previous },
        meta: createEventMeta(command.meta, 'layer.updated'),
      },
    ],
  });
}

export function handleDeleteLayer(command: DeleteLayerCommand): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { id } = command.payload;

  const layer = store.layout.layers.find((l) => l.id === id);
  const deletedBinCount = store.layout.bins.filter(
    (b) => b.layerId === id && b.layerId !== STAGING_ID
  ).length;

  const result = store.deleteLayer(id);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: layer
      ? [
          {
            type: 'layer.deleted' as const,
            payload: { layer: { ...layer }, deletedBinCount },
            meta: createEventMeta(command.meta, 'layer.deleted'),
          },
        ]
      : [],
  });
}

export function handleReorderLayers(
  command: ReorderLayersCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const { fromIndex, toIndex } = command.payload;

  const result = store.reorderLayers(fromIndex, toIndex);
  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: [
      {
        type: 'layer.reordered' as const,
        payload: { fromIndex, toIndex },
        meta: createEventMeta(command.meta, 'layer.reordered'),
      },
    ],
  });
}

export const layerHandlers = {
  'layer.add': handleAddLayer,
  'layer.update': handleUpdateLayer,
  'layer.delete': handleDeleteLayer,
  'layer.reorder': handleReorderLayers,
} as const;
