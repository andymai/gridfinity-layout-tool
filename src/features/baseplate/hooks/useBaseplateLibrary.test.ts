// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store';
import { baseplateDesignId, layoutId } from '@/core/types';
import type { LayoutEntry, StoredBaseplateParams } from '@/core/types';
import { isOk } from '@/core/result';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import {
  listDesigns,
  loadDesign,
  saveDesign,
  closeBaseplateDb,
} from '@/features/baseplate/storage/BaseplateStorage';
import { ownedCopyId } from '@/features/baseplate/utils/designOwnership';
import { useBaseplateLibrary } from './useBaseplateLibrary';

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

describe('useBaseplateLibrary', () => {
  beforeEach(async () => {
    resetAllStores();
    localStorage.clear();
    await clearDb();
  });

  afterEach(() => {
    closeBaseplateDb();
  });

  it('forkActive detaches the active design into an unsaved draft holding copied params', async () => {
    useLayoutStore.getState().importLayout(
      createTestLayout({
        baseplateParams: params,
        activeBaseplateId: baseplateDesignId('bp-1'),
      })
    );

    const { result } = renderHook(() => useBaseplateLibrary());
    expect(result.current.activeBaseplateId).toBe('bp-1');

    act(() => {
      result.current.forkActive();
    });

    const layout = useLayoutStore.getState().layout;
    expect(layout.activeBaseplateId).toBeNull();
    expect(layout.baseplateParams).toEqual(params);
    expect(layout.baseplateParams).not.toBe(params);

    const designs = await listDesigns();
    if (!isOk(designs)) throw new Error('listDesigns failed');
    expect(designs.value).toHaveLength(0);
  });

  describe('switchActive', () => {
    const mine = layoutId('layout-mine');
    const entry = (id: string, name: string, baseplateId: string | null): LayoutEntry =>
      ({
        id: layoutId(id),
        name,
        createdAt: 1,
        modifiedAt: 1,
        preview: {
          drawerWidth: 4,
          drawerDepth: 4,
          drawerHeight: 7,
          binCount: 0,
          layerCount: 1,
          baseplateId,
        },
      }) as LayoutEntry;

    async function setUp(otherLink: string | null): Promise<string> {
      const picked = await saveDesign({
        name: 'Baseplate 2',
        params: { ...params, paddingBack: 21 as StoredBaseplateParams['paddingBack'] },
        thumbnail: null,
      });
      if (!isOk(picked)) throw new Error('saveDesign failed');
      useLayoutStore
        .getState()
        .importLayout(createTestLayout({ name: 'Kitchen', baseplateParams: params }), mine);
      const library = useLibraryStore.getState().library;
      useLibraryStore.setState({
        library: {
          ...library,
          entries: [
            entry('layout-mine', 'Kitchen', null),
            entry('layout-other', 'Garage', otherLink === 'picked' ? picked.value.id : otherLink),
          ],
        },
      });
      return picked.value.id;
    }

    it('links a design no other layout uses', async () => {
      const picked = await setUp(null);
      const { result } = renderHook(() => useBaseplateLibrary());

      await act(async () => {
        await result.current.switchActive(baseplateDesignId(picked));
      });

      expect(useLayoutStore.getState().layout.activeBaseplateId).toBe(picked);
    });

    it('gives this layout its own copy of a design another layout uses', async () => {
      const picked = await setUp('picked');
      const { result } = renderHook(() => useBaseplateLibrary());

      await act(async () => {
        await result.current.switchActive(baseplateDesignId(picked));
      });

      const copyId = ownedCopyId(mine, picked);
      const layout = useLayoutStore.getState().layout;
      expect(layout.activeBaseplateId).toBe(copyId);
      expect(layout.baseplateParams?.paddingBack).toBe(21);
      const copy = await loadDesign(copyId);
      if (!isOk(copy)) throw new Error('copy missing');
      expect(copy.value.name).toBe('Baseplate 2 (Kitchen)');
      const original = await loadDesign(baseplateDesignId(picked));
      if (!isOk(original)) throw new Error('original missing');
      expect(original.value.name).toBe('Baseplate 2');
    });
  });
});
