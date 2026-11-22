/**
 * A folder file added to the library: a new top-level folder for the exported
 * one, with its subfolders and items, written in one transaction so the file
 * lands whole or not at all.
 */

import type { Result, StorageError } from '@/core/result';
import { err, ok, storageQuotaExceeded, storageUnavailable } from '@/core/result';
import { generateUUID } from '@/shared/utils/uuid';
import { storeHolderMeshes } from '@/shared/generation/meshRefs';
import { FOLDERS_STORE, ITEMS_STORE, getLibraryDb } from './cutoutLibraryDb';
import { cleanLibraryName } from './CutoutLibraryService';
import { announceAll, type LibraryEvent } from './libraryEvents';
import type { LibraryFileFolder, LibraryFolderTree } from './libraryFile';
import {
  LIBRARY_FOLDER_ID_PREFIX,
  LIBRARY_ITEM_ID_PREFIX,
  MAX_LIBRARY_FOLDERS,
  MAX_LIBRARY_FOLDER_DEPTH,
  MAX_LIBRARY_ITEMS,
  type CutoutLibraryContent,
  type CutoutLibraryFolder,
  type CutoutLibraryItem,
} from './libraryTypes';

export type LibraryLimit = 'items' | 'folders' | 'depth';

/** Levels of subfolders under the exported folder. `folders` lists parents first. */
function treeDepth(folders: readonly LibraryFileFolder[]): number {
  const level = new Map<string | null, number>([[null, 0]]);
  let deepest = 0;
  for (const folder of folders) {
    const at = (level.get(folder.parentId) ?? 0) + 1;
    level.set(folder.id, at);
    deepest = Math.max(deepest, at);
  }
  return deepest;
}

/** The limit `tree` would pass at the top level of a library holding `have`, or null. */
export function treeLimit(
  tree: LibraryFolderTree,
  have: { readonly items: number; readonly folders: number }
): LibraryLimit | null {
  if (have.items + tree.items.length > MAX_LIBRARY_ITEMS) return 'items';
  if (have.folders + tree.folders.length + 1 > MAX_LIBRARY_FOLDERS) return 'folders';
  if (treeDepth(tree.folders) + 1 > MAX_LIBRARY_FOLDER_DEPTH) return 'depth';
  return null;
}

export interface ImportedTree {
  readonly folder: CutoutLibraryFolder;
  readonly items: number;
  readonly folders: number;
}

/**
 * Add `tree` under a new top-level folder, with fresh ids. Refused as a
 * quota error, with nothing written, when it would pass a library limit.
 * `fallbacks` names a folder or an item that the file left unnamed.
 */
export async function importFolderTree(
  tree: LibraryFolderTree,
  fallbacks: { readonly folder: string; readonly item: string }
): Promise<Result<ImportedTree, StorageError>> {
  const db = await getLibraryDb();
  if (!db) return err(storageUnavailable('indexedDB'));
  try {
    // Before the transaction: it closes at the first await that is not on it.
    const contents: CutoutLibraryContent[] = [];
    for (const item of tree.items) contents.push(await storeHolderMeshes(item.content));

    const tx = db.transaction([ITEMS_STORE, FOLDERS_STORE], 'readwrite');
    const itemStore = tx.objectStore(ITEMS_STORE);
    const folderStore = tx.objectStore(FOLDERS_STORE);
    const have = { items: await itemStore.count(), folders: await folderStore.count() };
    if (treeLimit(tree, have)) {
      await tx.done;
      return err(storageQuotaExceeded());
    }

    const now = new Date().toISOString();
    const root: CutoutLibraryFolder = {
      id: `${LIBRARY_FOLDER_ID_PREFIX}${generateUUID()}`,
      name: cleanLibraryName(tree.name, fallbacks.folder),
      parentId: null,
      createdAt: now,
      updatedAt: now,
    };
    const newId = new Map<string | null, string>([[null, root.id]]);
    const folders: CutoutLibraryFolder[] = [root];
    for (const folder of tree.folders) {
      const id = `${LIBRARY_FOLDER_ID_PREFIX}${generateUUID()}`;
      newId.set(folder.id, id);
      folders.push({
        id,
        name: cleanLibraryName(folder.name, fallbacks.folder),
        parentId: newId.get(folder.parentId) ?? root.id,
        createdAt: now,
        updatedAt: now,
      });
    }
    const items: CutoutLibraryItem[] = tree.items.map((item, i) => ({
      id: `${LIBRARY_ITEM_ID_PREFIX}${generateUUID()}`,
      name: cleanLibraryName(item.name, fallbacks.item),
      folderId: newId.get(item.folderId) ?? root.id,
      createdAt: now,
      updatedAt: now,
      content: contents[i],
    }));
    await Promise.all([
      ...folders.map((folder) => folderStore.put(folder)),
      ...items.map((item) => itemStore.put(item)),
      tx.done,
    ]);

    const modifiedAt = Date.parse(now);
    const events: LibraryEvent[] = [
      ...folders.map((f) => ({ kind: 'folder', type: 'put', id: f.id, modifiedAt }) as const),
      ...items.map((item) => ({ kind: 'item', type: 'put', id: item.id, modifiedAt }) as const),
    ];
    announceAll(events);
    return ok({ folder: root, items: items.length, folders: folders.length - 1 });
  } catch (error) {
    return err(storageUnavailable('indexedDB', error));
  }
}
