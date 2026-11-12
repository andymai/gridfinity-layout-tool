import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutRouting } from './useLayoutRouting';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { createLayoutEntry, loadLibraryAsync } from '@/core/storage';
import { clearAllData } from '@/core/storage/backends/indexedDB';
import { createDefaultLayout } from '@/core/constants';
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
    for (let round = 0; autosave.result.current === 'saving'; round++) {
      if (round > 100) throw new Error('autosave did not finish');
      await act(async () => {
        await loadLibraryAsync();
      });
    }

    expect(useLayoutStore.getState().activeLayoutId).toBe(b);
    expect(useLibraryStore.getState().library.activeLayoutId).toBe(b);
    expect(useLibraryStore.getState().library.entries.find((e) => e.id === a)?.name).toBe(
      'A edited'
    );
  });
});
