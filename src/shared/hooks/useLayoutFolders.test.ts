import { describe, it, expect, beforeEach, vi } from 'vitest';
import type * as Storage from '@/core/storage';
import { renderHook, act } from '@testing-library/react';
import { useLibraryStore } from '@/core/store/library';
import { useToastStore } from '@/core/store/toast';
import type { LayoutEntry, LayoutLibrary } from '@/core/types';
import { gridUnits, heightUnits, layoutId } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';
import * as storage from '@/core/storage';
import { useLayoutFolders } from './useLayoutFolders';

vi.mock('@/core/storage', async (orig) => {
  const actual = await orig<typeof Storage>();
  return { ...actual, saveLibrary: vi.fn().mockResolvedValue({ ok: true, value: undefined }) };
});

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
    folderId,
  };
}

const library: LayoutLibrary = {
  version: '1.0',
  activeLayoutId: layoutId('a'),
  settings: {},
  entries: [entry('a'), entry('b', 'study')],
  folders: [{ id: 'study', name: 'Study', parentId: null, createdAt: 1, modifiedAt: 1 }],
};

describe('useLayoutFolders', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useLibraryStore.setState({ library: structuredClone(library) });
  });

  it('creates a folder, stores it and saves the library', async () => {
    const { result } = renderHook(() => useLayoutFolders());
    let created: Awaited<ReturnType<typeof result.current.createFolder>> = null;
    await act(async () => {
      created = await result.current.createFolder('Desk', 'study');
    });
    expect(created).toMatchObject({ name: 'Desk', parentId: 'study' });
    expect(result.current.folders.map((f) => f.name)).toEqual(['Study', 'Desk']);
    expect(storage.saveLibrary).toHaveBeenCalledTimes(1);
  });

  it('moves a layout and bumps it so the change syncs', async () => {
    const { result } = renderHook(() => useLayoutFolders());
    await act(async () => {
      await result.current.moveLayout(layoutId('a'), 'study');
    });
    const moved = useLibraryStore.getState().library.entries.find((e) => e.id === 'a');
    expect(moved?.folderId).toBe('study');
    expect(moved?.modifiedAt).toBeGreaterThan(1);
  });

  it('renames, moves and deletes folders', async () => {
    const { result } = renderHook(() => useLayoutFolders());
    await act(async () => {
      await result.current.createFolder('Desk', 'study');
    });
    const desk = result.current.folders.find((f) => f.name === 'Desk');
    await act(async () => {
      await result.current.renameFolder(desk?.id ?? '', 'Standing desk');
      await result.current.moveFolder(desk?.id ?? '', null);
    });
    expect(result.current.folders.find((f) => f.id === desk?.id)).toMatchObject({
      name: 'Standing desk',
      parentId: null,
    });
    await act(async () => {
      await result.current.deleteFolder('study');
    });
    expect(result.current.folders.map((f) => f.name)).toEqual(['Standing desk']);
    expect(
      useLibraryStore.getState().library.entries.find((e) => e.id === 'b')?.folderId
    ).toBeNull();
  });

  it('reports a failed save as a failure, after toasting', async () => {
    vi.mocked(storage.saveLibrary).mockResolvedValueOnce({
      ok: false,
      error: { kind: 'StorageError', code: 'STORAGE_UNAVAILABLE', message: 'x', timestamp: 0 },
    } as never);
    const { result } = renderHook(() => useLayoutFolders());
    let created: unknown = 'unset';
    await act(async () => {
      created = await result.current.createFolder('Desk', 'study');
    });
    expect(created).toBeNull();
    expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true);
    expect(useLibraryStore.getState().library.folders?.map((f) => f.name)).toEqual(['Study']);
  });

  it('keeps a library that changed while the failed save was in flight', async () => {
    let arrived: LayoutLibrary | null = null;
    vi.mocked(storage.saveLibrary).mockImplementationOnce(() => {
      const { library } = useLibraryStore.getState();
      arrived = {
        ...library,
        folders: [
          ...(library.folders ?? []),
          { id: 'folder_9_pulled', name: 'Pulled', parentId: null, createdAt: 1, modifiedAt: 1 },
        ],
      };
      useLibraryStore.setState({ library: arrived });
      return Promise.resolve({
        ok: false,
        error: { kind: 'StorageError', code: 'STORAGE_UNAVAILABLE', message: 'x', timestamp: 0 },
      } as never);
    });
    const { result } = renderHook(() => useLayoutFolders());
    await act(async () => {
      await result.current.createFolder('Desk', 'study');
    });
    expect(useLibraryStore.getState().library).toBe(arrived);
  });

  it('toasts instead of throwing when a rule refuses the change', async () => {
    const { result } = renderHook(() => useLayoutFolders());
    await act(async () => {
      await result.current.moveFolder('study', 'study');
    });
    expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true);
    expect(storage.saveLibrary).not.toHaveBeenCalled();
  });
});
