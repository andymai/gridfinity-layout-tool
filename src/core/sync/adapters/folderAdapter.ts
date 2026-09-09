import { isErr } from '@/core/result';
import { useLibraryStore } from '@/core/store';
import type { LayoutFolder, LayoutLibrary } from '@/core/types';
import { folderPath, saveLibrary } from '@/core/storage';
import { CONSTRAINTS } from '@/core/constants';
import type {
  AdapterChange,
  AdapterChangeListener,
  FolderAdapter,
  LayoutFolderPayload,
  SyncableItem,
} from './types';

/**
 * `FolderAdapter` over the library store's folder tree. Same shape as the
 * layout adapter: the store is the local source of truth, `saveLibrary`
 * persists it, and remote applies are suppressed from the change listener so
 * they cannot echo back to the cloud.
 */
const suppressed = new Set<string>();

function suppress(id: string): void {
  suppressed.add(id);
  queueMicrotask(() => suppressed.delete(id));
}

function toItem(folder: LayoutFolder): SyncableItem<LayoutFolderPayload> {
  return {
    id: folder.id,
    payload: {
      name: folder.name,
      parentId: folder.parentId ?? null,
      ...(folder.color !== undefined ? { color: folder.color } : {}),
      createdAt: folder.createdAt,
    },
    modifiedAt: folder.modifiedAt,
  };
}

/** A remote payload is trusted only as far as its shape goes; a bad one is dropped. */
function unwrap(payload: unknown): LayoutFolderPayload | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const raw = payload as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name === '') return null;
  return {
    name: name.slice(0, CONSTRAINTS.FOLDER_NAME_MAX_LENGTH),
    parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
    ...(typeof raw.color === 'string' ? { color: raw.color } : {}),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
  };
}

async function commit(nextLibrary: LayoutLibrary, id: string): Promise<void> {
  suppress(id);
  useLibraryStore.getState().setLibrary(nextLibrary);
  const result = await saveLibrary(nextLibrary);
  if (isErr(result)) throw new Error(`saveLibrary failed for folder ${id}`);
}

export const folderAdapter: FolderAdapter = {
  list(): Promise<SyncableItem<LayoutFolderPayload>[]> {
    return Promise.resolve((useLibraryStore.getState().library.folders ?? []).map(toItem));
  },

  get(id: string): Promise<SyncableItem<LayoutFolderPayload> | null> {
    const folder = useLibraryStore.getState().library.folders?.find((f) => f.id === id);
    return Promise.resolve(folder ? toItem(folder) : null);
  },

  async applyRemote(item: SyncableItem<LayoutFolderPayload>): Promise<void> {
    const payload = unwrap(item.payload);
    if (!payload) return;
    const { library } = useLibraryStore.getState();
    const folders = library.folders ?? [];
    const existing = folders.find((f) => f.id === item.id);
    // The server checks the parent's shape, not its place: a parent that is
    // this folder or sits below it would close a loop and hide the subtree,
    // so it lands at the root instead.
    const parentId =
      payload.parentId === item.id ||
      (payload.parentId !== null &&
        folderPath(library, payload.parentId).some((f) => f.id === item.id))
        ? null
        : payload.parentId;
    const folder: LayoutFolder = {
      id: item.id,
      name: payload.name,
      parentId,
      ...(payload.color !== undefined ? { color: payload.color } : {}),
      createdAt: existing?.createdAt ?? (payload.createdAt || item.modifiedAt),
      modifiedAt: item.modifiedAt,
    };
    const nextFolders = existing
      ? folders.map((f) => (f.id === item.id ? folder : f))
      : [...folders, folder];
    await commit({ ...library, folders: nextFolders }, item.id);
  },

  // The layouts that sat in it keep their folderId: they read as root until
  // their own updated envelopes arrive, or forever if the deleting device
  // already moved them, which is the same answer.
  async applyRemoteDelete(id: string): Promise<void> {
    const { library } = useLibraryStore.getState();
    if (!library.folders?.some((f) => f.id === id)) return;
    await commit({ ...library, folders: library.folders.filter((f) => f.id !== id) }, id);
  },

  subscribe(listener: AdapterChangeListener): () => void {
    let prev = snapshot(useLibraryStore.getState().library);
    return useLibraryStore.subscribe((state) => {
      const next = snapshot(state.library);
      for (const change of diff(prev, next)) {
        if (suppressed.has(change.id)) continue;
        listener(change);
      }
      prev = next;
    });
  },
};

function snapshot(library: LayoutLibrary): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of library.folders ?? []) out.set(f.id, f.modifiedAt);
  return out;
}

function diff(prev: Map<string, number>, next: Map<string, number>): AdapterChange[] {
  const changes: AdapterChange[] = [];
  for (const [id, modifiedAt] of next) {
    if (prev.get(id) !== modifiedAt) changes.push({ kind: 'put', id, modifiedAt });
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) changes.push({ kind: 'delete', id, modifiedAt: Date.now() });
  }
  return changes;
}
