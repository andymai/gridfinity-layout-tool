// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { baseplateDesignId, layoutId } from '@/core/types';
import type { StoredBaseplateParams } from '@/core/types';
import { isOk } from '@/core/result';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import {
  saveDesign,
  listDesigns,
  closeBaseplateDb,
} from '@/features/baseplate/storage/BaseplateStorage';
import { useBaseplateLibraryInit } from './useBaseplateLibraryInit';

const params: StoredBaseplateParams = {
  magnetHoles: false,
  magnetDiameter: 6 as StoredBaseplateParams['magnetDiameter'],
  magnetDepth: 2 as StoredBaseplateParams['magnetDepth'],
  paddingLeft: 0 as StoredBaseplateParams['paddingLeft'],
  paddingRight: 0 as StoredBaseplateParams['paddingRight'],
  paddingFront: 0 as StoredBaseplateParams['paddingFront'],
  paddingBack: 0 as StoredBaseplateParams['paddingBack'],
};

async function clearDb(): Promise<void> {
  closeBaseplateDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('gridfinity-baseplate-v1');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error(req.error?.message ?? 'delete failed'));
  });
}

describe('useBaseplateLibraryInit', () => {
  beforeEach(async () => {
    resetAllStores();
    localStorage.clear();
    await clearDb();
  });

  afterEach(() => {
    closeBaseplateDb();
  });

  it('auto-seeds a library design and points the layout at it', async () => {
    useLayoutStore.getState().importLayout(createTestLayout({ baseplateParams: params }));

    renderHook(() => useBaseplateLibraryInit());

    await waitFor(() => {
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBeTruthy();
    });

    const activeId = useLayoutStore.getState().layout.activeBaseplateId;
    const designs = await listDesigns();
    if (!isOk(designs)) throw new Error('listDesigns failed');
    expect(designs.value).toHaveLength(1);
    expect(designs.value[0].id).toBe(activeId);
  });

  it('orphans the pointer to null when the referenced design is gone', async () => {
    useLayoutStore.getState().importLayout(
      createTestLayout({
        baseplateParams: params,
        activeBaseplateId: baseplateDesignId('baseplate_missing'),
      })
    );

    renderHook(() => useBaseplateLibraryInit());

    await waitFor(() => {
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBeNull();
    });
    expect(useLayoutStore.getState().layout.baseplateParams).toEqual(params);
  });

  it('retains the pointer when the design read fails with a non-NOT_FOUND error', async () => {
    // Persist a record with corrupt params so loadDesign returns
    // STORAGE_CORRUPTED (not STORAGE_NOT_FOUND). The pointer must survive so a
    // later retry can resolve it once storage recovers.
    const saved = await saveDesign({
      name: 'Corrupt',
      params: [] as unknown as StoredBaseplateParams,
      thumbnail: null,
    });
    if (!isOk(saved)) throw new Error('saveDesign failed');

    useLayoutStore
      .getState()
      .importLayout(
        createTestLayout({ baseplateParams: params, activeBaseplateId: saved.value.id })
      );

    renderHook(() => useBaseplateLibraryInit());

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(saved.value.id);
    expect(useLayoutStore.getState().layout.baseplateParams).toEqual(params);
  });

  it('re-materializes the active design params on load', async () => {
    const saved = await saveDesign({
      name: 'Baseplate 1',
      params: { ...params, magnetHoles: true },
      thumbnail: null,
    });
    if (!isOk(saved)) throw new Error('saveDesign failed');

    useLayoutStore
      .getState()
      .importLayout(
        createTestLayout({ baseplateParams: params, activeBaseplateId: saved.value.id })
      );

    renderHook(() => useBaseplateLibraryInit());

    await waitFor(() => {
      expect(useLayoutStore.getState().layout.baseplateParams?.magnetHoles).toBe(true);
    });
    expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(saved.value.id);
  });

  it('does not stamp the seed onto a layout switched to mid-resolve', async () => {
    useLayoutStore
      .getState()
      .importLayout(createTestLayout({ baseplateParams: params }), layoutId('layout-a'));

    renderHook(() => useBaseplateLibraryInit());

    // Switch to a baseplate-free layout before the auto-seed's IndexedDB write
    // resolves. The in-flight resolution must not write its pointer here.
    act(() => {
      useLayoutStore.getState().importLayout(createTestLayout(), layoutId('layout-b'));
    });

    await waitFor(async () => {
      const designs = await listDesigns();
      if (!isOk(designs)) throw new Error('listDesigns failed');
      expect(designs.value).toHaveLength(1);
    });

    expect(useLayoutStore.getState().activeLayoutId).toBe(layoutId('layout-b'));
    expect(useLayoutStore.getState().layout.activeBaseplateId).toBeUndefined();
    expect(useLayoutStore.getState().layout.baseplateParams).toBeUndefined();
  });
});
