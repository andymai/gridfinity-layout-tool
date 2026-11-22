/**
 * Reads and writes for the cutout library.
 *
 * The user's writes announce themselves for sync and stamp `updatedAt` past the
 * stored value, so the newest edit wins on every device. Writes pulled from the
 * cloud are silent: announcing them would push them straight back. Thumbnails
 * never announce, since each device makes its own.
 */

import type { Result, StorageError } from '@/core/result';
import {
  err,
  isErr,
  ok,
  storageNotFound,
  storageQuotaExceeded,
  storageUnavailable,
} from '@/core/result';
import { generateUUID } from '@/shared/utils/uuid';
import { isoStampAfter } from '@/shared/utils/editStamp';
import { storeHolderMeshes } from '@/shared/generation/meshRefs';
import { FOLDERS_STORE, ITEMS_STORE, THUMBNAILS_STORE, getLibraryDb } from './cutoutLibraryDb';
import { announce, notifyChanged } from './libraryEvents';
import {
  LIBRARY_FOLDER_ID_PREFIX,
  LIBRARY_ITEM_ID_PREFIX,
  MAX_LIBRARY_FOLDERS,
  MAX_LIBRARY_FOLDER_DEPTH,
  MAX_LIBRARY_ITEMS,
  MAX_LIBRARY_NAME_LENGTH,
  type CutoutLibraryContent,
  type CutoutLibraryFolder,
  type CutoutLibraryItem,
} from './libraryTypes';

export function cleanLibraryName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, MAX_LIBRARY_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

function unavailable(cause?: unknown) {
  return err(storageUnavailable('indexedDB', cause));
}

export async function listItems(): Promise<CutoutLibraryItem[]> {
  const db = await getLibraryDb();
  if (!db) return [];
  return ((await db.getAll(ITEMS_STORE)) as CutoutLibraryItem[]).sort(byName);
}

export async function getItem(id: string): Promise<CutoutLibraryItem | null> {
  const db = await getLibraryDb();
  if (!db) return null;
  return ((await db.get(ITEMS_STORE, id)) as CutoutLibraryItem | undefined) ?? null;
}

export async function getFolder(id: string): Promise<CutoutLibraryFolder | null> {
  const db = await getLibraryDb();
  if (!db) return null;
  return ((await db.get(FOLDERS_STORE, id)) as CutoutLibraryFolder | undefined) ?? null;
}

export async function listFolders(): Promise<CutoutLibraryFolder[]> {
  const db = await getLibraryDb();
  if (!db) return [];
  return ((await db.getAll(FOLDERS_STORE)) as CutoutLibraryFolder[]).sort(byName);
}

async function writeItem(
  item: CutoutLibraryItem
): Promise<Result<CutoutLibraryItem, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return unavailable();
  try {
    // Mesh files hold the meshes, so an item stays small and shares the file a
    // design already stored.
    const stored = { ...item, content: await storeHolderMeshes(item.content) };
    await db.put(ITEMS_STORE, stored);
    announce({
      kind: 'item',
      type: 'put',
      id: stored.id,
      modifiedAt: Date.parse(stored.updatedAt),
    });
    return ok(stored);
  } catch (error) {
    return unavailable(error);
  }
}

export async function createItem(input: {
  readonly name: string;
  readonly folderId: string | null;
  readonly content: CutoutLibraryContent;
}): Promise<Result<CutoutLibraryItem, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return unavailable();
  let count: number;
  try {
    count = await db.count(ITEMS_STORE);
  } catch (error) {
    return unavailable(error);
  }
  if (count >= MAX_LIBRARY_ITEMS) return err(storageQuotaExceeded());
  const now = new Date().toISOString();
  return writeItem({
    id: `${LIBRARY_ITEM_ID_PREFIX}${generateUUID()}`,
    name: cleanLibraryName(input.name, 'Cutout'),
    folderId: input.folderId,
    createdAt: now,
    updatedAt: now,
    content: input.content,
  });
}

/**
 * Patch an item. The read and the write share one transaction, so an edit
 * from another tab between them cannot be lost.
 */
