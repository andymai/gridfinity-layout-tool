// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { layoutId } from '@/core/types';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import { err, isOk, storageUnavailable } from '@/core/result';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import {
  saveDesign,
  loadDesign,
  updateDesignParams,
  closeBaseplateDb,
} from '@/features/baseplate/storage/BaseplateStorage';
import type * as BaseplateStorageModule from '@/features/baseplate/storage/BaseplateStorage';
import { useBaseplatePageStore } from '@/features/baseplate/store/baseplatePageStore';
import { clearPreviewCanvas, setPreviewCanvas } from '@/features/baseplate/utils/thumbnail';
import { useBaseplateAutoSave } from './useBaseplateAutoSave';

vi.mock('@/features/baseplate/storage/BaseplateStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof BaseplateStorageModule>();
  return { ...actual, updateDesignParams: vi.fn(actual.updateDesignParams) };
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
const edited: StoredBaseplateParams = {
  ...params,
  paddingBack: 21 as StoredBaseplateParams['paddingBack'],
};

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

describe('useBaseplateAutoSave', () => {
  beforeEach(async () => {
    resetAllStores();
    localStorage.clear();
    await clearDb();
  });

  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
    closeBaseplateDb();
  });

  it('writes a pending edit at once when the tab is hidden', async () => {
    const id = await linkedLayout();
    const { unmount } = renderHook(() => useBaseplateAutoSave());
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    try {
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));

      await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 500 });
    } finally {
      delete (document as { visibilityState?: unknown }).visibilityState;
      if (visibility) Object.defineProperty(Document.prototype, 'visibilityState', visibility);
      unmount();
    }
  });

  it('writes the edit to the library at the debounce, without waiting for the preview', async () => {
    const id = await linkedLayout();
    const { unmount } = renderHook(() => useBaseplateAutoSave());
    try {
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });

      await waitFor(async () => expect(await storedParams(id)).toEqual(edited), {
        timeout: 1800,
      });
    } finally {
      unmount();
    }
  });

  it('writes the previous design’s edit when the design is switched inside the debounce', async () => {
    const id = await linkedLayout();
    const other = await saveDesign({ name: 'Baseplate 2', params, thumbnail: null });
    if (!isOk(other)) throw new Error('saveDesign failed');
    const { unmount } = renderHook(() => useBaseplateAutoSave());
    try {
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });
      act(() => {
        useLayoutStore.getState().setActiveBaseplateLocal(other.value.id, other.value.params);
      });

      await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 500 });
      expect(await storedParams(other.value.id)).toEqual(params);
    } finally {
      unmount();
    }
  });

  it('writes a pending edit when it unmounts', async () => {
    const id = await linkedLayout();
    const { unmount } = renderHook(() => useBaseplateAutoSave());
    act(() => {
      useLayoutStore.getState().setBaseplateParams(edited);
    });
    unmount();

    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 500 });
  });

  it('keeps a hidden-tab edit pending when its write fails, so the next flush lands it', async () => {
    const id = await linkedLayout();
    vi.mocked(updateDesignParams).mockResolvedValueOnce(
      err(storageUnavailable('indexedDB', new Error('quota')))
    );
    const { unmount } = renderHook(() => useBaseplateAutoSave());
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    try {
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      await waitFor(() => expect(updateDesignParams).toHaveBeenCalledTimes(1));
    } finally {
      delete (document as { visibilityState?: unknown }).visibilityState;
      if (visibility) Object.defineProperty(Document.prototype, 'visibilityState', visibility);
    }
    unmount();

    await waitFor(async () => expect(await storedParams(id)).toEqual(edited), { timeout: 500 });
  });

  it('stores a thumbnail of the settled preview after the settings', async () => {
    const id = await linkedLayout();
    const preview = document.createElement('canvas');
    preview.width = 800;
    preview.height = 600;
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      return contextId === '2d' && this !== preview ? ctx : null;
    } as typeof HTMLCanvasElement.prototype.getContext);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/webp;base64,settled'
    );
    setPreviewCanvas(preview);
    useBaseplatePageStore.getState().setGenerationStatus('complete');

    const { unmount } = renderHook(() => useBaseplateAutoSave());
    try {
      act(() => {
        useLayoutStore.getState().setBaseplateParams(edited);
      });

      await waitFor(
        async () => {
          const stored = await loadDesign(id);
          if (!isOk(stored)) throw new Error('loadDesign failed');
          expect(stored.value.params).toEqual(edited);
          expect(stored.value.thumbnail).toBe('data:image/webp;base64,settled');
        },
        { timeout: 2500 }
      );
    } finally {
      unmount();
    }
  });
});
