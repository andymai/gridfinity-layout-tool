import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLibraryStore } from '@/core/store';
import type { LayoutFolder, LayoutId, LayoutLibrary } from '@/core/types';

const saveLibraryMock = vi.fn();
vi.mock('@/core/storage', () => ({
  saveLibrary: (lib: unknown) => saveLibraryMock(lib),
}));

import { folderAdapter } from './folderAdapter';
import type { AdapterChange } from './types';

function folder(id: string, modifiedAt: number, over: Partial<LayoutFolder> = {}): LayoutFolder {
  return { id, name: id, parentId: null, createdAt: 1, modifiedAt, ...over };
}

function setFolders(folders: LayoutFolder[] | undefined): void {
  const library: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: 'lay-1' as LayoutId,
    settings: {},
    entries: [],
    ...(folders ? { folders } : {}),
  };
  useLibraryStore.setState({ library });
}

beforeEach(() => {
  vi.clearAllMocks();
  saveLibraryMock.mockResolvedValue({ ok: true });
  setFolders([folder('folder_1_a', 1000, { name: 'Study' })]);
});

describe('folderAdapter.list / get', () => {
  it('lists each folder as name, parent and creation time', async () => {
    setFolders([folder('folder_1_a', 1000, { name: 'Study', color: '#ff8800' })]);
    expect(await folderAdapter.list()).toEqual([
      {
        id: 'folder_1_a',
        payload: { name: 'Study', parentId: null, color: '#ff8800', createdAt: 1 },
        modifiedAt: 1000,
      },
    ]);
    expect(await folderAdapter.get('folder_1_a')).not.toBeNull();
    expect(await folderAdapter.get('nope')).toBeNull();
  });

  it('lists nothing for a library without folders', async () => {
    setFolders(undefined);
    expect(await folderAdapter.list()).toEqual([]);
  });
});

describe('folderAdapter.applyRemote', () => {
  it('adds a folder the library has never seen, keeping the remote timestamps', async () => {
    await folderAdapter.applyRemote({
      id: 'folder_2_b',
      payload: { name: 'Desk', parentId: 'folder_1_a', createdAt: 5 },
      modifiedAt: 2000,
    });
    const desk = useLibraryStore.getState().library.folders?.find((f) => f.id === 'folder_2_b');
    expect(desk).toEqual({
      id: 'folder_2_b',
      name: 'Desk',
      parentId: 'folder_1_a',
      createdAt: 5,
      modifiedAt: 2000,
    });
    expect(saveLibraryMock).toHaveBeenCalledTimes(1);
  });

  it('updates an existing folder in place and keeps its local creation time', async () => {
    await folderAdapter.applyRemote({
      id: 'folder_1_a',
      payload: { name: 'Office', parentId: null, createdAt: 99 },
      modifiedAt: 3000,
    });
    const folders = useLibraryStore.getState().library.folders ?? [];
    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatchObject({ name: 'Office', createdAt: 1, modifiedAt: 3000 });
  });

  it('drops a payload without a usable name', async () => {
    await folderAdapter.applyRemote({
      id: 'folder_9_z',
      payload: { name: '  ' } as never,
      modifiedAt: 1,
    });
    expect(useLibraryStore.getState().library.folders).toHaveLength(1);
    expect(saveLibraryMock).not.toHaveBeenCalled();
  });

  it('does not echo the applied folder back through the listener', async () => {
    const seen: AdapterChange[] = [];
    const unsubscribe = folderAdapter.subscribe((c) => seen.push(c));
    await folderAdapter.applyRemote({
      id: 'folder_2_b',
      payload: { name: 'Desk', parentId: null, createdAt: 5 },
      modifiedAt: 2000,
    });
    await Promise.resolve();
    unsubscribe();
    expect(seen).toEqual([]);
  });
});

describe('folderAdapter.applyRemoteDelete', () => {
  it('removes the folder and leaves the rest of the library alone', async () => {
    setFolders([
      folder('folder_1_a', 1000),
      folder('folder_2_b', 1000, { parentId: 'folder_1_a' }),
    ]);
    await folderAdapter.applyRemoteDelete('folder_1_a');
    const folders = useLibraryStore.getState().library.folders ?? [];
    expect(folders.map((f) => f.id)).toEqual(['folder_2_b']);
    expect(folders[0].parentId).toBe('folder_1_a');
  });

  it('is a no-op for an unknown id', async () => {
    await folderAdapter.applyRemoteDelete('nope');
    expect(saveLibraryMock).not.toHaveBeenCalled();
  });
});

describe('folderAdapter.subscribe', () => {
  it('emits a put for a new or renamed folder and a delete for a removed one', () => {
    const seen: AdapterChange[] = [];
    const unsubscribe = folderAdapter.subscribe((c) => seen.push(c));
    setFolders([folder('folder_1_a', 1000), folder('folder_2_b', 1500)]);
    setFolders([folder('folder_1_a', 1200)]);
    unsubscribe();
    setFolders([]);
    expect(seen.map((c) => `${c.kind}:${c.id}:${c.kind === 'put' ? c.modifiedAt : ''}`)).toEqual([
      'put:folder_2_b:1500',
      'put:folder_1_a:1200',
      'delete:folder_2_b:',
    ]);
  });
});
