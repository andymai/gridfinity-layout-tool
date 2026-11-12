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
  /** `Date.now()` at the read: the clock that sync's `modifiedAt` uses. */
  readonly readTime: number;
}

interface PulledCopy {
  readonly modifiedAt: number;
  /** The `readAt` of the last read before the pull landed. */
  readonly afterRead: number;
}

let reads = 0;
const newestSavedRead = new Map<string, number>();
const newestPull = new Map<string, PulledCopy>();

export function readOpenLayout(): OpenLayoutRead {
  const { activeLayoutId, layout } = useLayoutStore.getState();
  reads += 1;
  return { id: activeLayoutId, layout, readAt: reads, readTime: Date.now() };
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

/** Records a copy that sync pulled into storage, with its `modifiedAt`. */
export function notePulledCopy(id: string, modifiedAt: number): void {
  newestPull.set(id, { modifiedAt, afterRead: reads });
}

/**
 * Whether storage holds a newer copy of the layout than `read`: a later local
 * read, or a pulled copy that is newer by sync's rule. Sync pulls only a copy
 * whose `modifiedAt` is greater than the local one, so an equal time keeps the
 * local copy. A read after the pull started from the pulled copy, so the pull
 * does not count against it.
 */
export function savedLaterCopy(read: OpenLayoutRead): boolean {
  if (read.id === null) return false;
  if ((newestSavedRead.get(read.id) ?? 0) > read.readAt) return true;
  const pull = newestPull.get(read.id);
  return pull !== undefined && read.readAt <= pull.afterRead && pull.modifiedAt > read.readTime;
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
