// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { commandBus, createCommand, _resetUndoCaptureState } from '@/core/cqrs';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { useLayoutStore } from '@/core/store/layout';
import { err, isOk, storageUnavailable } from '@/core/result';
import { layoutId, mm } from '@/core/types';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import {
  saveDesign,
  loadDesign,
  updateDesignParamsIfChanged,
  closeBaseplateDb,
} from '@/features/baseplate/storage/BaseplateStorage';
import type * as BaseplateStorageModule from '@/features/baseplate/storage/BaseplateStorage';
import { announceBaseplateSplit } from '@/features/baseplate/store/baseplateSplits';
import { usePlannerBaseplateWriteBack } from './usePlannerBaseplateWriteBack';

vi.mock('@/features/baseplate/storage/BaseplateStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof BaseplateStorageModule>();
  return {
    ...actual,
    updateDesignParamsIfChanged: vi.fn(actual.updateDesignParamsIfChanged),
  };
});

const params: StoredBaseplateParams = {
  magnetHoles: false,
  magnetDiameter: mm(6),
  magnetDepth: mm(2),
  paddingLeft: mm(0),
  paddingRight: mm(0),
  paddingFront: mm(0),
  paddingBack: mm(0),
};
const edited: StoredBaseplateParams = { ...params, paddingBack: mm(21) };

async function clearDb(): Promise<void> {
  closeBaseplateDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('gridfinity-baseplate-v1');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error(req.error?.message ?? 'delete failed'));
  });
}

async function storedParams(id: BaseplateDesignId): Promise<StoredBaseplateParams> {
  const loaded = await loadDesign(id);
  if (!isOk(loaded)) throw new Error('loadDesign failed');
  return loaded.value.params;
}

async function storedStamp(id: BaseplateDesignId): Promise<string> {
  const loaded = await loadDesign(id);
  if (!isOk(loaded)) throw new Error('loadDesign failed');
  return loaded.value.updatedAt;
}

async function linkedLayout(): Promise<BaseplateDesignId> {
  const saved = await saveDesign({ name: 'Baseplate 1', params, thumbnail: null });
  if (!isOk(saved)) throw new Error('saveDesign failed');
  useLayoutStore
    .getState()
    .importLayout(
      createTestLayout({ baseplateParams: params, activeBaseplateId: saved.value.id }),
      layoutId('layout-a')
    );
  return saved.value.id;
}

function setPlate(next: StoredBaseplateParams): void {
  act(() => {
    commandBus.dispatch(createCommand('layout.setBaseplateParams', { params: next }));
  });
}

function hideTab(): void {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
}

/** What the library init does when it gives the layout its own copy. */
function split(shared: BaseplateDesignId, copy: BaseplateDesignId, layout = 'layout-a'): void {
  act(() => {
    useLayoutStore.getState().setActiveBaseplateLocal(copy, edited);
    announceBaseplateSplit(layoutId(layout), shared);
  });
}

/** Holds the next planner write before it reaches storage's queue. */
async function holdNextWrite(): Promise<() => void> {
  const actual = await vi.importActual<typeof BaseplateStorageModule>(
    '@/features/baseplate/storage/BaseplateStorage'
  );
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(updateDesignParamsIfChanged).mockImplementationOnce(async (...args) => {
    await gate;
    return actual.updateDesignParamsIfChanged(...args);
  });
  return release;
}

