import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutRouting } from './useLayoutRouting';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { queueLibraryWrite } from '@/core/store/libraryWrites';
import { createLayoutEntry, loadLayoutAsync, loadLibraryAsync } from '@/core/storage';
import { clearAllData } from '@/core/storage/backends/indexedDB';
import { createDefaultLayout } from '@/core/constants';
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

// Each round trip to IndexedDB lets pending storage work move on, inside act.
async function untilNotSaving(status: () => SaveStatus): Promise<void> {
  for (let round = 0; status() === 'saving'; round++) {
    if (round > 100) throw new Error('autosave did not finish');
    await act(async () => {
      await loadLibraryAsync();
    });
  }
}

describe('useLayoutRouting while a library write is in flight', () => {
  beforeEach(async () => {
    resetAllStores();
    await clearAllData();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the layout it opened as the active layout when an autosave of the old one lands after it', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
    const [a, b] = await seed('A', 'B');
    const autosave = renderHook(() => useAutoSave());
    const routing = renderHook(() => useLayoutRouting());
    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited'), a, 'local');
    });

    await act(async () => {
      // The autosave of A starts its turn here, and reads the library.
      vi.advanceTimersByTime(3000);
      await routing.result.current.navigateToLayout(b);
    });
    await untilNotSaving(() => autosave.result.current);

    expect(useLayoutStore.getState().activeLayoutId).toBe(b);
    expect(useLibraryStore.getState().library.activeLayoutId).toBe(b);
    expect(useLibraryStore.getState().library.entries.find((e) => e.id === a)?.name).toBe(
      'A edited'
    );
  });

  // A pull replaces A, the URL then opens B, and an autosave that read A before
  // both waits behind them. Newer wins, as in sync: the pull's modifiedAt
  // against the time the autosave read A.
  async function pullThenNavigateWithWaitingAutosave(pullOffsetMs: number): Promise<{
    a: LayoutId;
    pulledAt: number;
    changes: AdapterChange[];
  }> {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'],
    });
    const [a, b] = await seed('A', 'B');
    const autosave = renderHook(() => useAutoSave());
    const routing = renderHook(() => useLayoutRouting());
    act(() => {
      useLayoutStore.getState().importLayout(namedLayout('A edited'), a, 'local');
    });
    const changes: AdapterChange[] = [];
    const unsubscribe = layoutAdapter.subscribe((change) => changes.push(change));

    const release = holdQueue();
    const pulledAt = Date.now() + pullOffsetMs;
    let pulled: Promise<void> = Promise.resolve();
    let navigated: Promise<boolean> = Promise.resolve(true);
    act(() => {
      pulled = layoutAdapter.applyRemote({
        id: a,
        payload: namedLayout('A remote'),
        modifiedAt: pulledAt,
        schemaVersion: LAYOUT_SCHEMA_VERSION,
      });
      navigated = routing.result.current.navigateToLayout(b);
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      await release();
      await Promise.all([pulled, navigated]);
    });
    await untilNotSaving(() => autosave.result.current);
    unsubscribe();
    return { a, pulledAt, changes };
  }

  it('drops the waiting autosave when the pulled copy is newer than its read', async () => {
    const { a, pulledAt, changes } = await pullThenNavigateWithWaitingAutosave(60_000);

    expect((await loadLayoutAsync(a))?.name).toBe('A remote');
    const entry = (await loadLibraryAsync())?.entries.find((e) => e.id === a);
    expect(entry?.name).toBe('A remote');
    expect(entry?.modifiedAt).toBe(pulledAt);
    expect(changes.filter((change) => change.id === a)).toEqual([]);
  });

  it('saves the waiting autosave, and sends it up, when its read is newer than the pulled copy', async () => {
    const { a, pulledAt, changes } = await pullThenNavigateWithWaitingAutosave(-60_000);

    expect((await loadLayoutAsync(a))?.name).toBe('A edited');
    const entry = (await loadLibraryAsync())?.entries.find((e) => e.id === a);
    expect(entry?.name).toBe('A edited');
    expect(entry?.modifiedAt).toBeGreaterThan(pulledAt);
    expect(changes.filter((change) => change.id === a)).toEqual([
      { kind: 'put', id: a, modifiedAt: entry?.modifiedAt },
    ]);
  });
});
