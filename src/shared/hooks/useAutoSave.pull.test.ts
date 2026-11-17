import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { createLayoutEntry, loadLibraryAsync } from '@/core/storage';
import { clearAllData } from '@/core/storage/backends/indexedDB';
import { createDefaultLayout } from '@/core/constants';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { layoutAdapter } from '@/core/sync/adapters/layoutAdapter';
import type { AdapterChange } from '@/core/sync/adapters/types';
import { LAYOUT_SCHEMA_VERSION } from '@/core/sync/payloadKey';
import type { SaveStatus } from '@/shared/types/saveStatus';
import { expectOk, resetAllStores } from '@/test/testUtils';
import { layoutId as toLayoutId } from '@/core/types';
import type { Layout, LayoutId, LayoutLibrary } from '@/core/types';

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: { trackSnapshot: vi.fn() },
}));

function namedLayout(name: string): Layout {
  const layout = createDefaultLayout();
  layout.name = name;
  return layout;
}

async function openSeeded(name: string): Promise<LayoutId> {
  const empty: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: toLayoutId(''),
    settings: {},
    entries: [],
  };
  const created = expectOk(await createLayoutEntry(namedLayout(name), empty, { activate: true }));
  const id = toLayoutId(created.layoutId);
  useLibraryStore.getState().initLibrary(created.library);
  useLayoutStore.getState().importLayout(namedLayout(name), id, 'init');
  return id;
}

async function settle(status: () => SaveStatus): Promise<void> {
  for (let round = 0; round < 20 || status() === 'saving'; round++) {
    if (round > 100) throw new Error('autosave did not finish');
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await loadLibraryAsync();
    });
  }
}

describe('useAutoSave after sync pulls the open layout', () => {
  beforeEach(async () => {
    resetAllStores();
    await clearAllData();
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['without baseplate params', (layout: Layout): Layout => layout],
    [
      'with baseplate params, which the store copies on import',
      (layout: Layout): Layout => ({ ...layout, baseplateParams: DEFAULT_BASEPLATE_PARAMS }),
    ],
  ])(
    'keeps the pulled modifiedAt and sends nothing back (%s)',
    async (_label, shape: (layout: Layout) => Layout) => {
      const id = await openSeeded('A');
      const autosave = renderHook(() => useAutoSave());
      await settle(() => autosave.result.current);
      const changes: AdapterChange[] = [];
      const unsubscribe = layoutAdapter.subscribe((change) => changes.push(change));

      // A stamp ahead of this device's clock, as from a device whose clock runs fast.
      const pulledAt = Date.now() + 5 * 60 * 60 * 1000;
      await act(async () => {
        await layoutAdapter.applyRemote({
          id,
          payload: shape(namedLayout('A remote')),
          modifiedAt: pulledAt,
          schemaVersion: LAYOUT_SCHEMA_VERSION,
        });
      });
      await settle(() => autosave.result.current);
      unsubscribe();

      expect(useLayoutStore.getState().layout.name).toBe('A remote');
      const entry = (await loadLibraryAsync())?.entries.find((e) => e.id === id);
      expect(entry?.modifiedAt).toBe(pulledAt);
      expect(changes).toEqual([]);
    }
  );

  it('stamps an edit after a pulled copy that is ahead of this clock', async () => {
    const id = await openSeeded('A');
    const autosave = renderHook(() => useAutoSave());
    await settle(() => autosave.result.current);
    const pulledAt = Date.now() + 5 * 60 * 60 * 1000;
    await act(async () => {
      await layoutAdapter.applyRemote({
        id,
        payload: namedLayout('A remote'),
        modifiedAt: pulledAt,
        schemaVersion: LAYOUT_SCHEMA_VERSION,
      });
    });
    await settle(() => autosave.result.current);
    const changes: AdapterChange[] = [];
    const unsubscribe = layoutAdapter.subscribe((change) => changes.push(change));

    act(() => {
      useLayoutStore.getState().setName('A edited');
    });
    await settle(() => autosave.result.current);
    unsubscribe();

    expect(changes).toEqual([{ kind: 'put', id, modifiedAt: pulledAt + 1 }]);
  });

  it('saves and sends an edit made after the pull', async () => {
    const id = await openSeeded('A');
    const autosave = renderHook(() => useAutoSave());
    await settle(() => autosave.result.current);
    const pulledAt = Date.now() - 60_000;
    await act(async () => {
      await layoutAdapter.applyRemote({
        id,
        payload: namedLayout('A remote'),
        modifiedAt: pulledAt,
        schemaVersion: LAYOUT_SCHEMA_VERSION,
      });
    });
    await settle(() => autosave.result.current);
    const changes: AdapterChange[] = [];
    const unsubscribe = layoutAdapter.subscribe((change) => changes.push(change));

    act(() => {
      useLayoutStore.getState().setName('A edited');
    });
    await settle(() => autosave.result.current);
    unsubscribe();

    const entry = (await loadLibraryAsync())?.entries.find((e) => e.id === id);
    expect(entry?.name).toBe('A edited');
    expect(entry?.modifiedAt).toBeGreaterThan(pulledAt);
    expect(changes).toEqual([{ kind: 'put', id, modifiedAt: entry?.modifiedAt }]);
  });
});
