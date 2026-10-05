// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store';
import { baseplateDesignId, layoutId } from '@/core/types';
import type { LayoutEntry, StoredBaseplateParams } from '@/core/types';
import { ownedCopyId } from '@/features/baseplate/utils/designOwnership';
import { err, isOk, storageUnavailable } from '@/core/result';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import {
  saveDesign,
  loadDesign,
  listDesigns,
  updateDesignParams,
  deleteDesign,
  closeBaseplateDb,
} from '@/features/baseplate/storage/BaseplateStorage';
import { loadRegistry } from '@/features/baseplate/store/baseplateRegistry';
import { useBaseplateLibraryInit } from './useBaseplateLibraryInit';
import type * as BaseplateStorageModule from '@/features/baseplate/storage/BaseplateStorage';

vi.mock('@/features/baseplate/storage/BaseplateStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof BaseplateStorageModule>();
  return {
    ...actual,
    updateDesignParams: vi.fn(actual.updateDesignParams),
    deleteDesign: vi.fn(actual.deleteDesign),
  };
});

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

  it('does not re-materialize over a newer inline edit on a later resolve', async () => {
    // Reproduces the unsaved-layout padding loss: an edit made after the design
    // was materialized (and not yet persisted) must survive a remount instead of
    // being clobbered by the stale library copy.
    const saved = await saveDesign({ name: 'Baseplate 1', params, thumbnail: null });
    if (!isOk(saved)) throw new Error('saveDesign failed');

    useLayoutStore
      .getState()
      .importLayout(
        createTestLayout({ baseplateParams: params, activeBaseplateId: saved.value.id })
      );

    // First resolve materializes the design (params already in sync).
    const first = renderHook(() => useBaseplateLibraryInit());
    await waitFor(() => {
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(saved.value.id);
    });
    first.unmount();

    // Local edit the library hasn't caught up to yet (debounce-pending).
    act(() => {
      useLayoutStore.getState().setActiveBaseplateLocal(saved.value.id, {
        ...params,
        paddingLeft: 12 as StoredBaseplateParams['paddingLeft'],
      });
    });

    // A second resolve (e.g. navigating back) must keep the newer inline edit.
    renderHook(() => useBaseplateLibraryInit());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useLayoutStore.getState().layout.baseplateParams?.paddingLeft).toBe(12);
  });

  it('still syncs a different layout that shares the same design', async () => {
    // The session guard is keyed by (layout, design), so one layout adopting a
    // design must not suppress another layout's required first sync of it.
    const saved = await saveDesign({
      name: 'Baseplate 1',
      params: { ...params, magnetHoles: true },
      thumbnail: null,
    });
    if (!isOk(saved)) throw new Error('saveDesign failed');

    // Layout A adopts the design first (already in sync).
    useLayoutStore.getState().importLayout(
      createTestLayout({
        baseplateParams: { ...params, magnetHoles: true },
        activeBaseplateId: saved.value.id,
      }),
      layoutId('layout-a')
    );
    const a = renderHook(() => useBaseplateLibraryInit());
    await waitFor(() => {
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(saved.value.id);
    });
    a.unmount();

    // Layout B shares the design but its inline params are stale.
    useLayoutStore.getState().importLayout(
      createTestLayout({
        baseplateParams: { ...params, magnetHoles: false },
        activeBaseplateId: saved.value.id,
      }),
      layoutId('layout-b')
    );
    renderHook(() => useBaseplateLibraryInit());

    // B's first resolve must still adopt the design's params.
    await waitFor(() => {
      expect(useLayoutStore.getState().layout.baseplateParams?.magnetHoles).toBe(true);
    });
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

  describe('a change made while the library read is in flight', () => {
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));
    const edited: StoredBaseplateParams = {
      ...params,
      paddingLeft: 5 as StoredBaseplateParams['paddingLeft'],
    };

    it('keeps a padding edit instead of re-materializing over it', async () => {
      const saved = await saveDesign({
        name: 'Baseplate 1',
        params: { ...params, paddingBack: 21 as StoredBaseplateParams['paddingBack'] },
        thumbnail: null,
      });
      if (!isOk(saved)) throw new Error('saveDesign failed');
      useLayoutStore
        .getState()
        .importLayout(
          createTestLayout({ baseplateParams: params, activeBaseplateId: saved.value.id })
        );

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });
      await settle();

      expect(useLayoutStore.getState().layout.baseplateParams).toEqual(edited);
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(saved.value.id);
    });

    it('keeps an edit the user undid back to its original value', async () => {
      const saved = await saveDesign({
        name: 'Baseplate 1',
        params: { ...params, paddingBack: 21 as StoredBaseplateParams['paddingBack'] },
        thumbnail: null,
      });
      if (!isOk(saved)) throw new Error('saveDesign failed');
      useLayoutStore
        .getState()
        .importLayout(
          createTestLayout({ baseplateParams: params, activeBaseplateId: saved.value.id })
        );

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
        useLayoutStore.getState().setBaseplateParams({ ...params });
      });
      await settle();

      expect(useLayoutStore.getState().layout.baseplateParams).toEqual(params);
    });

    it('keeps a design picked from the dropdown instead of reverting to the old one', async () => {
      const oldDesign = await saveDesign({
        name: 'Old',
        params: { ...params, magnetHoles: true },
        thumbnail: null,
      });
      const picked = await saveDesign({ name: 'Picked', params: edited, thumbnail: null });
      if (!isOk(oldDesign) || !isOk(picked)) throw new Error('saveDesign failed');
      useLayoutStore
        .getState()
        .importLayout(
          createTestLayout({ baseplateParams: params, activeBaseplateId: oldDesign.value.id })
        );

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().setActiveBaseplateLocal(picked.value.id, picked.value.params);
      });
      await settle();

      expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(picked.value.id);
      expect(useLayoutStore.getState().layout.baseplateParams).toEqual(edited);
    });

    it('keeps the edit when the design turns out to be deleted', async () => {
      useLayoutStore.getState().importLayout(
        createTestLayout({
          baseplateParams: params,
          activeBaseplateId: baseplateDesignId('baseplate_missing'),
        })
      );

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });

      await waitFor(() => {
        expect(useLayoutStore.getState().layout.activeBaseplateId).toBeNull();
      });
      expect(useLayoutStore.getState().layout.baseplateParams).toEqual(edited);
    });

    it('seeds the library with an edit made while the seed was being written', async () => {
      useLayoutStore.getState().importLayout(createTestLayout({ baseplateParams: params }));

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });

      await waitFor(() => {
        expect(useLayoutStore.getState().layout.activeBaseplateId).toBeTruthy();
      });
      const activeId = useLayoutStore.getState().layout.activeBaseplateId;
      if (!activeId) throw new Error('no active design');
      expect(useLayoutStore.getState().layout.baseplateParams).toEqual(edited);
      await waitFor(async () => {
        const stored = await loadDesign(activeId);
        if (!isOk(stored)) throw new Error('loadDesign failed');
        expect(stored.value.params).toEqual(edited);
      });
    });

    it('leaves the layout unlinked when the seed catch-up write fails', async () => {
      vi.mocked(updateDesignParams).mockResolvedValueOnce(
        err(storageUnavailable('indexedDB', new Error('quota')))
      );
      useLayoutStore.getState().importLayout(createTestLayout({ baseplateParams: params }));

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });

      await waitFor(async () => {
        const designs = await listDesigns();
        if (!isOk(designs)) throw new Error('listDesigns failed');
        expect(designs.value).toHaveLength(0);
      });
      expect(useLayoutStore.getState().layout.activeBaseplateId ?? null).toBeNull();
      expect(useLayoutStore.getState().layout.baseplateParams).toEqual(edited);
    });

    it('drops the seed when the layout loses its plate while the seed is written', async () => {
      useLayoutStore
        .getState()
        .importLayout(createTestLayout({ baseplateParams: params }), layoutId('layout-a'));

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().importLayout(createTestLayout(), layoutId('layout-a'));
      });

      await waitFor(async () => {
        const designs = await listDesigns();
        if (!isOk(designs)) throw new Error('listDesigns failed');
        expect(designs.value).toHaveLength(0);
      });
      expect(useLayoutStore.getState().layout.activeBaseplateId ?? null).toBeNull();
      expect(useLayoutStore.getState().layout.baseplateParams).toBeUndefined();
    });

    it('lists a discarded seed the delete could not remove', async () => {
      vi.mocked(updateDesignParams).mockResolvedValueOnce(
        err(storageUnavailable('indexedDB', new Error('quota')))
      );
      vi.mocked(deleteDesign).mockResolvedValueOnce(
        err(storageUnavailable('indexedDB', new Error('locked')))
      );
      useLayoutStore.getState().importLayout(createTestLayout({ baseplateParams: params }));

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });

      await waitFor(() => {
        expect(loadRegistry()).toHaveLength(1);
      });
      const designs = await listDesigns();
      if (!isOk(designs)) throw new Error('listDesigns failed');
      expect(designs.value.map((d) => d.id)).toEqual(loadRegistry().map((r) => r.id));
      expect(useLayoutStore.getState().layout.activeBaseplateId ?? null).toBeNull();
    });

    it('leaves the layout unlinked when edits outrun every catch-up write', async () => {
      const real = vi.mocked(updateDesignParams).getMockImplementation();
      if (!real) throw new Error('updateDesignParams is not wrapped');
      let n = 0;
      vi.mocked(updateDesignParams).mockImplementation((id, next, thumbnail) => {
        n += 1;
        useLayoutStore.getState().setBaseplateParams({
          ...params,
          paddingFront: n as StoredBaseplateParams['paddingFront'],
        });
        return real(id, next, thumbnail);
      });
      try {
        useLayoutStore.getState().importLayout(createTestLayout({ baseplateParams: params }));

        renderHook(() => useBaseplateLibraryInit());
        act(() => {
          useLayoutStore.getState().setBaseplateParams(edited);
        });

        await waitFor(async () => {
          const designs = await listDesigns();
          if (!isOk(designs)) throw new Error('listDesigns failed');
          expect(designs.value).toHaveLength(0);
        });
        expect(useLayoutStore.getState().layout.activeBaseplateId ?? null).toBeNull();
      } finally {
        vi.mocked(updateDesignParams).mockImplementation(real);
      }
    });

    it('stores a second edit made while the seed catch-up write is pending', async () => {
      const second: StoredBaseplateParams = {
        ...params,
        paddingRight: 9 as StoredBaseplateParams['paddingRight'],
      };
      const real = vi.mocked(updateDesignParams).getMockImplementation();
      if (!real) throw new Error('updateDesignParams is not wrapped');
      vi.mocked(updateDesignParams).mockImplementationOnce((id, next, thumbnail) => {
        useLayoutStore.getState().setBaseplateParams(second);
        return real(id, next, thumbnail);
      });
      useLayoutStore.getState().importLayout(createTestLayout({ baseplateParams: params }));

      renderHook(() => useBaseplateLibraryInit());
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });

      await waitFor(() => {
        expect(useLayoutStore.getState().layout.activeBaseplateId).toBeTruthy();
      });
      const activeId = useLayoutStore.getState().layout.activeBaseplateId;
      if (!activeId) throw new Error('no active design');
      expect(useLayoutStore.getState().layout.baseplateParams).toEqual(second);
      const stored = await loadDesign(activeId);
      if (!isOk(stored)) throw new Error('loadDesign failed');
      expect(stored.value.params).toEqual(second);
    });
  });

  describe('a design another layout also uses', () => {
    const entry = (id: string, name: string, createdAt: number, baseplateId: string) =>
      ({
        id: layoutId(id),
        name,
        createdAt,
        modifiedAt: createdAt,
        preview: {
          drawerWidth: 4,
          drawerDepth: 4,
          drawerHeight: 7,
          binCount: 0,
          layerCount: 1,
          baseplateId,
        },
      }) as LayoutEntry;
    const mine: StoredBaseplateParams = {
      ...params,
      paddingLeft: 7 as StoredBaseplateParams['paddingLeft'],
    };

    async function openLayout(openId: string): Promise<string> {
      const saved = await saveDesign({
        name: 'Baseplate 1',
        params: { ...params, paddingBack: 21 as StoredBaseplateParams['paddingBack'] },
        thumbnail: null,
      });
      if (!isOk(saved)) throw new Error('saveDesign failed');
      const library = useLibraryStore.getState().library;
      useLibraryStore.setState({
        library: {
          ...library,
          entries: [
            entry('layout-old', 'Kitchen', 1, saved.value.id),
            entry('layout-new', 'Garage', 2, saved.value.id),
          ],
        },
      });
      useLayoutStore.getState().importLayout(
        createTestLayout({
          name: openId === 'layout-old' ? 'Kitchen' : 'Garage',
          baseplateParams: mine,
          activeBaseplateId: saved.value.id,
        }),
        layoutId(openId)
      );
      renderHook(() => useBaseplateLibraryInit());
      return saved.value.id;
    }

    it('gives the newer layout its own copy of the settings it shows', async () => {
      const shared = await openLayout('layout-new');
      const copyId = ownedCopyId(layoutId('layout-new'), shared);

      await waitFor(() => {
        expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(copyId);
      });
      expect(useLayoutStore.getState().layout.baseplateParams).toEqual(mine);
      const copy = await loadDesign(copyId);
      if (!isOk(copy)) throw new Error('copy missing');
      expect(copy.value.name).toBe('Baseplate 1 (Garage)');
      expect(copy.value.params).toEqual(mine);
      const original = await loadDesign(baseplateDesignId(shared));
      if (!isOk(original)) throw new Error('original missing');
      expect(original.value.params.paddingBack).toBe(21);
    });

    it('leaves the oldest layout on the shared design', async () => {
      const shared = await openLayout('layout-old');

      await waitFor(() => {
        expect(useLayoutStore.getState().layout.baseplateParams?.paddingBack).toBe(21);
      });
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(shared);
    });
  });
});
