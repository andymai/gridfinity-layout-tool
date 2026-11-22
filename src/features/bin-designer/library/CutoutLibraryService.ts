/**
 * Reads and writes for the cutout library.
 *
 * The user's writes announce themselves for sync and stamp `updatedAt` past the
 * stored value, so the newest edit wins on every device. Writes pulled from the
 * cloud are silent: announcing them would push them straight back. Thumbnails
 * never announce, since each device makes its own.
 */

import type { Result, StorageError } from '@/core/result';
import { err, ok, storageNotFound, storageQuotaExceeded, storageUnavailable } from '@/core/result';
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

function unavailable() {
  return err(storageUnavailable('indexedDB'));
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
  // Mesh files hold the meshes, so an item stays small and shares the file a
  // design already stored.
  const stored = { ...item, content: await storeHolderMeshes(item.content) };
  await db.put(ITEMS_STORE, stored);
  announce({ kind: 'item', type: 'put', id: stored.id, modifiedAt: Date.parse(stored.updatedAt) });
  return ok(stored);
}

export async function createItem(input: {
  readonly name: string;
  readonly folderId: string | null;
  readonly content: CutoutLibraryContent;
}): Promise<Result<CutoutLibraryItem, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return unavailable();
  const count = await db.count(ITEMS_STORE);
  if (count >= MAX_LIBRARY_ITEMS) return err(storageQuotaExceeded(count, MAX_LIBRARY_ITEMS));
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

export async function updateItem(
  id: string,
  patch: Partial<Pick<CutoutLibraryItem, 'name' | 'folderId' | 'content'>>
): Promise<Result<CutoutLibraryItem, StorageError>> {
  const current = await getItem(id);
  if (!current) return err(storageNotFound(id));
  return writeItem({
    ...current,
    ...patch,
    name: patch.name === undefined ? current.name : cleanLibraryName(patch.name, current.name),
    updatedAt: isoStampAfter(current.updatedAt),
  });
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getLibraryDb();
  if (!db) return;
  await db.delete(ITEMS_STORE, id);
  await db.delete(THUMBNAILS_STORE, id);
  announce({ kind: 'item', type: 'delete', id, deletedAt: Date.now() });
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
  await db.put(FOLDERS_STORE, folder);
  announce({
    kind: 'folder',
    type: 'put',
    id: folder.id,
    modifiedAt: Date.parse(folder.updatedAt),
  });
  return ok(folder);
}

export async function createFolder(
  name: string,
  parentId: string | null
): Promise<Result<CutoutLibraryFolder, StorageError>> {
  const folders = await folderMap();
  if (folders.size >= MAX_LIBRARY_FOLDERS) {
    return err(storageQuotaExceeded(folders.size, MAX_LIBRARY_FOLDERS));
  }
  const parent = parentId !== null && folders.has(parentId) ? parentId : null;
  const depth = depthOf(parent, folders);
  if (depth >= MAX_LIBRARY_FOLDER_DEPTH) {
    return err(storageQuotaExceeded(depth, MAX_LIBRARY_FOLDER_DEPTH));
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

export async function updateFolder(
  id: string,
  patch: Partial<Pick<CutoutLibraryFolder, 'name' | 'parentId'>>
): Promise<Result<CutoutLibraryFolder, StorageError>> {
  const folders = await folderMap();
  const current = folders.get(id);
  if (!current) return err(storageNotFound(id));
  const parentId = patch.parentId === undefined ? current.parentId : patch.parentId;
  if (wouldLoop(id, parentId, folders)) return ok(current);
  return writeFolder({
    ...current,
    name: patch.name === undefined ? current.name : cleanLibraryName(patch.name, current.name),
    parentId,
    updatedAt: isoStampAfter(current.updatedAt),
  });
}

/** Delete a folder. What it held moves up to its parent, so nothing is lost. */
export async function deleteFolder(id: string): Promise<void> {
  const db = await getLibraryDb();
  if (!db) return;
  const folders = await folderMap();
  const folder = folders.get(id);
  if (!folder) return;
  for (const item of await listItems()) {
    if (item.folderId === id) await updateItem(item.id, { folderId: folder.parentId });
  }
  for (const child of folders.values()) {
    if (child.parentId === id) await updateFolder(child.id, { parentId: folder.parentId });
  }
  await db.delete(FOLDERS_STORE, id);
  announce({ kind: 'folder', type: 'delete', id, deletedAt: Date.now() });
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
