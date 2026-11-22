/**
 * Sync adapters for the cutout library: items and their folders. They live in
 * the bin designer because the library's types do, and core/ cannot import
 * them. The server serves both kinds behind CUTOUT_LIBRARY_SYNC_ENABLED; the
 * engine holds them while its manifest leaves them out (`servedKinds.ts`).
 *
 * An item's meshes travel as they do for a design: refs once the account
 * holds the files, inline otherwise.
 */

import type {
  AdapterChange,
  AdapterChangeListener,
  CutoutFolderAdapter,
  CutoutItemAdapter,
  CutoutLibraryFolderPayload,
  CutoutLibraryItemPayload,
  PushPlan,
  SyncableItem,
} from '@/core/sync/adapters/types';
import { isOk } from '@/core/result';
import { holderMeshHashes, inlineHolderMeshes } from '@/shared/generation/meshRefs';
import { fetchMeshFiles, forgetHeldMeshes, meshCloudSession } from '@/shared/generation/meshCloud';
import {
  deleteRemoteFolder,
  deleteRemoteItem,
  getFolder,
  getItem,
  listFolders,
  listItems,
  putRemoteFolder,
  putRemoteItem,
  wouldLoop,
} from '@/features/bin-designer/library/CutoutLibraryService';
import { subscribe as subscribeLibraryEvents } from '@/features/bin-designer/library/libraryEvents';
import type { LibraryKind } from '@/features/bin-designer/library/libraryEvents';
import type {
  CutoutLibraryContent,
  CutoutLibraryFolder,
  CutoutLibraryItem,
} from '@/features/bin-designer/library/libraryTypes';
import { isPlaceableCutout } from '@/features/bin-designer/library/libraryCutoutCheck';
import { createMissingMeshPushes } from './missingMeshPushes';
import { planMeshPush } from './meshPushPlan';

const missingMeshPushes = createMissingMeshPushes();

const toMs = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};

/** Pulled content the library can draw: the server checks the same rules on push. */
function isContent(value: unknown): value is CutoutLibraryContent {
  if (typeof value !== 'object' || value === null) return false;
  const params = (value as { params?: unknown }).params;
  if (typeof params !== 'object' || params === null) return false;
  const { cutouts, meshAssets } = params as { cutouts?: unknown; meshAssets?: unknown };
  return (
    Array.isArray(cutouts) &&
    cutouts.length > 0 &&
    cutouts.every((c) => isPlaceableCutout(c, meshAssets))
  );
}

function itemToSync(
  item: CutoutLibraryItem,
  content: CutoutLibraryContent = item.content
): SyncableItem<CutoutLibraryItemPayload> {
  return {
    id: item.id,
    modifiedAt: toMs(item.updatedAt),
    payload: { name: item.name, folderId: item.folderId, createdAt: item.createdAt, content },
  };
}

/** The item with its meshes inline, or null when a mesh file is not on this device. */
async function inlineItem(
  id: string,
  only?: ReadonlySet<string>
): Promise<SyncableItem<CutoutLibraryItemPayload> | null> {
  const item = await getItem(id);
  if (!item) return null;
  const inline = await inlineHolderMeshes(item.content, only);
  if (!isOk(inline)) {
    missingMeshPushes.skip(inline.error.hash, id);
    return null;
  }
  return itemToSync(item, inline.value);
}

function forward(kind: LibraryKind, listener: AdapterChangeListener, clear?: (id: string) => void) {
  return subscribeLibraryEvents((event) => {
    if (event.kind !== kind) return;
    clear?.(event.id);
    const change: AdapterChange =
      event.type === 'put'
        ? { kind: 'put', id: event.id, modifiedAt: event.modifiedAt }
        : { kind: 'delete', id: event.id, modifiedAt: event.deletedAt };
    listener(change);
  });
}

export const cutoutItemAdapter: CutoutItemAdapter = {
  async list() {
    return (await listItems()).map((item) => itemToSync(item));
  },

  get(id) {
    return inlineItem(id);
  },

  async preparePush(id): Promise<PushPlan<CutoutLibraryItemPayload>> {
    const session = meshCloudSession();
    const item = await getItem(id);
    if (!item) return { status: 'skip' };
    return planMeshPush(
      itemToSync(item),
      item.content,
      (only) => inlineItem(id, only),
      missingMeshPushes,
      session
    );
  },

  onMissing: forgetHeldMeshes,

  async applyRemote(remote) {
    const { name, folderId, createdAt, content } = remote.payload;
    if (!isContent(content)) return;
    const session = meshCloudSession();
    await putRemoteItem({
      id: remote.id,
      name,
      folderId,
      createdAt,
      // The envelope's mtime is the sender's edit time, so a pulled item's next
      // edit stamps after it.
      updatedAt: new Date(remote.modifiedAt).toISOString(),
      content,
    });
    void fetchMeshFiles(holderMeshHashes(content), session);
  },

  applyRemoteDelete(id) {
    return deleteRemoteItem(id);
  },

  subscribe(listener) {
    const stopEvents = forward('item', listener, (id) => missingMeshPushes.clear(id));
    const stopArrivals = missingMeshPushes.subscribe(listener, async (id) => {
      const item = await getItem(id);
      return item ? toMs(item.updatedAt) : null;
    });
    return () => {
      stopEvents();
      stopArrivals();
    };
  },
};

function folderToSync(folder: CutoutLibraryFolder): SyncableItem<CutoutLibraryFolderPayload> {
  return {
    id: folder.id,
    modifiedAt: toMs(folder.updatedAt),
    payload: { name: folder.name, parentId: folder.parentId, createdAt: folder.createdAt },
  };
}

export const cutoutFolderAdapter: CutoutFolderAdapter = {
  async list() {
    return (await listFolders()).map(folderToSync);
  },

  async get(id) {
    const folder = await getFolder(id);
    return folder ? folderToSync(folder) : null;
  },

  async applyRemote(remote) {
    const folders = new Map((await listFolders()).map((f) => [f.id, f]));
    // Two devices can each move one folder into the other. Whichever lands
    // second would close a loop and hide both, so it lands at the top here.
    const parentId =
      remote.payload.parentId !== null && wouldLoop(remote.id, remote.payload.parentId, folders)
        ? null
        : remote.payload.parentId;
    await putRemoteFolder({
      id: remote.id,
      name: remote.payload.name,
      parentId,
      createdAt: remote.payload.createdAt,
      updatedAt: new Date(remote.modifiedAt).toISOString(),
    });
  },

  applyRemoteDelete(id) {
    return deleteRemoteFolder(id);
  },

  subscribe(listener) {
    return forward('folder', listener);
  },
};
