import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutSwitcher } from './useLayoutSwitcher';
import { useAutoSave } from './useAutoSave';
import { useLayoutFolders } from './useLayoutFolders';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { connectLibraryPersistence, eventBus } from '@/core/cqrs';
import { layoutAdapter } from '@/core/sync/adapters/layoutAdapter';
import { LAYOUT_SCHEMA_VERSION } from '@/core/sync/payloadKey';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useToastStore } from '@/core/store/toast';
import { queueLibraryWrite } from '@/core/store/libraryWrites';
import {
  createLayoutEntry,
  layoutCopyName,
  loadLayoutAsync,
  loadLibraryAsync,
} from '@/core/storage';
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

/** Holds the library queue until the returned function runs. */
function holdQueue(): () => Promise<void> {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = queueLibraryWrite(() => gate);
  return async () => {
    release();
    await held;
  };
}

function pull(id: LayoutId, name: string): Promise<void> {
  return layoutAdapter.applyRemote({
    id,
    payload: namedLayout(name),
    modifiedAt: Date.now() + 60_000,
    schemaVersion: LAYOUT_SCHEMA_VERSION,
  });
}

// Lets storage work started outside the queue finish.
async function settleStorage(): Promise<void> {
  await loadLibraryAsync();
  await loadLibraryAsync();
}

async function storedName(id: LayoutId): Promise<string | undefined> {
  return (await loadLayoutAsync(id))?.name;
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
async function untilStatus(
  status: () => SaveStatus,
  done: (current: SaveStatus) => boolean
): Promise<void> {
  for (let round = 0; !done(status()); round++) {
    if (round > 100) throw new Error(`autosave did not finish: ${status()}`);
    await act(async () => {
      await loadLibraryAsync();
    });
  }
}

const untilSaved = (status: () => SaveStatus): Promise<void> =>
  untilStatus(status, (current) => current === 'saved');

function errorToasts(): string[] {
  return useToastStore
    .getState()
    .toasts.filter((toast) => toast.type === 'error')
    .map((toast) => toast.message);
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

  it('drops the autosave of the open layout when a delete removes it while the save waits', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
    const [a, b] = await seed('A', 'B');
    const autosave = renderHook(() => useAutoSave());
    const layoutManager = renderHook(() => useLayoutSwitcher());

    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited'), a, 'local');
    });
    let deleted: Promise<unknown> = Promise.resolve();
    act(() => {
      deleted = layoutManager.result.current.deleteLayout(a);
      // The autosave of A starts here, and waits for the delete.
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      await deleted;
    });
    await untilStatus(
      () => autosave.result.current,
      (current) => current !== 'saving'
    );

    expect(autosave.result.current).toBe('idle');
    expect(errorToasts()).toEqual([]);
    expect(useLayoutStore.getState().activeLayoutId).toBe(b);
    expect(await libraryState()).toEqual(everywhere(['B']));

    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('B edited'), b, 'local');
      vi.advanceTimersByTime(3000);
    });
    await untilSaved(() => autosave.result.current);

    expect(errorToasts()).toEqual([]);
    expect(await libraryState()).toEqual(everywhere(['B edited']));
  });

  it('keeps a rename that a switch saved when an older autosave of that layout runs after it', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
    const [a, b] = await seed('A', 'B');
    const autosave = renderHook(() => useAutoSave());
    const switcher = renderHook(() => useLayoutSwitcher());
    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited'), a, 'local');
    });

    const release = holdQueue();
    let switched: Promise<unknown> = Promise.resolve();
    act(() => {
      switcher.result.current.renameLayout(a, 'A renamed');
      switched = switcher.result.current.switchLayout(b);
      // The autosave of A reads A before the rename, and waits behind the switch.
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      await release();
      await switched;
    });
    await untilStatus(
      () => autosave.result.current,
      (current) => current !== 'saving'
    );

    expect(await storedName(a)).toBe('A renamed');
    expect(await libraryState()).toEqual(everywhere(['A renamed', 'B']));
  });

  it('saves the newest content of the open layout when its autosave waited for its turn', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
    const [a] = await seed('A', 'B');
    const autosave = renderHook(() => useAutoSave());
    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited'), a, 'local');
    });

    const release = holdQueue();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited again'), a, 'local');
    });
    await act(async () => {
      await release();
    });
    await untilSaved(() => autosave.result.current);

    expect(await storedName(a)).toBe('A edited again');
    expect(await libraryState()).toEqual(everywhere(['A edited again', 'B']));
    // The tab holds no unsaved edit, so closing it does not ask.
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('keeps the data of a pulled layout when a delete of it waits ahead of the pull', async () => {
    const [, a] = await seed('B', 'A');
    const switcher = renderHook(() => useLayoutSwitcher());

    const release = holdQueue();
    await act(async () => {
      const deleted = switcher.result.current.deleteLayout(a);
      const pulled = pull(a, 'A remote');
      await settleStorage();
      await release();
      await Promise.all([deleted, pulled]);
    });

    expect(await storedName(a)).toBe('A remote');
    expect(await libraryState()).toEqual(everywhere(['A remote', 'B']));
  });

  it('keeps the data of a pulled layout when a save and a switch of it wait ahead of the pull', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
    const [a, b] = await seed('A', 'B');
    const autosave = renderHook(() => useAutoSave());
    const switcher = renderHook(() => useLayoutSwitcher());
    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited'), a, 'local');
    });

    const release = holdQueue();
    let switched: Promise<unknown> = Promise.resolve();
    let pulled: Promise<void> = Promise.resolve();
    act(() => {
      vi.advanceTimersByTime(3000);
      switched = switcher.result.current.switchLayout(b);
      pulled = pull(a, 'A remote');
    });
    await act(async () => {
      await settleStorage();
      await release();
      await Promise.all([switched, pulled]);
    });
    await untilStatus(
      () => autosave.result.current,
      (current) => current !== 'saving'
    );

    expect(await storedName(a)).toBe('A remote');
    expect(await libraryState()).toEqual(everywhere(['A remote', 'B']));
  });
});
