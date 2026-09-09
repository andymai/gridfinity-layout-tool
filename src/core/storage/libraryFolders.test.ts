import { describe, it, expect } from 'vitest';
import type { LayoutEntry, LayoutFolder, LayoutLibrary } from '@/core/types';
import { gridUnits, heightUnits, layoutId } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { expectErr, expectOk } from '@/test/testUtils';
import {
  childFolders,
  createFolder,
  deleteFolder,
  entriesInFolder,
  folderPath,
  isDescendantFolder,
  entryFolderId,
  liftContents,
  moveFolder,
  renameFolder,
  wouldLoop,
  setEntryFolder,
} from './libraryFolders';

function entry(id: string, folderId: string | null = null): LayoutEntry {
  return {
    id: layoutId(id),
    name: id,
    createdAt: 1,
    modifiedAt: 1,
    preview: {
      drawerWidth: gridUnits(4),
      drawerDepth: gridUnits(4),
      drawerHeight: heightUnits(7),
      binCount: 0,
      layerCount: 1,
    },
    ...(folderId ? { folderId } : {}),
  };
}

function folder(id: string, name: string, parentId: string | null = null): LayoutFolder {
  return { id, name, parentId, createdAt: 1, modifiedAt: 1 };
}

/** study/{desk,cupboard/{top}} with layouts a (root), b (desk), c (top). */
function library(): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: layoutId('a'),
    settings: {},
    entries: [entry('a'), entry('b', 'desk'), entry('c', 'top')],
    folders: [
      folder('study', 'Study'),
      folder('desk', 'Desk', 'study'),
      folder('cupboard', 'Cupboard', 'study'),
      folder('top', 'Top drawer', 'cupboard'),
    ],
  };
}

describe('folder queries', () => {
  it('lists a folder’s children in name order and the root’s top level', () => {
    expect(childFolders(library(), 'study').map((f) => f.name)).toEqual(['Cupboard', 'Desk']);
    expect(childFolders(library(), null).map((f) => f.id)).toEqual(['study']);
  });

  it('walks the path from the root to a folder', () => {
    expect(folderPath(library(), 'top').map((f) => f.id)).toEqual(['study', 'cupboard', 'top']);
    expect(folderPath(library(), null)).toEqual([]);
  });

  it('survives a parent cycle in stored data', () => {
    const lib = library();
    lib.folders = [folder('x', 'X', 'y'), folder('y', 'Y', 'x')];
    expect(folderPath(lib, 'x').length).toBeLessThanOrEqual(2);
  });

  it('knows descendants', () => {
    expect(isDescendantFolder(library(), 'top', 'study')).toBe(true);
    expect(isDescendantFolder(library(), 'desk', 'cupboard')).toBe(false);
    expect(isDescendantFolder(library(), 'study', 'study')).toBe(false);
  });

  it('lists the entries filed directly in a folder', () => {
    expect(entriesInFolder(library(), null).map((e) => e.id)).toEqual(['a']);
    expect(entriesInFolder(library(), 'top').map((e) => e.id)).toEqual(['c']);
  });
});

describe('createFolder', () => {
  it('mints an id, trims the name and files the folder under its parent', () => {
    const result = expectOk(createFolder(library(), '  Bathroom ', 'study', 5));
    expect(result.folder).toMatchObject({ name: 'Bathroom', parentId: 'study', createdAt: 5 });
    expect(result.folder.id).toMatch(/^folder_\d+_[a-z0-9]{1,8}$/);
    expect(result.library.folders?.map((f) => f.id)).toContain(result.folder.id);
  });

  it('starts a folder list on a library that never had one', () => {
    const lib = { ...library(), folders: undefined };
    const result = expectOk(createFolder(lib, 'Kitchen', null, 5));
    expect(result.library.folders).toHaveLength(1);
  });

  it('refuses an empty name, a missing parent and a full library', () => {
    expectErr(createFolder(library(), '   ', null, 5));
    expectErr(createFolder(library(), 'X', 'nope', 5));
    const full = library();
    full.folders = Array.from({ length: CONSTRAINTS.FOLDERS_MAX }, (_, i) =>
      folder(`f${i}`, `F${i}`)
    );
    expectErr(createFolder(full, 'X', null, 5));
  });

  it('caps the name at the folder limit', () => {
    const long = 'x'.repeat(CONSTRAINTS.FOLDER_NAME_MAX_LENGTH + 10);
    const result = expectOk(createFolder(library(), long, null, 5));
    expect(result.folder.name).toHaveLength(CONSTRAINTS.FOLDER_NAME_MAX_LENGTH);
  });
});

describe('renameFolder', () => {
  it('renames and bumps modifiedAt', () => {
    const lib = expectOk(renameFolder(library(), 'desk', 'Standing desk', 9));
    expect(lib.folders?.find((f) => f.id === 'desk')).toMatchObject({
      name: 'Standing desk',
      modifiedAt: 9,
    });
  });

  it('refuses an unknown folder and an empty name', () => {
    expectErr(renameFolder(library(), 'nope', 'X', 9));
    expectErr(renameFolder(library(), 'desk', ' ', 9));
  });
});

