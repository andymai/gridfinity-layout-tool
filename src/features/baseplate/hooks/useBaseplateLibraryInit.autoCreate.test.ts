// @vitest-environment jsdom
/**
 * Auto-create behaviour, split from useBaseplateLibraryInit.test.ts.
 *
 * Its own file because vitest isolates per file: these tests assert on exact
 * library contents, and a connection left open by a neighbouring test blocks
 * `deleteDatabase`, hanging the shared `beforeEach`.
 */
import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { isOk } from '@/core/result';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import { listDesigns, closeBaseplateDb } from '@/features/baseplate/storage/BaseplateStorage';
import { useBaseplateLibraryInit } from './useBaseplateLibraryInit';

async function clearDb(): Promise<void> {
  closeBaseplateDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('gridfinity-baseplate-v1');
    req.onsuccess = () => resolve();
    // A connection lingering from a prior test would otherwise hang forever.
    req.onblocked = () => resolve();
    req.onerror = () => reject(new Error(req.error?.message ?? 'delete failed'));
  });
}

async function designCount(): Promise<number> {
  const designs = await listDesigns();
  if (!isOk(designs)) throw new Error('listDesigns failed');
  return designs.value.length;
}

const mounted: Array<() => void> = [];
function mount(options?: Parameters<typeof useBaseplateLibraryInit>[0]) {
  const { unmount } = renderHook(() => useBaseplateLibraryInit(options));
  mounted.push(unmount);
}

describe('useBaseplateLibraryInit — autoCreate', () => {
  beforeEach(async () => {
    resetAllStores();
    localStorage.clear();
    await clearDb();
  });

  afterEach(() => {
    // Unmount before the next clearDb, or the hook's connection blocks it.
    mounted.splice(0).forEach((unmount) => unmount());
    closeBaseplateDb();
  });

  it('creates a default design when the layout has no baseplate at all', async () => {
    useLayoutStore.getState().importLayout(createTestLayout());

    mount({ autoCreate: true });

    await waitFor(() => {
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBeTruthy();
    });
    expect(await designCount()).toBe(1);
  });

  // The planner mounts this hook too (BaseplateLibraryInitMount). Creating
  // there would mint an entry for every layout on load, whether or not its
  // owner ever opened the baseplate tool.
  it('creates nothing without the flag, so the planner mount stays inert', async () => {
    useLayoutStore.getState().importLayout(createTestLayout());

    mount();

    await new Promise((r) => setTimeout(r, 30));
    expect(await designCount()).toBe(0);
    expect(useLayoutStore.getState().layout.activeBaseplateId).toBeUndefined();
  });

  // Greptile flagged an orphan risk back when two hooks each created on mount;
  // creation is one hook's job now. The remaining realistic double-run is
  // StrictMode's dev double-invoke, which must still yield exactly one design.
  //
  // Two *simultaneous* mounts would still create two — `inProgress` is a
  // per-instance ref. That's fine: the planner and /baseplate mounts are
  // mutually exclusive by route (see BaseplateLibraryInitMount).
  it('creates exactly one design under StrictMode double-invoke', async () => {
    useLayoutStore.getState().importLayout(createTestLayout());

    const { unmount } = renderHook(() => useBaseplateLibraryInit({ autoCreate: true }), {
      wrapper: StrictMode,
    });
    mounted.push(unmount);

    await waitFor(() => {
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBeTruthy();
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(await designCount()).toBe(1);
  });

  // Load-time resolution must stay non-undoable, or Ctrl+Z "undoes" the act of
  // opening the page. This is why it writes via setActiveBaseplateLocal rather
  // than the CQRS command.
  it('does not make opening the page undoable', async () => {
    useLayoutStore.getState().importLayout(createTestLayout());

    mount({ autoCreate: true });
    await waitFor(() => {
      expect(useLayoutStore.getState().layout.activeBaseplateId).toBeTruthy();
    });

    expect(useHistoryStore.getState().past).toHaveLength(0);
  });
});
