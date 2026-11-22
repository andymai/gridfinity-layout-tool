// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectOk } from '@/test/testUtils';
import { closeLibraryDb } from '@/features/bin-designer/library/cutoutLibraryDb';
import {
  createFolder,
  createItem,
  getItem,
  listFolders,
} from '@/features/bin-designer/library/CutoutLibraryService';
import { __resetForTests, subscribe } from '@/features/bin-designer/library/libraryEvents';
import type { CutoutLibraryContent } from '@/features/bin-designer/library/libraryTypes';
import { cutoutFolderAdapter, cutoutItemAdapter } from './cutoutLibraryAdapters';

const content: CutoutLibraryContent = {
  params: {
    cutouts: [
      {
        id: 'a',
        shape: 'rectangle',
        x: 0,
        y: 0,
        width: 20,
        depth: 10,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
      },
    ],
  },
};

describe('cutout library sync adapters', () => {
  beforeEach(async () => {
    closeLibraryDb();
    __resetForTests();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-cutout-library-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('could not delete the test database'));
    });
  });

  it('sends an item as its name, folder, creation time and content, stamped with its edit time', async () => {
    const item = expectOk(await createItem({ name: 'Tape', folderId: null, content }));
    const sent = await cutoutItemAdapter.get(item.id);
    expect(sent).toEqual({
      id: item.id,
      modifiedAt: Date.parse(item.updatedAt),
      payload: { name: 'Tape', folderId: null, createdAt: item.createdAt, content },
    });
    expect((await cutoutItemAdapter.list()).map((i) => i.id)).toEqual([item.id]);
  });

  it('writes a pulled item without announcing it, and takes its edit time from the envelope', async () => {
    const events = vi.fn();
    subscribe(events);
    await cutoutItemAdapter.applyRemote({
      id: 'clib_remote',
      modifiedAt: Date.parse('2026-11-22T12:00:00.000Z'),
      payload: { name: 'Pliers', folderId: null, createdAt: '2026-11-20T00:00:00.000Z', content },
    });
    expect(events).not.toHaveBeenCalled();
    expect((await getItem('clib_remote'))?.updatedAt).toBe('2026-11-22T12:00:00.000Z');
  });

  it('ignores a pulled item without cutouts', async () => {
    await cutoutItemAdapter.applyRemote({
      id: 'clib_bad',
      modifiedAt: 1,
      payload: { name: 'Bad', folderId: null, createdAt: '2026-11-20T00:00:00.000Z', content: {} },
    });
    expect(await getItem('clib_bad')).toBeNull();
    await cutoutItemAdapter.applyRemote({
      id: 'clib_sizeless',
      modifiedAt: 1,
      payload: {
        name: 'Sizeless',
        folderId: null,
        createdAt: '2026-11-20T00:00:00.000Z',
        content: { params: { cutouts: [{ shape: 'rectangle' }] } },
      },
    });
    expect(await getItem('clib_sizeless')).toBeNull();
  });

  it('forwards item writes to the item adapter only', async () => {
    const items = vi.fn();
    const folders = vi.fn();
    cutoutItemAdapter.subscribe(items);
    cutoutFolderAdapter.subscribe(folders);
    const item = expectOk(await createItem({ name: 'Tape', folderId: null, content }));
    expect(items).toHaveBeenCalledWith(expect.objectContaining({ kind: 'put', id: item.id }));
    expect(folders).not.toHaveBeenCalled();
  });

  it('puts a pulled folder at the top when its parent would close a loop here', async () => {
    const outer = expectOk(await createFolder('Tools', null));
    const inner = expectOk(await createFolder('Sockets', outer.id));
    await cutoutFolderAdapter.applyRemote({
      id: outer.id,
      modifiedAt: Date.now() + 1000,
      payload: { name: 'Tools', parentId: inner.id, createdAt: outer.createdAt },
    });
    expect((await listFolders()).find((f) => f.id === outer.id)?.parentId).toBeNull();
  });
});
