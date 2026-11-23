// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { commandBus, createCommand, _resetUndoCaptureState } from '@/core/cqrs';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { useLayoutStore } from '@/core/store/layout';
import { isOk } from '@/core/result';
import { layoutId, mm } from '@/core/types';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import {
  saveDesign,
  loadDesign,
  updateDesignParams,
  closeBaseplateDb,
} from '@/features/baseplate/storage/BaseplateStorage';
import type * as BaseplateStorageModule from '@/features/baseplate/storage/BaseplateStorage';
import { usePlannerBaseplateWriteBack } from './usePlannerBaseplateWriteBack';

vi.mock('@/features/baseplate/storage/BaseplateStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof BaseplateStorageModule>();
  return { ...actual, updateDesignParams: vi.fn(actual.updateDesignParams) };
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
    vi.mocked(updateDesignParams).mockClear();
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

    expect(updateDesignParams).not.toHaveBeenCalled();
    expect(await storedParams(id)).toEqual(params);
  });

  it('writes nothing for an undo that leaves the plate as saved', async () => {
    await linkedLayout();
    renderHook(() => usePlannerBaseplateWriteBack());
    act(() => {
      commandBus.dispatch(createCommand('layout.setName', { name: 'Kitchen' }));
    });

    act(() => useHistoryStore.getState().undo());
    await settle();

    expect(updateDesignParams).not.toHaveBeenCalled();
  });

  it('writes a pending edit at once when the planner closes', async () => {
    const id = await linkedLayout();
    const { unmount } = renderHook(() => usePlannerBaseplateWriteBack());
    setPlate(edited);

    unmount();

    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 500 });
  });
});
