import { isRealLayoutId } from '@/core/constants';
import { isErr, OK } from '@/core/result';
import type { Result, StorageError, Unit } from '@/core/result';
import { saveLayoutWithMetadata } from '@/core/storage';
import type { Layout, LayoutId } from '@/core/types';
import { useLayoutStore } from './layout';
import { useLibraryStore } from './library';
import { queueLibraryWrite } from './libraryWrites';

/** The open layout as one read saw it. */
export interface OpenLayoutRead {
  readonly id: LayoutId | null;
  readonly layout: Layout;
  /** Higher for a later read, so it orders two copies of one layout. */
  readonly readAt: number;
}

let reads = 0;
const newestSavedRead = new Map<string, number>();

export function readOpenLayout(): OpenLayoutRead {
  const { activeLayoutId, layout } = useLayoutStore.getState();
  reads += 1;
  return { id: activeLayoutId, layout, readAt: reads };
}

/**
 * Records a successful save of `read`. Every save of the open layout records
 * itself, so a save that waited in the queue can tell that a newer copy of its
 * layout is already in storage.
 */
export function noteOpenLayoutSaved(read: OpenLayoutRead): void {
  if (read.id === null) return;
  if ((newestSavedRead.get(read.id) ?? 0) < read.readAt) {
    newestSavedRead.set(read.id, read.readAt);
  }
}

export function savedLaterCopy(read: OpenLayoutRead): boolean {
  return read.id !== null && (newestSavedRead.get(read.id) ?? 0) > read.readAt;
}

/** Saves the open layout as it is when the queue reaches this write. */
export function saveOpenLayout(): Promise<Result<Unit, StorageError>> {
  return queueLibraryWrite(async (library) => {
    const open = readOpenLayout();
    if (!isRealLayoutId(open.id)) return OK;
    const saved = await saveLayoutWithMetadata(open.id, open.layout, library);
    if (isErr(saved)) return saved;
    noteOpenLayoutSaved(open);
    useLibraryStore.getState().setLibrary(saved.value.library);
    return OK;
  });
}
