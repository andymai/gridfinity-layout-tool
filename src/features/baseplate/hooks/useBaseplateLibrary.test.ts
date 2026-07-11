// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { baseplateDesignId } from '@/core/types';
import type { StoredBaseplateParams } from '@/core/types';
import { isOk } from '@/core/result';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import { listDesigns, closeBaseplateDb } from '@/features/baseplate/storage/BaseplateStorage';
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
});
