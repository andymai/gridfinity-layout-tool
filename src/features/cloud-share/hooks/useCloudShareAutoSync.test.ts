import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloudShareAutoSync } from './useCloudShareAutoSync';
import { useLayoutStore } from '@/core/store/layout';
import * as shareApi from '@/core/api/share';
import { ok, err, apiServerError } from '@/core/result';
import type { Layout } from '@/core/types';
import { binId, gridUnits } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { stampFor, type RoomLinkStamp } from '@/shared/utils/roomLinkStamp';

interface FakeRoot {
  layout: Layout;
  metadata: Record<string, unknown>;
}

const room = vi.hoisted(() => ({
  root: null as FakeRoot | null,
  canWrite: true,
}));

vi.mock('@/liveblocks.config', () => ({
  useStorage: <T>(selector: (root: FakeRoot) => T): T | null =>
    room.root ? selector(room.root) : null,
  useMutation:
    (callback: (context: unknown, ...args: unknown[]) => unknown) =>
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
      ),
}));

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
