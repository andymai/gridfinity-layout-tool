import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutSwitcher } from './useLayoutSwitcher';
import { useAutoSave } from './useAutoSave';
import { useLayoutFolders } from './useLayoutFolders';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { connectLibraryPersistence, eventBus } from '@/core/cqrs';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { createLayoutEntry, layoutCopyName, loadLibraryAsync } from '@/core/storage';
import { clearAllData, getAllLayoutIds } from '@/core/storage/backends/indexedDB';
import { createDefaultLayout } from '@/core/constants';
import { expectOk, resetAllStores } from '@/test/testUtils';
import { layoutId as toLayoutId } from '@/core/types';
import type { CloudShareInfo, Layout, LayoutId, LayoutLibrary } from '@/core/types';
import type { SaveStatus } from '@/shared/types/saveStatus';

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackSnapshot: vi.fn(),
    trackQuality: vi.fn(),
    trackSession: vi.fn(),
  },
}));

function namedLayout(name: string): Layout {
  const layout = createDefaultLayout();
  layout.name = name;
  return layout;
}

async function seed(...names: string[]): Promise<LayoutId[]> {
  let library: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: toLayoutId(''),
    settings: {},
    entries: [],
  };
  const ids: LayoutId[] = [];
  for (const name of names) {
    const created = expectOk(
      await createLayoutEntry(namedLayout(name), library, { activate: ids.length === 0 })
    );
    library = created.library;
    ids.push(toLayoutId(created.layoutId));
  }
  useLibraryStore.getState().initLibrary(library);
  useLayoutStore.getState().importLayout(namedLayout(names[0]), ids[0], 'init');
  return ids;
}

interface LibraryState {
  store: string[];
  stored: string[];
  blobs: number;
}

/** The entry names the app shows, the entry names a reload shows, and the stored layouts. */
async function libraryState(): Promise<LibraryState> {
  const names = (library: LayoutLibrary | null): string[] =>
    (library?.entries ?? []).map((e) => e.name).sort();
  return {
    store: names(useLibraryStore.getState().library),
    stored: names(await loadLibraryAsync()),
    blobs: (await getAllLayoutIds()).length,
  };
}

function everywhere(names: string[]): LibraryState {
  const sorted = [...names].sort();
  return { store: sorted, stored: sorted, blobs: sorted.length };
}

// A write that saves the library without waiting for it lands a moment later.
async function untilStored(check: (library: LayoutLibrary | null) => void): Promise<void> {
  await act(async () => {
    await vi.waitFor(async () => {
      check(await loadLibraryAsync());
    });
  });
}

// Each round trip to IndexedDB lets pending storage work move on, inside act.
async function untilSaved(status: () => SaveStatus): Promise<void> {
  for (let round = 0; status() !== 'saved'; round++) {
    if (round > 100) throw new Error(`autosave did not finish: ${status()}`);
    await act(async () => {
      await loadLibraryAsync();
    });
  }
}

