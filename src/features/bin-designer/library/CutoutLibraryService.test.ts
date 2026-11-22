// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { expectOk } from '@/test/testUtils';
import { isErr } from '@/core/result';
import { MAX_LIBRARY_FOLDER_DEPTH } from './libraryTypes';
import { closeLibraryDb } from './cutoutLibraryDb';
import {
  createFolder,
  createItem,
  deleteFolder,
  deleteItem,
  deleteRemoteFolder,
  getThumbnail,
  listFolders,
  listItems,
  putRemoteItem,
  putThumbnail,
  updateFolder,
  updateItem,
} from './CutoutLibraryService';
import { __resetForTests, subscribe, subscribeChanges } from './libraryEvents';
import type { CutoutLibraryContent } from './libraryTypes';

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
const content: CutoutLibraryContent = { params: { cutouts: [cutout] } };

describe('CutoutLibraryService', () => {
  beforeEach(async () => {
    closeLibraryDb();
    __resetForTests();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-cutout-library-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('could not delete the test database'));
    });
  });

  it('saves an item, announces it, and lists it by name', async () => {
    const events = vi.fn();
    subscribe(events);
    expectOk(await createItem({ name: '  Wrench  ', folderId: null, content }));
    expectOk(await createItem({ name: 'Allen keys', folderId: null, content }));
    const items = await listItems();
    expect(items.map((i) => i.name)).toEqual(['Allen keys', 'Wrench']);
    expect(items[0].id.startsWith('clib_')).toBe(true);
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ kind: 'item', type: 'put' }));
  });

  it('stamps an edit after the stored time, so it wins on every device', async () => {
    const item = expectOk(await createItem({ name: 'Wrench', folderId: null, content }));
    const renamed = expectOk(await updateItem(item.id, { name: 'Big wrench' }));
    expect(renamed.name).toBe('Big wrench');
    expect(Date.parse(renamed.updatedAt)).toBeGreaterThan(Date.parse(item.updatedAt));
  });

  it('deletes an item and its thumbnail, and announces the delete', async () => {
    const item = expectOk(await createItem({ name: 'Wrench', folderId: null, content }));
    await putThumbnail(item, 'data:image/png;base64,AAA');
    const events = vi.fn();
    subscribe(events);
    await deleteItem(item.id);
    expect(await listItems()).toEqual([]);
    expect(await getThumbnail(item)).toBeNull();
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ kind: 'item', type: 'delete' }));
  });

  it('keeps a thumbnail only for the version of the item it shows', async () => {
    const item = expectOk(await createItem({ name: 'Wrench', folderId: null, content }));
    await putThumbnail(item, 'data:image/png;base64,AAA');
    expect(await getThumbnail(item)).toBe('data:image/png;base64,AAA');
    const edited = expectOk(await updateItem(item.id, { content }));
    expect(await getThumbnail(edited)).toBeNull();
  });

  it('moves what a deleted folder held up to its parent', async () => {
    const outer = expectOk(await createFolder('Tools', null));
    const inner = expectOk(await createFolder('Sockets', outer.id));
    const item = expectOk(await createItem({ name: 'Socket', folderId: inner.id, content }));
    await deleteFolder(inner.id);
    expect((await listItems()).find((i) => i.id === item.id)?.folderId).toBe(outer.id);
    expect((await listFolders()).map((f) => f.id)).toEqual([outer.id]);
  });

  it('refuses a move that would put a folder inside itself', async () => {
    const outer = expectOk(await createFolder('Tools', null));
    const inner = expectOk(await createFolder('Sockets', outer.id));
    const moved = expectOk(await updateFolder(outer.id, { parentId: inner.id }));
    expect(moved.parentId).toBeNull();
  });

  it('returns an error, and does not throw, when the database refuses a write', async () => {
    const unclonable = {
      params: { cutouts: [{ ...cutout, label: (() => 'x') as unknown as string }] },
    };
    const result = await createItem({ name: 'Bad', folderId: null, content: unclonable });
    expect(isErr(result)).toBe(true);
    expect(await listItems()).toEqual([]);
  });

  it('refuses a move that would nest folders past the depth limit', async () => {
    let parent: string | null = null;
    for (let i = 0; i < MAX_LIBRARY_FOLDER_DEPTH; i++) {
      parent = expectOk(await createFolder(`Level ${i}`, parent)).id;
    }
    const loose = expectOk(await createFolder('Loose', null));
    const moved = await updateFolder(loose.id, { parentId: parent });
    expect(isErr(moved) && moved.error.code).toBe('STORAGE_QUOTA_EXCEEDED');
  });

  it('writes pulled changes without announcing them, and still tells views', async () => {
    const item = expectOk(await createItem({ name: 'Wrench', folderId: null, content }));
    const events = vi.fn();
    const changes = vi.fn();
    subscribe(events);
    subscribeChanges(changes);
    await putRemoteItem({ ...item, name: 'From another device' });
    const folder = expectOk(await createFolder('Tools', null));
    events.mockClear();
    await deleteRemoteFolder(folder.id);
    expect(events).not.toHaveBeenCalled();
    expect(changes).toHaveBeenCalled();
    expect((await listItems())[0].name).toBe('From another device');
  });
});