/** Longer than the write delay, for the cases that must not write. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1300));
}

describe('usePlannerBaseplateWriteBack', () => {
  beforeEach(async () => {
    resetAllStores();
    useHistoryStore.getState().clear();
    _resetUndoCaptureState();
    localStorage.clear();
    await clearDb();
    vi.mocked(updateDesignParamsIfChanged).mockClear();
  });

  afterEach(() => {
    closeBaseplateDb();
  });

  it('saves a plate edit made on the planner to the active design', async () => {
    const id = await linkedLayout();
    renderHook(() => usePlannerBaseplateWriteBack());

    setPlate(edited);

    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 3000 });
  });

  it('saves an undo and a redo that change the plate, so a reload keeps them', async () => {
    const id = await linkedLayout();
    renderHook(() => usePlannerBaseplateWriteBack());
    setPlate(edited);
    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 3000 });

    act(() => useHistoryStore.getState().undo());
    await waitFor(async () => expect(await storedParams(id)).toEqual(params), { timeout: 3000 });

    act(() => useHistoryStore.getState().redo());
    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 3000 });
  });

  it('leaves the design alone when the params change without an edit', async () => {
    const id = await linkedLayout();
    renderHook(() => usePlannerBaseplateWriteBack());

    act(() => {
      useLayoutStore.getState().setActiveBaseplateLocal(id, edited);
    });
    await settle();

    expect(updateDesignParamsIfChanged).not.toHaveBeenCalled();
    expect(await storedParams(id)).toEqual(params);
  });

  it('writes nothing for an undo that leaves the plate as saved', async () => {
    const id = await linkedLayout();
    const before = await storedStamp(id);
    renderHook(() => usePlannerBaseplateWriteBack());
    act(() => {
      commandBus.dispatch(createCommand('layout.setName', { name: 'Kitchen' }));
    });

    act(() => useHistoryStore.getState().undo());
    await settle();

    expect(await storedStamp(id)).toBe(before);
  });

  it('writes nothing after an undo when the plate has an unchanged custom split', async () => {
    const split: StoredBaseplateParams = {
      ...params,
      splitOverride: { cols: [2, 2], rows: [3] },
    } as StoredBaseplateParams;
    const saved = await saveDesign({ name: 'Split plate', params: split, thumbnail: null });
    if (!isOk(saved)) throw new Error('saveDesign failed');
    const before = saved.value.updatedAt;
    useLayoutStore
      .getState()
      .importLayout(
        createTestLayout({ baseplateParams: split, activeBaseplateId: saved.value.id }),
        layoutId('layout-b')
      );
    renderHook(() => usePlannerBaseplateWriteBack());
    act(() => {
      commandBus.dispatch(createCommand('layout.setName', { name: 'Kitchen' }));
    });

    act(() => useHistoryStore.getState().undo());
    await settle();

    expect(await storedStamp(saved.value.id)).toBe(before);
  });

  it('keeps a failed write and tries it again when the tab is hidden', async () => {
    const id = await linkedLayout();
    renderHook(() => usePlannerBaseplateWriteBack());
    vi.mocked(updateDesignParamsIfChanged).mockResolvedValueOnce(
      err(storageUnavailable('indexedDB'))
    );
    setPlate(edited);
    await waitFor(() => expect(updateDesignParamsIfChanged).toHaveBeenCalledOnce(), {
      timeout: 3000,
    });
    expect(await storedParams(id)).toEqual(params);

    hideTab();

    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 1000 });
  });

  it('never retries an older failed write over a newer saved edit', async () => {
    const id = await linkedLayout();
    renderHook(() => usePlannerBaseplateWriteBack());
    const newer: StoredBaseplateParams = { ...params, paddingBack: mm(35) };
    let failOlder: (() => void) | null = null;
    vi.mocked(updateDesignParamsIfChanged).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          failOlder = () => resolve(err(storageUnavailable('indexedDB')));
        })
    );

    setPlate(edited);
    hideTab();
    await waitFor(() => expect(failOlder).not.toBeNull());
    setPlate(newer);
    hideTab();
    act(() => failOlder?.());
    await waitFor(async () => expect(await storedParams(id)).toEqual(newer), { timeout: 1000 });

    hideTab();
    await settle();
    expect(await storedParams(id)).toEqual(newer);
  });

  it('drops a pending write when the load moves the layout to its own copy', async () => {
    const id = await linkedLayout();
    const copy = await saveDesign({ name: 'Baseplate 1 (copy)', params: edited, thumbnail: null });
    if (!isOk(copy)) throw new Error('saveDesign failed');
    renderHook(() => usePlannerBaseplateWriteBack());
    setPlate(edited);

    // The init's split points the layout at its copy without a command.
    split(id, copy.value.id);
    await settle();

    expect(await storedParams(id)).toEqual(params);
  });

  it('keeps a split edit off the shared design when a design switch follows', async () => {
    const id = await linkedLayout();
    const copy = await saveDesign({ name: 'Baseplate 1 (copy)', params: edited, thumbnail: null });
    const other = await saveDesign({ name: 'Other', params, thumbnail: null });
    if (!isOk(copy) || !isOk(other)) throw new Error('saveDesign failed');
    renderHook(() => usePlannerBaseplateWriteBack());
    setPlate(edited);

    split(id, copy.value.id);
    act(() => {
      commandBus.dispatch(
        createCommand('layout.setActiveBaseplate', { designId: other.value.id, params })
      );
    });
    await settle();

    expect(await storedParams(id)).toEqual(params);
  });

  it('keeps a split edit off the shared design when another layout opens', async () => {
    const id = await linkedLayout();
    const copy = await saveDesign({ name: 'Baseplate 1 (copy)', params: edited, thumbnail: null });
    if (!isOk(copy)) throw new Error('saveDesign failed');
    renderHook(() => usePlannerBaseplateWriteBack());
    setPlate(edited);

    split(id, copy.value.id);
    act(() => {
      useLayoutStore
        .getState()
        .importLayout(
          createTestLayout({ baseplateParams: params, activeBaseplateId: id }),
          layoutId('layout-b')
        );
    });
    hideTab();
    await settle();
    expect(await storedParams(id)).toEqual(params);

    // An edit the other layout makes to the shared design still writes.
    const newer: StoredBaseplateParams = { ...params, paddingFront: mm(7) };
    setPlate(newer);
    await waitFor(async () => expect(await storedParams(id)).toEqual(newer), { timeout: 3000 });
  });

  it('calls off a write still waiting for storage when the split lands', async () => {
    const id = await linkedLayout();
    const copy = await saveDesign({ name: 'Baseplate 1 (copy)', params: edited, thumbnail: null });
    if (!isOk(copy)) throw new Error('saveDesign failed');
    renderHook(() => usePlannerBaseplateWriteBack());
    const release = await holdNextWrite();
    setPlate(edited);
    hideTab();

    split(id, copy.value.id);
    release();
    await settle();

    expect(await storedParams(id)).toEqual(params);
  });

  it('does not hold an edit to one design behind a slow write to another', async () => {
    await linkedLayout();
    const other = await saveDesign({ name: 'Other', params, thumbnail: null });
    if (!isOk(other)) throw new Error('saveDesign failed');
    renderHook(() => usePlannerBaseplateWriteBack());
    const release = await holdNextWrite();
    setPlate(edited);
    act(() => {
      commandBus.dispatch(
        createCommand('layout.setActiveBaseplate', { designId: other.value.id, params })
      );
    });
    const newer: StoredBaseplateParams = { ...params, paddingFront: mm(7) };
    setPlate(newer);
    hideTab();

    await waitFor(async () => expect(await storedParams(other.value.id)).toEqual(newer), {
      timeout: 1000,
    });
    release();
    await settle();
  });

  it("keeps the owner layout's edit when another layout edits the shared design before its split", async () => {
    const id = await linkedLayout();
    const copy = await saveDesign({ name: 'Baseplate 1 (copy)', params: edited, thumbnail: null });
    if (!isOk(copy)) throw new Error('saveDesign failed');
    renderHook(() => usePlannerBaseplateWriteBack());
    setPlate(edited);

    act(() => {
      useLayoutStore
        .getState()
        .importLayout(
          createTestLayout({ baseplateParams: params, activeBaseplateId: id }),
          layoutId('layout-b')
        );
    });
    setPlate({ ...params, paddingFront: mm(9) });
    split(id, copy.value.id, 'layout-b');

    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 3000 });
    await settle();
    expect(await storedParams(id)).toEqual(edited);
  });

  it('saves an undone edit to its design when an undone switch follows at once', async () => {
    const id = await linkedLayout();
    const other = await saveDesign({ name: 'Other', params, thumbnail: null });
    if (!isOk(other)) throw new Error('saveDesign failed');
    renderHook(() => usePlannerBaseplateWriteBack());
    act(() => {
      commandBus.dispatch(
        createCommand('layout.setActiveBaseplate', { designId: other.value.id, params })
      );
    });
    setPlate(edited);
    await waitFor(async () => expect(await storedParams(other.value.id)).toEqual(edited), {
      timeout: 3000,
    });

    // Both undos land inside one write delay.
    act(() => useHistoryStore.getState().undo());
    act(() => useHistoryStore.getState().undo());

    await waitFor(async () => expect(await storedParams(other.value.id)).toEqual(params), {
      timeout: 3000,
    });
    expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(id);
    // The undone switch schedules a write for the first design; let it land
    // before the database closes.
    await settle();
  });

  it('saves an edit to the design it was made on when a design switch follows', async () => {
    const id = await linkedLayout();
    const other = await saveDesign({ name: 'Other', params, thumbnail: null });
    if (!isOk(other)) throw new Error('saveDesign failed');
    renderHook(() => usePlannerBaseplateWriteBack());
    setPlate(edited);

    act(() => {
      commandBus.dispatch(
        createCommand('layout.setActiveBaseplate', { designId: other.value.id, params })
      );
    });

    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 500 });
    expect(await storedParams(other.value.id)).toEqual(params);
  });

  it('writes a pending edit at once when the planner closes', async () => {
    const id = await linkedLayout();
    const { unmount } = renderHook(() => usePlannerBaseplateWriteBack());
    setPlate(edited);

    unmount();

    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 500 });
  });
});
