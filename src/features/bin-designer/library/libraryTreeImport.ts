/**
 * A folder file added to the library: a new top-level folder for the exported
 * one, with its subfolders and items, written in one transaction so the file
 * lands whole or not at all.
 */

import type { Result, StorageError } from '@/core/result';
import { err, ok, storageUnavailable } from '@/core/result';
import { generateUUID } from '@/shared/utils/uuid';
import { storeHolderMeshes } from '@/shared/generation/meshRefs';
import { FOLDERS_STORE, ITEMS_STORE, getLibraryDb } from './cutoutLibraryDb';
import { cleanLibraryName } from './CutoutLibraryService';
import { announceAll, type LibraryEvent } from './libraryEvents';
import { treeLimit, type LibraryFolderTree, type LibraryLimit } from './libraryFile';
import {
  LIBRARY_FOLDER_ID_PREFIX,
  LIBRARY_ITEM_ID_PREFIX,
  type CutoutLibraryContent,
  type CutoutLibraryFolder,
  type CutoutLibraryItem,
} from './libraryTypes';

/** The transaction found the library full: another tab wrote after the caller's check. */
export interface LibraryLimitError {
  readonly code: 'LIBRARY_LIMIT';
  readonly limit: LibraryLimit;
}

export interface ImportedTree {
  readonly folder: CutoutLibraryFolder;
  readonly items: number;
  readonly folders: number;
}

/**
 * Add `tree` under a new top-level folder, with fresh ids. Refused with the
 * limit it would pass, and nothing written, when the library has no room.
 * `fallbacks` names a folder or an item that the file left unnamed.
 */
export async function importFolderTree(
  tree: LibraryFolderTree,
  fallbacks: { readonly folder: string; readonly item: string }
): Promise<Result<ImportedTree, StorageError | LibraryLimitError>> {
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
    const limit = treeLimit(tree, have);
    if (limit) {
      await tx.done;
      return err({ code: 'LIBRARY_LIMIT', limit });
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
