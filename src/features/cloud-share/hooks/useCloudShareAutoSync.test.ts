import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloudShareAutoSync } from './useCloudShareAutoSync';
import { useOwnedShareSync } from './useOwnedShareSync';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import * as shareApi from '@/core/api/share';
import { ok, err, apiServerError } from '@/core/result';
import type { Layout } from '@/core/types';
import { binId, gridUnits, layoutId } from '@/core/types';
import { createTestBin, createTestLayout, createTestLibrary } from '@/test/testUtils';
import { stampFor, type RoomLinkStamp } from '@/shared/utils/roomLinkStamp';
import { roomSavesShare } from '@/features/cloud-share/utils';
import { __resetShareUploadsForTests } from '@/features/cloud-share/utils/shareUploads';

interface FakeRoot {
  layout: Layout;
  metadata: Record<string, unknown>;
}

const room = vi.hoisted(() => ({
  root: null as FakeRoot | null,
  canWrite: true,
}));

// Liveblocks memoizes a mutation on its deps (`[]` in the hook), so the fake
// keeps its first function: a new one on every render would re-run every
// effect that depends on it.
vi.mock('@/liveblocks.config', async () => {
  const { useState } = await import('react');
  return {
    useStorage: <T>(selector: (root: FakeRoot) => T): T | null =>
      room.root ? selector(room.root) : null,
    useMutation: (callback: (context: unknown, ...args: unknown[]) => unknown) =>
      useState(
        () =>
          (...args: unknown[]) =>
            callback(
              {
                storage: {
                  get: (key: keyof FakeRoot) => room.root?.[key],
                  set: (key: keyof FakeRoot, value: never) => {
                    if (room.root) room.root = { ...room.root, [key]: value };
                  },
                },
                self: { canWrite: room.canWrite },
              },
              ...args
            )
      )[0],
  };
});

vi.mock('@/core/api/share', () => ({
  updateShare: vi.fn(),
}));

const SHARE_ID = 'share-123';
const TOKEN = 'delete-token-xyz';
const SAVED_AT = '2026-11-01T10:00:00.000Z';
const NEXT_SAVE_AT = '2026-11-01T10:00:02.000Z';

function layoutWith(...ids: string[]): Layout {
  return createTestLayout({
    bins: ids.map((id, i) => createTestBin({ id: binId(id), x: gridUnits(i) })),
  });
}

function openRoom(layout: Layout, stamp: RoomLinkStamp): void {
  room.root = { layout, metadata: { ownerId: 'owner', permission: 'edit', version: 2, ...stamp } };
  useLayoutStore.setState({ layout, lastEditSource: 'init' });
}

function collaboratorEdits(layout: Layout): void {
  if (!room.root) throw new Error('room not open');
  room.root = { ...room.root, layout };
  useLayoutStore.setState({ layout, lastEditSource: 'remote' });
}