describe('useLayoutSwitcher library writes that overlap', () => {
  let disconnectLibraryPersistence = (): void => undefined;

  beforeEach(async () => {
    resetAllStores();
    await clearAllData();
    disconnectLibraryPersistence = connectLibraryPersistence(eventBus);
  });

  afterEach(() => {
    disconnectLibraryPersistence();
    vi.useRealTimers();
  });

  it('keeps both copies when two duplicates overlap', async () => {
    const [a, b] = await seed('A', 'B');
    const header = renderHook(() => useLayoutSwitcher());
    const layoutManager = renderHook(() => useLayoutSwitcher());

    await act(async () => {
      await Promise.all([
        header.result.current.duplicateLayout(a),
        layoutManager.result.current.duplicateLayout(b),
      ]);
    });

    expect(await libraryState()).toEqual(
      everywhere(['A', 'B', layoutCopyName('A'), layoutCopyName('B')])
    );
  });

  it('keeps the copy and the import when a duplicate and an import overlap', async () => {
    const [a] = await seed('A', 'B');
    const header = renderHook(() => useLayoutSwitcher());
    const layoutManager = renderHook(() => useLayoutSwitcher());

    await act(async () => {
      await Promise.all([
        header.result.current.duplicateLayout(a),
        layoutManager.result.current.importLayoutFromJSON(namedLayout('Imported')),
      ]);
    });

    expect(await libraryState()).toEqual(everywhere(['A', 'B', 'Imported', layoutCopyName('A')]));
  });

  it('removes the deleted layout and keeps the new one when a delete and a create overlap', async () => {
    const [, b] = await seed('A', 'B', 'C');
    const layoutManager = renderHook(() => useLayoutSwitcher());
    const keyboard = renderHook(() => useLayoutSwitcher());

    await act(async () => {
      await Promise.all([
        layoutManager.result.current.deleteLayout(b),
        keyboard.result.current.createNewLayout('New'),
      ]);
    });

    expect(await libraryState()).toEqual(everywhere(['A', 'C', 'New']));
  });

  it.each([
    ['starts during the copy', true],
    ['is in flight when the copy starts', false],
  ])('keeps the copy and the saved name when an autosave %s', async (_order, duplicateFirst) => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
    const [a, b] = await seed('A', 'B');
    const autosave = renderHook(() => useAutoSave());
    const layoutManager = renderHook(() => useLayoutSwitcher());

    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited'), a, 'local');
    });

    let duplicate: Promise<unknown> = Promise.resolve();
    act(() => {
      if (duplicateFirst) duplicate = layoutManager.result.current.duplicateLayout(b);
      // The debounce, then the idle fallback: the autosave reads the library here.
      vi.advanceTimersByTime(3000);
      if (!duplicateFirst) duplicate = layoutManager.result.current.duplicateLayout(b);
    });
    await act(async () => {
      await duplicate;
    });
    await untilSaved(() => autosave.result.current);

    expect(await libraryState()).toEqual(everywhere(['A edited', 'B', layoutCopyName('B')]));
  });

  it('keeps the import and the saved name when an autosave starts during the import', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
    const [a] = await seed('A', 'B');
    const autosave = renderHook(() => useAutoSave());
    const layoutManager = renderHook(() => useLayoutSwitcher());

    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited'), a, 'local');
    });

    let imported: Promise<unknown> = Promise.resolve();
    act(() => {
      imported = layoutManager.result.current.importLayoutFromJSON(namedLayout('Imported'));
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      await imported;
    });
    await untilSaved(() => autosave.result.current);

    expect(await libraryState()).toEqual(everywhere(['A edited', 'B', 'Imported']));
  });

  it('keeps a rename made while a copy is in flight', async () => {
    const [a, b] = await seed('A', 'B');
    const switcher = renderHook(() => useLayoutSwitcher());

    await act(async () => {
      const duplicate = switcher.result.current.duplicateLayout(a);
      switcher.result.current.renameLayout(b, 'B renamed');
      await duplicate;
    });
    await untilStored((library) => {
      expect(library?.entries.find((e) => e.id === b)?.name).toBe('B renamed');
    });

    expect(await libraryState()).toEqual(everywhere(['A', 'B renamed', layoutCopyName('A')]));
  });

  it('keeps a move into a folder made while a copy is in flight', async () => {
    const [a, b] = await seed('A', 'B');
    const switcher = renderHook(() => useLayoutSwitcher());
    const folders = renderHook(() => useLayoutFolders());
    let folderId = '';
    await act(async () => {
      folderId = (await folders.result.current.createFolder('Kitchen'))?.id ?? '';
    });

    await act(async () => {
      await Promise.all([
        switcher.result.current.duplicateLayout(a),
        folders.result.current.moveLayout(b, folderId),
      ]);
    });

    const folderOf = (library: LayoutLibrary | null): string | null | undefined =>
      library?.entries.find((e) => e.id === b)?.folderId;
    expect(folderOf(useLibraryStore.getState().library)).toBe(folderId);
    expect(folderOf(await loadLibraryAsync())).toBe(folderId);
    expect(await libraryState()).toEqual(everywhere(['A', 'B', layoutCopyName('A')]));
  });

  it('keeps a share recorded while a copy is in flight', async () => {
    const [a, b] = await seed('A', 'B');
    const switcher = renderHook(() => useLayoutSwitcher());
    const mutations = renderHook(() => useMutations());
    const share: CloudShareInfo = {
      id: 'share-b',
      deleteToken: 'token-b',
      sharedAt: 1,
      permission: 'view',
    };

    await act(async () => {
      const duplicate = switcher.result.current.duplicateLayout(a);
      mutations.result.current.setCloudShare(b, share);
      await duplicate;
    });
    const tokenOf = (library: LayoutLibrary | null): string | undefined =>
      library?.entries.find((e) => e.id === b)?.cloudShare?.deleteToken;
    await untilStored((library) => {
      expect(tokenOf(library)).toBe('token-b');
    });

    expect(tokenOf(useLibraryStore.getState().library)).toBe('token-b');
    expect(await libraryState()).toEqual(everywhere(['A', 'B', layoutCopyName('A')]));
  });
});