export async function updateItem(
  id: string,
  patch: Partial<Pick<CutoutLibraryItem, 'name' | 'folderId' | 'content'>>
): Promise<Result<CutoutLibraryItem, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return unavailable();
  try {
    // Before the transaction: it closes at the first await that is not on it.
    const content = patch.content ? await storeHolderMeshes(patch.content) : undefined;
    const tx = db.transaction(ITEMS_STORE, 'readwrite');
    const current = (await tx.store.get(id)) as CutoutLibraryItem | undefined;
    if (!current) {
      await tx.done;
      return err(storageNotFound(id));
    }
    const next: CutoutLibraryItem = {
      ...current,
      ...patch,
      ...(content ? { content } : {}),
      name: patch.name === undefined ? current.name : cleanLibraryName(patch.name, current.name),
      updatedAt: isoStampAfter(current.updatedAt),
    };
    await tx.store.put(next);
    await tx.done;
    announce({ kind: 'item', type: 'put', id, modifiedAt: Date.parse(next.updatedAt) });
    return ok(next);
  } catch (error) {
    return unavailable(error);
  }
}

export async function deleteItem(id: string): Promise<Result<void, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return unavailable();
  try {
    await db.delete(ITEMS_STORE, id);
    await db.delete(THUMBNAILS_STORE, id);
  } catch (error) {
    return unavailable(error);
  }
  announce({ kind: 'item', type: 'delete', id, deletedAt: Date.now() });
  return ok(undefined);
}

function depthOf(id: string | null, folders: ReadonlyMap<string, CutoutLibraryFolder>): number {
  let depth = 0;
  for (let at = id; at !== null && depth <= folders.size; depth++) {
    at = folders.get(at)?.parentId ?? null;
  }
  return depth;
}

/** Whether `parentId` is `id` or sits inside it: a move there would make a loop. */
export function wouldLoop(
  id: string,
  parentId: string | null,
  folders: ReadonlyMap<string, CutoutLibraryFolder>
): boolean {
  const seen = new Set<string>();
  for (let at = parentId; at !== null && !seen.has(at); at = folders.get(at)?.parentId ?? null) {
    if (at === id) return true;
    seen.add(at);
  }
  return false;
}

async function folderMap(): Promise<Map<string, CutoutLibraryFolder>> {
  return new Map((await listFolders()).map((f) => [f.id, f]));
}

async function writeFolder(
  folder: CutoutLibraryFolder
): Promise<Result<CutoutLibraryFolder, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return unavailable();
  try {
    await db.put(FOLDERS_STORE, folder);
  } catch (error) {
    return unavailable(error);
  }
  announce({
    kind: 'folder',
    type: 'put',
    id: folder.id,
    modifiedAt: Date.parse(folder.updatedAt),
  });
  return ok(folder);
}

/** Levels from `id` down to its deepest folder, `id` included. */
function heightOf(id: string, folders: ReadonlyMap<string, CutoutLibraryFolder>): number {
  const children = new Map<string, string[]>();
  for (const folder of folders.values()) {
    if (folder.parentId !== null) {
      children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder.id]);
    }
  }
  const seen = new Set<string>();
  const walk = (at: string): number => {
    if (seen.has(at)) return 0;
    seen.add(at);
    return 1 + Math.max(0, ...(children.get(at) ?? []).map(walk));
  };
  return walk(id);
}

