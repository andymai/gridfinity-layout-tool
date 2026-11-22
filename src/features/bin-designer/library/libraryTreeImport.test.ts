// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { expectOk } from '@/test/testUtils';
import { isErr } from '@/core/result';
import { closeLibraryDb } from './cutoutLibraryDb';
import { createFolder, listFolders, listItems } from './CutoutLibraryService';
import { __resetForTests, subscribe, subscribeChanges } from './libraryEvents';
import type { LibraryFolderTree } from './libraryFile';
import { importFolderTree, treeLimit } from './libraryTreeImport';
import { MAX_LIBRARY_FOLDERS, MAX_LIBRARY_FOLDER_DEPTH, MAX_LIBRARY_ITEMS } from './libraryTypes';

const cutout: Cutout = {
  id: 'a',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};
const content = { params: { cutouts: [cutout] } };

const tree: LibraryFolderTree = {
  name: 'Tools',
  folders: [
    { id: 'drivers', name: 'Drivers', parentId: null },
    { id: 'bits', name: '', parentId: 'drivers' },
  ],
  items: [
    { name: 'Wrench', folderId: null, content },
    { name: 'Hex bit', folderId: 'bits', content },
  ],
};

/** A chain of `levels` folders, each inside the one before. */
function chain(levels: number): LibraryFolderTree['folders'] {
  return Array.from({ length: levels }, (_, i) => ({
    id: `f${i}`,
    name: `Level ${i + 1}`,
    parentId: i === 0 ? null : `f${i - 1}`,
  }));
}

const fallbacks = { folder: 'New folder', item: 'Cutout' };

describe('treeLimit', () => {
  const empty = { items: 0, folders: 0 };

  it('passes a tree that fits', () => {
    expect(treeLimit(tree, empty)).toBeNull();
  });

  it('names the limit a tree would pass', () => {
    expect(treeLimit(tree, { items: MAX_LIBRARY_ITEMS - 1, folders: 0 })).toBe('items');
    expect(treeLimit(tree, { items: 0, folders: MAX_LIBRARY_FOLDERS - 2 })).toBe('folders');
    expect(treeLimit({ ...tree, folders: chain(MAX_LIBRARY_FOLDER_DEPTH - 1) }, empty)).toBeNull();
    expect(treeLimit({ ...tree, folders: chain(MAX_LIBRARY_FOLDER_DEPTH) }, empty)).toBe('depth');
  });
});

describe('importFolderTree', () => {
  beforeEach(async () => {
    // The tab channel reaches every test worker in the process, so another
    // file's writes would count as reloads here.
    vi.stubGlobal('BroadcastChannel', undefined);
    closeLibraryDb();
    __resetForTests();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-cutout-library-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('could not delete the test database'));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds the tree under a new top-level folder, with fresh ids', async () => {
    const events = vi.fn();
    const changes = vi.fn();
    subscribe(events);
    subscribeChanges(changes);

    const imported = expectOk(await importFolderTree(tree, fallbacks));

    expect(imported).toMatchObject({ items: 2, folders: 2 });
    const folders = await listFolders();
    const byName = new Map(folders.map((f) => [f.name, f]));
    const root = imported.folder;
    expect(root).toMatchObject({ name: 'Tools', parentId: null });
    expect(byName.get('Drivers')?.parentId).toBe(root.id);
    // The unnamed subfolder takes the fallback name.
    expect(byName.get('New folder')?.parentId).toBe(byName.get('Drivers')?.id);
    expect(folders.every((f) => f.id.startsWith('cfold_'))).toBe(true);

    const items = await listItems();
    expect(items.map((i) => [i.name, i.folderId])).toEqual([
      ['Hex bit', byName.get('New folder')?.id],
      ['Wrench', root.id],
    ]);
    expect(events).toHaveBeenCalledTimes(5);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the tree would pass a limit', async () => {
    const deep = { ...tree, folders: chain(MAX_LIBRARY_FOLDER_DEPTH) };
    const result = await importFolderTree(deep, fallbacks);
    expect(isErr(result) && result.error.code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(await listFolders()).toEqual([]);
    expect(await listItems()).toEqual([]);
  });

  it('counts the folders the library already holds', async () => {
    for (let i = 0; i < MAX_LIBRARY_FOLDERS - 2; i++) {
      expectOk(await createFolder(`Folder ${i}`, null));
    }
    const result = await importFolderTree(tree, fallbacks);
    expect(isErr(result)).toBe(true);
    expect(await listFolders()).toHaveLength(MAX_LIBRARY_FOLDERS - 2);
  });
});
