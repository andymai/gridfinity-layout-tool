import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndexedDBRecovery } from './useIndexedDBRecovery';
import { useLibraryStore } from '@/core/store/library';
import { queueLibraryWrite } from '@/core/store/libraryWrites';
import { loadLayoutAsync, saveLayoutAsync } from '@/core/storage';
import { clearAllData } from '@/core/storage/backends/indexedDB';
import { createDefaultLayout } from '@/core/constants';
import { expectOk, resetAllStores } from '@/test/testUtils';
import { gridUnits, heightUnits, layoutId } from '@/core/types';
import type { LayoutEntry } from '@/core/types';

function entry(id: string, name: string): LayoutEntry {
  return {
    id: layoutId(id),
    name,
    createdAt: 1,
    modifiedAt: 1,
    preview: {
      drawerWidth: gridUnits(10),
      drawerDepth: gridUnits(8),
      drawerHeight: heightUnits(6),
      binCount: 0,
      layerCount: 1,
    },
  };
}

describe('useIndexedDBRecovery with a library write in flight', () => {
  beforeEach(async () => {
    resetAllStores();
    await clearAllData();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the recovered name and the change of that write', async () => {
    const recovered = createDefaultLayout();
    recovered.name = 'Kitchen drawer';
    expectOk(await saveLayoutAsync('original-1', recovered));
    useLibraryStore.getState().setLibrary({
      version: '1.0',
      activeLayoutId: layoutId('placeholder'),
      settings: {},
      entries: [entry('placeholder', 'Recovered layout')],
    });

    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // This write read the library before the recovery, and adds a copy to it.
    const held = queueLibraryWrite(async (library) => {
      await gate;
      useLibraryStore
        .getState()
        .setLibrary({ ...library, entries: [...library.entries, entry('copy', 'Copy')] });
    });

    renderHook(() => useIndexedDBRecovery(true, ['original-1']));
    await act(async () => {
      // The idle fallback starts the recovery, which reads the layout back.
      vi.advanceTimersByTime(5000);
      await loadLayoutAsync('original-1');
      await loadLayoutAsync('original-1');
      release();
      await held;
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(useLibraryStore.getState().library.entries[0].name).toBe('Kitchen drawer');
      });
    });

    expect(useLibraryStore.getState().library.entries.map((e) => e.name)).toEqual([
      'Kitchen drawer',
      'Copy',
    ]);
  });
});