function savedResponse(lastUpdatedAt: string | undefined) {
  return ok({
    id: SHARE_ID,
    url: `https://example.com/l/${SHARE_ID}`,
    permission: 'edit' as const,
    ...(lastUpdatedAt ? { lastUpdatedAt } : {}),
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useCloudShareAutoSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    __resetShareUploadsForTests();
    room.root = null;
    room.canWrite = true;
    vi.mocked(shareApi.updateShare).mockResolvedValue(savedResponse(NEXT_SAVE_AT));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves a collaborator's edit to the link after the debounce", async () => {
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    const edited = layoutWith('saved', 'collab-edit');
    collaboratorEdits(edited);
    rerender();
    await advance(999);
    expect(shareApi.updateShare).not.toHaveBeenCalled();

    await advance(1);
    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    expect(shareApi.updateShare).toHaveBeenCalledWith(SHARE_ID, TOKEN, edited);
  });

  it('records the saved revision in the room, then does not save it again', async () => {
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    const edited = layoutWith('saved', 'collab-edit');
    collaboratorEdits(edited);
    rerender();
    await advance(1000);
    expect(room.root?.metadata).toEqual({
      ownerId: 'owner',
      permission: 'edit',
      version: 2,
      ...stampFor(edited, NEXT_SAVE_AT),
    });

    rerender();
    await advance(5000);
    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
  });

  it('does not upload when the owner opens a room the link already holds', async () => {
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));

    renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));
    await advance(5000);

    expect(shareApi.updateShare).not.toHaveBeenCalled();
  });

  it('saves edits the room received while the owner was away', async () => {
    const saved = layoutWith('saved');
    const edited = layoutWith('saved', 'made-while-away');
    openRoom(edited, stampFor(saved, SAVED_AT));

    renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));
    await advance(1000);

    expect(shareApi.updateShare).toHaveBeenCalledWith(SHARE_ID, TOKEN, edited);
  });

  it('saves a room that has no stamp yet, once', async () => {
    const legacy = layoutWith('legacy');
    openRoom(legacy, {});
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    await advance(1000);
    rerender();
    await advance(5000);

    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    expect(room.root?.metadata.linkFingerprint).toBe(stampFor(legacy, undefined).linkFingerprint);
  });

  it('never uploads without the owner token', async () => {
    const saved = layoutWith('saved');
    openRoom(layoutWith('saved', 'collab-edit'), stampFor(saved, SAVED_AT));

    renderHook(() => useCloudShareAutoSync(SHARE_ID, undefined));
    await advance(5000);

    expect(shareApi.updateShare).not.toHaveBeenCalled();
  });

  it('uploads a burst of room changes once, with the last layout', async () => {
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    collaboratorEdits(layoutWith('saved', 'a'));
    rerender();
    await advance(500);
    const last = layoutWith('saved', 'a', 'b');
    collaboratorEdits(last);
    rerender();
    await advance(1000);

    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    expect(shareApi.updateShare).toHaveBeenCalledWith(SHARE_ID, TOKEN, last);
  });

  it('saves the room again when it changed while a save was in flight', async () => {
    let finishFirst: (value: Awaited<ReturnType<typeof shareApi.updateShare>>) => void = () => {};
    vi.mocked(shareApi.updateShare)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          })
      )
      .mockResolvedValue(savedResponse('2026-11-01T10:00:09.000Z'));
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    collaboratorEdits(layoutWith('saved', 'first'));
    rerender();
    await advance(1000);
    const second = layoutWith('saved', 'first', 'second');
    collaboratorEdits(second);
    rerender();
    await advance(1000);
    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishFirst(savedResponse(NEXT_SAVE_AT));
      await Promise.resolve();
    });
    rerender();
    await advance(1000);

    expect(shareApi.updateShare).toHaveBeenCalledTimes(2);
    expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, second);
  });

  it('saves a layout it saved before, once another tab saved a different one', async () => {
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));
    const first = layoutWith('saved', 'first');
    collaboratorEdits(first);
    rerender();
    await advance(1000);
    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);

    const otherTabSave = layoutWith('saved', 'other-tab');
    if (!room.root) throw new Error('room not open');
    room.root = {
      layout: otherTabSave,
      metadata: { ...room.root.metadata, ...stampFor(otherTabSave, '2026-11-01T10:00:20.000Z') },
    };
    rerender();
    await advance(5000);
    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);

    collaboratorEdits(first);
    rerender();
    await advance(1000);

    expect(shareApi.updateShare).toHaveBeenCalledTimes(2);
    expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, first);
  });

  describe("beside the owner's local uploader", () => {
    const OWNED_LAYOUT_ID = layoutId('owned-layout');

    beforeEach(() => {
      const library = createTestLibrary(OWNED_LAYOUT_ID);
      const [entry] = library.entries;
      if (!entry) throw new Error('test library has no entry');
      useLibraryStore.setState({
        isLoaded: true,
        library: {
          ...library,
          entries: [
            {
              ...entry,
              cloudShare: { id: SHARE_ID, deleteToken: TOKEN, sharedAt: 0, permission: 'edit' },
            },
          ],
        },
      });
    });

    function renderBothUploaders() {
      return renderHook(() => {
        useOwnedShareSync();
        useCloudShareAutoSync(SHARE_ID, TOKEN);
      });
    }

    it("never saves the owner's older local layout over a room save", async () => {
      const saved = layoutWith('saved');
      openRoom(saved, stampFor(saved, SAVED_AT));
      useLayoutStore.setState({ activeLayoutId: OWNED_LAYOUT_ID });
      const { rerender } = renderBothUploaders();

      const ownerEdit = layoutWith('saved', 'owner-b');
      if (!room.root) throw new Error('room not open');
      room.root = { ...room.root, layout: ownerEdit };
      act(() => {
        useLayoutStore.setState({ layout: ownerEdit, lastEditSource: 'local' });
      });
      rerender();
      await advance(1000);
      const collaboratorEdit = layoutWith('saved', 'owner-b', 'collab-c');
      room.root = { ...room.root, layout: collaboratorEdit };
      rerender();
      await advance(6000);

      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, collaboratorEdit);
      expect(
        vi.mocked(shareApi.updateShare).mock.calls.filter(([, , layout]) => layout === ownerEdit)
      ).toHaveLength(1);
    });

    it('claims the share only while its room is loaded and the owner is in it', () => {
      const { rerender, unmount } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));
      expect(roomSavesShare(SHARE_ID)).toBe(false);

      openRoom(layoutWith('saved'), {});
      rerender();
      expect(roomSavesShare(SHARE_ID)).toBe(true);

      unmount();
      expect(roomSavesShare(SHARE_ID)).toBe(false);
    });

    it('lets a visitor leave the share unclaimed', () => {
      openRoom(layoutWith('saved'), {});
      renderHook(() => useCloudShareAutoSync(SHARE_ID, undefined));

      expect(roomSavesShare(SHARE_ID)).toBe(false);
    });

    it("lets the owner's local uploader save while the room has not loaded", async () => {
      useLayoutStore.setState({
        activeLayoutId: OWNED_LAYOUT_ID,
        layout: layoutWith('saved'),
        lastEditSource: 'init',
      });
      const { rerender } = renderBothUploaders();

      const ownerEdit = layoutWith('saved', 'before-room-loads');
      act(() => {
        useLayoutStore.setState({ layout: ownerEdit, lastEditSource: 'local' });
      });
      rerender();
      await advance(5000);

      expect(shareApi.updateShare).toHaveBeenCalledWith(SHARE_ID, TOKEN, ownerEdit);
    });

    it("saves the owner's earlier layout again after a room saved another one", async () => {
      const original = layoutWith('saved');
      useLayoutStore.setState({
        activeLayoutId: OWNED_LAYOUT_ID,
        layout: original,
        lastEditSource: 'init',
      });
      const { rerender } = renderBothUploaders();
      const layoutA = layoutWith('saved', 'a');
      act(() => {
        useLayoutStore.setState({ layout: layoutA, lastEditSource: 'local' });
      });
      rerender();
      await advance(5000);
      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, layoutA);

      openRoom(layoutA, stampFor(layoutA, SAVED_AT));
      rerender();
      const layoutB = layoutWith('saved', 'b');
      collaboratorEdits(layoutB);
      rerender();
      await advance(1000);
      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, layoutB);

      room.root = null;
      rerender();
      const restoredA = layoutWith('saved', 'a');
      act(() => {
        useLayoutStore.setState({ layout: restoredA, lastEditSource: 'local' });
      });
      rerender();
      await advance(5000);

      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, restoredA);
    });
  });

  it('saves a pending change to its own share when the owner leaves the room', async () => {
    const saved = layoutWith('saved');
    const stamp = stampFor(saved, SAVED_AT);
    openRoom(saved, stamp);
    const { rerender, unmount } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    const edited = layoutWith('saved', 'collab-edit');
    collaboratorEdits(edited);
    rerender();
    await advance(500);
    room.root = { layout: layoutWith('next-share-room'), metadata: {} };
    unmount();
    await advance(5000);

    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    expect(shareApi.updateShare).toHaveBeenCalledWith(SHARE_ID, TOKEN, edited);
    expect(room.root.metadata).toEqual({});
  });

  describe('a change that arrives during an upload', () => {
    type SaveResult = Awaited<ReturnType<typeof shareApi.updateShare>>;
    let finishFirst: (value: SaveResult) => void;

    beforeEach(() => {
      finishFirst = () => {};
      vi.mocked(shareApi.updateShare)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishFirst = resolve;
            })
        )
        .mockResolvedValue(savedResponse('2026-11-01T10:00:09.000Z'));
    });

    async function settleFirst(result: SaveResult): Promise<void> {
      await act(async () => {
        finishFirst(result);
        await Promise.resolve();
      });
    }

    function startFirstUpload() {
      const saved = layoutWith('saved');
      const stamp = stampFor(saved, SAVED_AT);
      openRoom(saved, stamp);
      const hook = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));
      collaboratorEdits(layoutWith('saved', 'first'));
      hook.rerender();
      return { ...hook, stamp };
    }

    it('uploads it when the upload ends, after the owner left the room', async () => {
      const { rerender, unmount, stamp } = startFirstUpload();
      await advance(1000);
      const second = layoutWith('saved', 'first', 'second');
      collaboratorEdits(second);
      rerender();
      await advance(1000);
      unmount();
      await settleFirst(savedResponse(NEXT_SAVE_AT));
      await advance(0);

      expect(shareApi.updateShare).toHaveBeenCalledTimes(2);
      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, second);
      expect(room.root?.metadata).toMatchObject(stamp);
    });

    it('uploads a change still in its debounce when the owner leaves', async () => {
      const { rerender, unmount } = startFirstUpload();
      await advance(1000);
      const second = layoutWith('saved', 'first', 'second');
      collaboratorEdits(second);
      rerender();
      await advance(500);
      unmount();
      await settleFirst(savedResponse(NEXT_SAVE_AT));
      await advance(0);

      expect(shareApi.updateShare).toHaveBeenCalledTimes(2);
      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, second);
    });

    it('uploads it when the upload fails', async () => {
      const { rerender } = startFirstUpload();
      await advance(1000);
      const second = layoutWith('saved', 'first', 'second');
      collaboratorEdits(second);
      rerender();
      await advance(1000);
      await settleFirst(err(apiServerError()));
      rerender();
      await advance(0);

      expect(shareApi.updateShare).toHaveBeenCalledTimes(2);
      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, second);
    });

    it('uploads only the latest of several changes', async () => {
      const { rerender } = startFirstUpload();
      await advance(1000);
      collaboratorEdits(layoutWith('saved', 'first', 'second'));
      rerender();
      await advance(1000);
      const third = layoutWith('saved', 'first', 'second', 'third');
      collaboratorEdits(third);
      rerender();
      await advance(1000);
      await settleFirst(savedResponse(NEXT_SAVE_AT));
      rerender();
      await advance(5000);

      expect(shareApi.updateShare).toHaveBeenCalledTimes(2);
      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, third);
    });

    it('uploads the saved layout again when the room goes back to it during an upload', async () => {
      const { rerender, unmount, stamp } = startFirstUpload();
      await advance(1000);
      collaboratorEdits(layoutWith('saved', 'first', 'second'));
      rerender();
      await advance(1000);
      const saved = layoutWith('saved');
      collaboratorEdits(saved);
      rerender();
      unmount();
      await settleFirst(savedResponse(NEXT_SAVE_AT));
      await advance(0);

      expect(vi.mocked(shareApi.updateShare).mock.calls.map(([, , layout]) => layout)).toEqual([
        layoutWith('saved', 'first'),
        saved,
      ]);
      expect(room.root?.metadata).toMatchObject(stamp);
    });

    it('uploads a layout again when its upload fails while the room waits on it', async () => {
      const { rerender } = startFirstUpload();
      await advance(1000);
      collaboratorEdits(layoutWith('saved', 'first', 'second'));
      rerender();
      await advance(1000);
      const first = layoutWith('saved', 'first');
      collaboratorEdits(first);
      rerender();
      await advance(1000);
      await settleFirst(err(apiServerError()));
      await advance(0);

      expect(shareApi.updateShare).toHaveBeenCalledTimes(2);
      expect(shareApi.updateShare).toHaveBeenLastCalledWith(SHARE_ID, TOKEN, first);
    });

    it('lets the room, opened again, replace what it left waiting', async () => {
      const { rerender, unmount } = startFirstUpload();
      await advance(1000);
      collaboratorEdits(layoutWith('saved', 'first', 'second'));
      rerender();
      await advance(500);
      unmount();
      const third = layoutWith('saved', 'first', 'second', 'third');
      collaboratorEdits(third);
      renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));
      await advance(1000);
      await settleFirst(savedResponse(NEXT_SAVE_AT));
      await advance(0);

      expect(vi.mocked(shareApi.updateShare).mock.calls.map(([, , layout]) => layout)).toEqual([
        layoutWith('saved', 'first'),
        third,
      ]);
    });

    it("lets the owner's newer local save replace what the room left waiting", async () => {
      const owned = layoutId('owned-layout');
      const library = createTestLibrary(owned);
      const [entry] = library.entries;
      if (!entry) throw new Error('test library has no entry');
      useLibraryStore.setState({
        isLoaded: true,
        library: {
          ...library,
          entries: [
            {
              ...entry,
              cloudShare: { id: SHARE_ID, deleteToken: TOKEN, sharedAt: 0, permission: 'edit' },
            },
          ],
        },
      });
      useLayoutStore.setState({ activeLayoutId: owned });
      const { rerender, unmount } = startFirstUpload();
      const local = renderHook(() => useOwnedShareSync());
      await advance(1000);
      collaboratorEdits(layoutWith('saved', 'first', 'second'));
      rerender();
      await advance(500);
      unmount();
      const ownerEdit = layoutWith('saved', 'first', 'second', 'owner');
      act(() => {
        useLayoutStore.setState({ layout: ownerEdit, lastEditSource: 'local' });
      });
      local.rerender();
      await advance(6000);
      await settleFirst(savedResponse(NEXT_SAVE_AT));
      await advance(0);

      expect(vi.mocked(shareApi.updateShare).mock.calls.map(([, , layout]) => layout)).toEqual([
        layoutWith('saved', 'first'),
        ownerEdit,
      ]);
    });

    it('drops a queued change that the room undid before the upload ended', async () => {
      const { rerender } = startFirstUpload();
      await advance(1000);
      collaboratorEdits(layoutWith('saved', 'first', 'second'));
      rerender();
      await advance(1000);
      collaboratorEdits(layoutWith('saved', 'first'));
      rerender();
      await advance(1000);
      await settleFirst(savedResponse(NEXT_SAVE_AT));
      rerender();
      await advance(5000);

      expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    });
  });

  it('has nothing to save on leaving a room the link already holds', async () => {
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));
    const { unmount } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    unmount();
    await advance(5000);

    expect(shareApi.updateShare).not.toHaveBeenCalled();
  });

  it('does not stamp the room when a save finishes after the owner left', async () => {
    let finish: (value: Awaited<ReturnType<typeof shareApi.updateShare>>) => void = () => {};
    vi.mocked(shareApi.updateShare).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const saved = layoutWith('saved');
    const stamp = stampFor(saved, SAVED_AT);
    openRoom(saved, stamp);
    const { rerender, unmount } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    collaboratorEdits(layoutWith('saved', 'collab-edit'));
    rerender();
    await advance(1000);
    unmount();
    await act(async () => {
      finish(savedResponse(NEXT_SAVE_AT));
      await Promise.resolve();
    });

    expect(room.root?.metadata).toMatchObject(stamp);
  });

  it('keeps a later revision that another save recorded first', async () => {
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));
    const edited = layoutWith('saved', 'collab-edit');
    collaboratorEdits(edited);
    rerender();
    const laterStamp = stampFor(edited, '2026-11-01T10:00:30.000Z');

    await advance(999);
    if (room.root) room.root = { ...room.root, metadata: { ...room.root.metadata, ...laterStamp } };
    await advance(1);

    expect(room.root?.metadata).toMatchObject(laterStamp);
  });

  it('leaves the stamp alone when the save fails', async () => {
    vi.mocked(shareApi.updateShare).mockResolvedValue(err(apiServerError()));
    const saved = layoutWith('saved');
    const stamp = stampFor(saved, SAVED_AT);
    openRoom(saved, stamp);
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    collaboratorEdits(layoutWith('saved', 'collab-edit'));
    rerender();
    await advance(1000);

    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    expect(room.root?.metadata).toMatchObject(stamp);
  });

  it('swallows a network error without stamping the room', async () => {
    vi.mocked(shareApi.updateShare).mockRejectedValue(new Error('offline'));
    const saved = layoutWith('saved');
    const stamp = stampFor(saved, SAVED_AT);
    openRoom(saved, stamp);
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    collaboratorEdits(layoutWith('saved', 'collab-edit'));
    rerender();
    await advance(1000);

    expect(room.root?.metadata).toMatchObject(stamp);
  });

  it('records only the fingerprint when the server returns no revision', async () => {
    vi.mocked(shareApi.updateShare).mockResolvedValue(savedResponse(undefined));
    const saved = layoutWith('saved');
    openRoom(saved, stampFor(saved, SAVED_AT));
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    const edited = layoutWith('saved', 'collab-edit');
    collaboratorEdits(edited);
    rerender();
    await advance(1000);

    expect(room.root?.metadata).toMatchObject({
      linkUpdatedAt: SAVED_AT,
      linkFingerprint: stampFor(edited, undefined).linkFingerprint,
    });
  });

  it('does not write the stamp from a read-only connection', async () => {
    room.canWrite = false;
    const saved = layoutWith('saved');
    const stamp = stampFor(saved, SAVED_AT);
    openRoom(saved, stamp);
    const { rerender } = renderHook(() => useCloudShareAutoSync(SHARE_ID, TOKEN));

    collaboratorEdits(layoutWith('saved', 'collab-edit'));
    rerender();
    await advance(1000);
    rerender();
    await advance(5000);

    expect(shareApi.updateShare).toHaveBeenCalledTimes(1);
    expect(room.root?.metadata).toMatchObject(stamp);
  });
});
