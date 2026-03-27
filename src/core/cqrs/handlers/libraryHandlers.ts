/**
 * Library Command Handlers
 *
 * Handlers for multi-layout library operations. Library commands use atomic
 * storage functions from @/core/storage for operations that need persistence
 * (delete, rename), or call store mutations directly for in-memory-only changes.
 *
 * Handler pattern: command handler → atomic storage op → store mutation.
 * The atomic ops ensure store + persistence remain consistent.
 */

import { useLibraryStore } from '@/core/store/library';
import { ok, err, isErr } from '@/core/result';
import { layoutInvalidOperation } from '@/core/result/constructors';
import { generateLayoutId } from '@/shared/utils';
import { computePreview } from '@/core/storage';
import type { LayoutId, LayoutPreview } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';
import type { CommandResult } from '../types';
import type { DomainEvent } from '../events';
import type {
  CreateEntryCommand,
  DeleteEntryCommand,
  DuplicateEntryCommand,
  SwitchActiveCommand,
  UpdateEntryCommand,
  SetAuthorNameCommand,
  SetCloudShareCommand,
  ClearCloudShareCommand,
  RenameEntryCommand,
  ImportLayoutCommand,
} from '../commands';
import { createEventMeta } from './shared';

function getDefaultPreview(): LayoutPreview {
  return {
    drawerWidth: gridUnits(6),
    drawerDepth: gridUnits(4),
    drawerHeight: heightUnits(7),
    binCount: 0,
    layerCount: 1,
  };
}

export function handleCreateEntry(
  command: CreateEntryCommand
): CommandResult<LayoutId, DomainEvent> {
  const store = useLibraryStore.getState();
  const layoutId = command.payload.layoutId ?? generateLayoutId();
  const preview = command.payload.preview ?? getDefaultPreview();

  const entry = store.createEntry(command.payload.name, layoutId, preview);

  return ok({
    value: entry.id,
    events: [
      {
        type: 'library.entryCreated' as const,
        payload: { layoutId: entry.id, name: entry.name },
        meta: createEventMeta(command.meta, 'library.entryCreated'),
      },
    ],
  });
}

export function handleDeleteEntry(command: DeleteEntryCommand): CommandResult<void, DomainEvent> {
  const store = useLibraryStore.getState();
  const result = store.deleteEntry(command.payload.layoutId);

  if (isErr(result)) return err(result.error);

  return ok({
    value: undefined,
    events: [
      {
        type: 'library.entryDeleted' as const,
        payload: { layoutId: command.payload.layoutId },
        meta: createEventMeta(command.meta, 'library.entryDeleted'),
      },
    ],
  });
}

export function handleDuplicateEntry(
  command: DuplicateEntryCommand
): CommandResult<LayoutId, DomainEvent> {
  const store = useLibraryStore.getState();
  const sourceEntry = store.getEntry(command.payload.sourceLayoutId);

  if (!sourceEntry) {
    return err(
      layoutInvalidOperation(
        'library.duplicateEntry',
        `Source layout ${command.payload.sourceLayoutId as string} not found`
      )
    );
  }

  const newLayoutId = generateLayoutId();
  const newEntry = store.duplicateEntry(sourceEntry, newLayoutId);

  return ok({
    value: newEntry.id,
    events: [
      {
        type: 'library.entryDuplicated' as const,
        payload: {
          sourceLayoutId: command.payload.sourceLayoutId,
          newLayoutId: newEntry.id,
        },
        meta: createEventMeta(command.meta, 'library.entryDuplicated'),
      },
    ],
  });
}

export function handleSwitchActive(command: SwitchActiveCommand): CommandResult<void, DomainEvent> {
  const store = useLibraryStore.getState();
  const previousLayoutId = store.library.activeLayoutId;

  store.setActiveLayoutId(command.payload.layoutId);

  return ok({
    value: undefined,
    events: [
      {
        type: 'library.activeLayoutSwitched' as const,
        payload: {
          previousLayoutId,
          newLayoutId: command.payload.layoutId,
        },
        meta: createEventMeta(command.meta, 'library.activeLayoutSwitched'),
      },
    ],
  });
}