describe('moveFolder', () => {
  it('reparents a folder, to another folder or to the root', () => {
    const lib = expectOk(moveFolder(library(), 'top', 'desk', 9));
    expect(folderPath(lib, 'top').map((f) => f.id)).toEqual(['study', 'desk', 'top']);
    const rooted = expectOk(moveFolder(lib, 'top', null, 10));
    expect(folderPath(rooted, 'top').map((f) => f.id)).toEqual(['top']);
  });

  it('refuses to move a folder into itself or its own subtree', () => {
    expectErr(moveFolder(library(), 'study', 'study', 9));
    expectErr(moveFolder(library(), 'study', 'top', 9));
    expectErr(moveFolder(library(), 'study', 'nope', 9));
  });
});

describe('deleteFolder', () => {
  it('lifts the folder’s subfolders and layouts to its parent', () => {
    const { library: lib, movedLayoutIds } = expectOk(deleteFolder(library(), 'cupboard', 9));
    expect(lib.folders?.map((f) => f.id)).toEqual(['study', 'desk', 'top']);
    expect(lib.folders?.find((f) => f.id === 'top')?.parentId).toBe('study');
    expect(movedLayoutIds).toEqual([]);
    const deeper = expectOk(deleteFolder(lib, 'top', 10));
    expect(deeper.movedLayoutIds).toEqual([layoutId('c')]);
    expect(deeper.library.entries.find((e) => e.id === 'c')).toMatchObject({
      folderId: 'study',
      modifiedAt: 10,
    });
  });

  it('lifts to the root when the folder was top level', () => {
    const { library: lib } = expectOk(deleteFolder(library(), 'study', 9));
    expect(childFolders(lib, null).map((f) => f.id)).toEqual(['cupboard', 'desk']);
    expect(folderPath(lib, 'top').map((f) => f.id)).toEqual(['cupboard', 'top']);
  });

  it('refuses an unknown folder', () => {
    expectErr(deleteFolder(library(), 'nope', 9));
  });
});

describe('setEntryFolder', () => {
  it('files a layout and bumps its modifiedAt so the move syncs', () => {
    const lib = expectOk(setEntryFolder(library(), layoutId('a'), 'desk', 9));
    expect(lib.entries.find((e) => e.id === 'a')).toMatchObject({
      folderId: 'desk',
      modifiedAt: 9,
    });
  });

  it('moves a layout back to the root', () => {
    const lib = expectOk(setEntryFolder(library(), layoutId('b'), null, 9));
    expect(lib.entries.find((e) => e.id === 'b')?.folderId).toBeNull();
  });

  it('refuses an unknown layout or folder', () => {
    expectErr(setEntryFolder(library(), layoutId('zzz'), 'desk', 9));
    expectErr(setEntryFolder(library(), layoutId('a'), 'nope', 9));
  });
});

describe('dangling references', () => {
  it('reads a layout or folder whose folder vanished as sitting at the root', () => {
    const lib = library();
    lib.entries.push(entry('d', 'gone'));
    lib.folders?.push(folder('orphan', 'Orphan', 'gone'));
    expect(entriesInFolder(lib, null).map((e) => e.id)).toEqual(['a', 'd']);
    expect(entryFolderId(lib, lib.entries[3])).toBeNull();
    expect(childFolders(lib, null).map((f) => f.id)).toEqual(['orphan', 'study']);
    // The stored reference survives, so the folder resolves once it arrives.
    expect(lib.entries[3].folderId).toBe('gone');
  });
});

describe('wouldLoop', () => {
  it('follows parent pointers through a folder the library does not have yet', () => {
    const lib = library();
    // A's parent M is unknown here; filing M under A would still close a loop.
    lib.folders?.push(folder('a', 'A', 'missing'));
    expect(wouldLoop(lib, 'missing', 'a')).toBe(true);
    expect(wouldLoop(lib, 'a', 'a')).toBe(true);
    expect(wouldLoop(lib, 'a', 'study')).toBe(false);
    expect(wouldLoop(lib, 'kitchen', null)).toBe(false);
  });
});

describe('liftContents', () => {
  it('lifts to the root when stored data already loops through the parent', () => {
    const lib = library();
    lib.folders = [folder('x', 'X', 'y'), folder('y', 'Y', 'x')];
    lib.entries = [entry('a', 'x'), entry('b', 'y')];
    const lifted = liftContents(lib, lib.folders[0], 9);
    expect(lifted.library.folders?.find((f) => f.id === 'y')?.parentId).toBeNull();
    expect(lifted.library.entries.find((e) => e.id === 'a')?.folderId).toBeNull();
  });

  it('keeps every timestamp when mirroring a delete made elsewhere', () => {
    const lib = library();
    const lifted = liftContents(lib, folder('cupboard', 'Cupboard', 'study'), null);
    expect(lifted.library.folders?.find((f) => f.id === 'top')).toMatchObject({
      parentId: 'study',
      modifiedAt: 1,
    });
  });
});