export async function createFolder(
  name: string,
  parentId: string | null
): Promise<Result<CutoutLibraryFolder, StorageError>> {
  let folders: Map<string, CutoutLibraryFolder>;
  try {
    folders = await folderMap();
  } catch (error) {
    return unavailable(error);
  }
  if (folders.size >= MAX_LIBRARY_FOLDERS) {
    return err(storageQuotaExceeded());
  }
  const parent = parentId !== null && folders.has(parentId) ? parentId : null;
  const depth = depthOf(parent, folders);
  if (depth >= MAX_LIBRARY_FOLDER_DEPTH) {
    return err(storageQuotaExceeded());
  }
  const now = new Date().toISOString();
  return writeFolder({
    id: `${LIBRARY_FOLDER_ID_PREFIX}${generateUUID()}`,
    name: cleanLibraryName(name, 'Folder'),
    parentId: parent,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Rename or move a folder, in one transaction. A move that would make a loop
 * changes nothing; one that would nest past MAX_LIBRARY_FOLDER_DEPTH is refused.
 */
export async function updateFolder(
  id: string,
  patch: Partial<Pick<CutoutLibraryFolder, 'name' | 'parentId'>>
): Promise<Result<CutoutLibraryFolder, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return unavailable();
  let next: CutoutLibraryFolder;
  try {
    const tx = db.transaction(FOLDERS_STORE, 'readwrite');
    const folders = new Map(
      ((await tx.store.getAll()) as CutoutLibraryFolder[]).map((f) => [f.id, f])
    );
    const current = folders.get(id);
    if (!current) {
      await tx.done;
      return err(storageNotFound(id));
    }
    const parentId = patch.parentId === undefined ? current.parentId : patch.parentId;
    if (wouldLoop(id, parentId, folders)) {
      await tx.done;
      return ok(current);
    }
    const depth = depthOf(parentId, folders) + heightOf(id, folders);
    if (parentId !== current.parentId && depth > MAX_LIBRARY_FOLDER_DEPTH) {
      await tx.done;
      return err(storageQuotaExceeded());
    }
    next = {
      ...current,
      name: patch.name === undefined ? current.name : cleanLibraryName(patch.name, current.name),
      parentId,
      updatedAt: isoStampAfter(current.updatedAt),
    };
    await tx.store.put(next);
    await tx.done;
  } catch (error) {
    return unavailable(error);
  }
  announce({ kind: 'folder', type: 'put', id, modifiedAt: Date.parse(next.updatedAt) });
  return ok(next);
}

/** Delete a folder. What it held moves up to its parent, so nothing is lost. */
export async function deleteFolder(id: string): Promise<Result<void, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return unavailable();
  try {
    const folders = await folderMap();
    const folder = folders.get(id);
    if (!folder) return ok(undefined);
    for (const item of await listItems()) {
      if (item.folderId !== id) continue;
      const moved = await updateItem(item.id, { folderId: folder.parentId });
      if (isErr(moved)) return moved;
    }
    for (const child of folders.values()) {
      if (child.parentId !== id) continue;
      const moved = await updateFolder(child.id, { parentId: folder.parentId });
      if (isErr(moved)) return moved;
    }
    await db.delete(FOLDERS_STORE, id);
  } catch (error) {
    return unavailable(error);
  }
  announce({ kind: 'folder', type: 'delete', id, deletedAt: Date.now() });
  return ok(undefined);
}

// ── Writes pulled from the cloud: silent ───────────────────────────────────

export async function putRemoteItem(item: CutoutLibraryItem): Promise<void> {
  const db = await getLibraryDb();
  if (!db) return;
  await db.put(ITEMS_STORE, { ...item, content: await storeHolderMeshes(item.content) });
  notifyChanged();
}

export async function deleteRemoteItem(id: string): Promise<void> {
  const db = await getLibraryDb();
  if (!db) return;
  await db.delete(ITEMS_STORE, id);
  await db.delete(THUMBNAILS_STORE, id);
  notifyChanged();
}

export async function putRemoteFolder(folder: CutoutLibraryFolder): Promise<void> {
  const db = await getLibraryDb();
  if (!db) return;
  await db.put(FOLDERS_STORE, folder);
  notifyChanged();
}

/** A folder deleted elsewhere: what it held moves up, as on the device that deleted it. */
export async function deleteRemoteFolder(id: string): Promise<void> {
  const db = await getLibraryDb();
  if (!db) return;
  const folders = await folderMap();
  const parentId = folders.get(id)?.parentId ?? null;
  for (const item of await listItems()) {
    if (item.folderId === id) await db.put(ITEMS_STORE, { ...item, folderId: parentId });
  }
  for (const child of folders.values()) {
    if (child.parentId === id) await db.put(FOLDERS_STORE, { ...child, parentId });
  }
  await db.delete(FOLDERS_STORE, id);
  notifyChanged();
}

// ── Thumbnails: per device, keyed to the content they show ─────────────────

interface StoredThumbnail {
  readonly itemId: string;
  /** The item's `updatedAt` when the picture was made; a newer edit makes it stale. */
  readonly version: string;
  readonly dataUrl: string;
}

export async function getThumbnail(item: CutoutLibraryItem): Promise<string | null> {
  const db = await getLibraryDb();
  if (!db) return null;
  const stored = (await db.get(THUMBNAILS_STORE, item.id)) as StoredThumbnail | undefined;
  return stored?.version === item.updatedAt ? stored.dataUrl : null;
}

export async function putThumbnail(item: CutoutLibraryItem, dataUrl: string): Promise<void> {
  const db = await getLibraryDb();
  if (!db) return;
  const record: StoredThumbnail = { itemId: item.id, version: item.updatedAt, dataUrl };
  await db.put(THUMBNAILS_STORE, record);
}