export function handleUpdateEntry(command: UpdateEntryCommand): CommandResult<void, DomainEvent> {
  const store = useLibraryStore.getState();
  store.updateEntry(command.payload.layoutId, command.payload.updates);

  return ok({
    value: undefined,
    events: [
      {
        type: 'library.entryUpdated' as const,
        payload: {
          layoutId: command.payload.layoutId,
          changes: { ...command.payload.updates },
        },
        meta: createEventMeta(command.meta, 'library.entryUpdated'),
      },
    ],
  });
}

export function handleSetAuthorName(
  command: SetAuthorNameCommand
): CommandResult<void, DomainEvent> {
  const store = useLibraryStore.getState();
  const previousName = store.library.settings.authorName ?? '';

  store.setAuthorName(command.payload.name);

  return ok({
    value: undefined,
    events: [
      {
        type: 'library.authorNameSet' as const,
        payload: { name: command.payload.name, previousName },
        meta: createEventMeta(command.meta, 'library.authorNameSet'),
      },
    ],
  });
}

export function handleSetCloudShare(
  command: SetCloudShareCommand
): CommandResult<void, DomainEvent> {
  const store = useLibraryStore.getState();
  store.setCloudShare(command.payload.layoutId, command.payload.shareInfo);

  return ok({
    value: undefined,
    events: [
      {
        type: 'library.cloudShareUpdated' as const,
        payload: {
          layoutId: command.payload.layoutId,
          shareInfo: command.payload.shareInfo,
        },
        meta: createEventMeta(command.meta, 'library.cloudShareUpdated'),
      },
    ],
  });
}

export function handleClearCloudShare(
  command: ClearCloudShareCommand
): CommandResult<void, DomainEvent> {
  const store = useLibraryStore.getState();
  store.clearCloudShare(command.payload.layoutId);

  return ok({
    value: undefined,
    events: [
      {
        type: 'library.cloudShareCleared' as const,
        payload: { layoutId: command.payload.layoutId },
        meta: createEventMeta(command.meta, 'library.cloudShareCleared'),
      },
    ],
  });
}

export function handleRenameEntry(command: RenameEntryCommand): CommandResult<void, DomainEvent> {
  const store = useLibraryStore.getState();
  const entry = store.getEntry(command.payload.layoutId);
  const previousName = entry?.name ?? '';

  store.updateEntry(command.payload.layoutId, { name: command.payload.name });

  return ok({
    value: undefined,
    events: [
      {
        type: 'library.entryRenamed' as const,
        payload: {
          layoutId: command.payload.layoutId,
          name: command.payload.name,
          previousName,
        },
        meta: createEventMeta(command.meta, 'library.entryRenamed'),
      },
    ],
  });
}

export function handleImportLayout(
  command: ImportLayoutCommand
): CommandResult<LayoutId, DomainEvent> {
  const store = useLibraryStore.getState();
  const layoutId = generateLayoutId();
  const preview = computePreview(command.payload.layout);

  const entry = store.createEntry(command.payload.name, layoutId, preview);

  return ok({
    value: entry.id,
    events: [
      {
        type: 'library.entryCreated' as const,
        payload: { layoutId: entry.id, name: entry.name },
        meta: createEventMeta(command.meta, 'library.entryCreated'),
      },
    ],
  });
}

export const libraryHandlers = {
  'library.createEntry': handleCreateEntry,
  'library.deleteEntry': handleDeleteEntry,
  'library.duplicateEntry': handleDuplicateEntry,
  'library.switchActive': handleSwitchActive,
  'library.updateEntry': handleUpdateEntry,
  'library.setAuthorName': handleSetAuthorName,
  'library.setCloudShare': handleSetCloudShare,
  'library.clearCloudShare': handleClearCloudShare,
  'library.renameEntry': handleRenameEntry,
  'library.importLayout': handleImportLayout,
} as const;
