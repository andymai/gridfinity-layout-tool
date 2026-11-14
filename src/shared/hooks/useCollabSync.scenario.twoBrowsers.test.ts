/**
 * Two browsers in one room: each has its own layout store and its own
 * useCollabSync, and both read and write one fake Liveblocks room.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Layout } from '@/core/types';
import { binId, designId } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { roomDesignIds } from '@/shared/utils/roomDesignIds';

const room = vi.hoisted((): { layout: unknown; listeners: Set<() => void> } => ({
  layout: null,
  listeners: new Set(),
}));

vi.mock('@/liveblocks.config', async () => {
  const { useState, useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => {
    room.listeners.add(listener);
    return () => room.listeners.delete(listener);
  };
  return {
    useStorage: <T>(selector: (root: { layout: unknown }) => T): T | null =>
      useSyncExternalStore(subscribe, () =>
        room.layout ? selector({ layout: room.layout }) : null
      ),
    useMutation: (callback: (context: unknown, ...args: unknown[]) => unknown) =>
      useState(
        () =>
          (...args: unknown[]) =>
            callback(
              {
                storage: {
                  get: () => undefined,
                  set: (key: string, value: unknown) => {
                    if (key !== 'layout') return;
                    room.layout = value;
                    room.listeners.forEach((listener) => listener());
                  },
                },
                self: { canWrite: true },
              },
              ...args
            )
      )[0],
  };
});

let sharedReact: Record<string, unknown> | null = null;

/**
 * A fresh copy of the hook and the layout store: one browser. React stays the
 * instance that renderHook uses, captured before the first module reset.
 */
async function loadBrowser() {
  sharedReact ??= await vi.importActual<Record<string, unknown>>('react');
  const react = sharedReact;
  vi.resetModules();
  vi.doMock('react', () => react);
  const store = await import('@/core/store/layout');
  const sync = await import('@/shared/hooks/useCollabSync');
  return { sync, store };
}

type Browser = Awaited<ReturnType<typeof loadBrowser>>;

function layoutWith(...ids: string[]): Layout {
  return createTestLayout({ bins: ids.map((id) => createTestBin({ id: binId(id) })) });
}

function binIds(layout: Layout): string[] {
  return layout.bins.map((bin) => bin.id);
}

function addBin(browser: Browser, id: string): void {
  const current = browser.store.useLayoutStore.getState().layout;
  browser.store.useLayoutStore.setState({
    layout: { ...current, bins: [...current.bins, createTestBin({ id: binId(id) })] },
    lastEditSource: 'local',
  });
}

async function twoBrowsersInRoom(): Promise<[Browser, Browser]> {
  const first = await loadBrowser();
  const second = await loadBrowser();
  expect(second.store.useLayoutStore).not.toBe(first.store.useLayoutStore);

  const start = layoutWith('a');
  room.layout = start;
  for (const browser of [first, second]) {
    browser.store.useLayoutStore.setState({ layout: start, lastEditSource: 'init' });
    renderHook(() => browser.sync.useCollabSync());
  }
  return [first, second];
}

function layoutsOf(first: Browser, second: Browser): string[][] {
  return [
    binIds(room.layout as Layout),
    binIds(first.store.useLayoutStore.getState().layout),
    binIds(second.store.useLayoutStore.getState().layout),
  ];
}

describe('two browsers in one room', () => {
  it('keep every edit when they edit in turn', async () => {
    const [first, second] = await twoBrowsersInRoom();

    for (const [browser, id] of [
      [first, 'x1'],
      [second, 'y1'],
      [first, 'x2'],
      [second, 'y2'],
    ] as const) {
      act(() => addBin(browser, id));
    }

    const expected = ['a', 'x1', 'y1', 'x2', 'y2'];
    expect(layoutsOf(first, second)).toEqual([expected, expected, expected]);
  });

  it('end with the same layout when they edit in the same moment', async () => {
    const [first, second] = await twoBrowsersInRoom();

    act(() => {
      addBin(first, 'x');
      addBin(second, 'y');
    });

    const [inRoom, inFirst, inSecond] = layoutsOf(first, second);
    expect(inFirst).toEqual(inRoom);
    expect(inSecond).toEqual(inRoom);
    expect([
      ['a', 'x'],
      ['a', 'y'],
    ]).toContainEqual(inRoom);
  });

  it("keep one browser's edit when the other submits its layout name unchanged at that moment", async () => {
    const [first, second] = await twoBrowsersInRoom();

    act(() => {
      addBin(second, 'y');
      const { setName, layout } = first.store.useLayoutStore.getState();
      setName(layout.name);
    });

    const expected = ['a', 'y'];
    expect(layoutsOf(first, second)).toEqual([expected, expected, expected]);
  });
});

describe('an owner and a visitor with designs from the share', () => {
  const OWNER_ID = 'owner-design';
  const LOCAL_ID = 'design_shared_1';
  const visitorIds = roomDesignIds({ [OWNER_ID]: LOCAL_ID });

  function layoutLinked(...bins: [string, string][]): Layout {
    return createTestLayout({
      bins: bins.map(([id, linked]) =>
        createTestBin({ id: binId(id), linkedDesignId: designId(linked) })
      ),
    });
  }

  function linkedIn(layout: unknown): string[] {
    return (layout as Layout).bins.map((bin) => `${bin.id}:${bin.linkedDesignId ?? ''}`);
  }

  function addLinkedBin(browser: Browser, id: string, linked: string): void {
    const current = browser.store.useLayoutStore.getState().layout;
    const bin = createTestBin({ id: binId(id), linkedDesignId: designId(linked) });
    browser.store.useLayoutStore.setState({
      layout: { ...current, bins: [...current.bins, bin] },
      lastEditSource: 'local',
    });
  }

  async function ownerAndVisitor(roomLayout: Layout): Promise<[Browser, Browser]> {
    const owner = await loadBrowser();
    const visitor = await loadBrowser();
    room.layout = roomLayout;
    owner.store.useLayoutStore.setState({
      layout: layoutLinked(['a', OWNER_ID]),
      lastEditSource: 'init',
    });
    renderHook(() => owner.sync.useCollabSync());
    visitor.store.useLayoutStore.setState({
      layout: layoutLinked(['a', LOCAL_ID]),
      lastEditSource: 'init',
    });
    renderHook(() => visitor.sync.useCollabSync(undefined, visitorIds));
    return [owner, visitor];
  }

  function linkedOf(owner: Browser, visitor: Browser): string[][] {
    return [
      linkedIn(room.layout),
      linkedIn(owner.store.useLayoutStore.getState().layout),
      linkedIn(visitor.store.useLayoutStore.getState().layout),
    ];
  }

  it("keep the owner's ids in the room and the visitor's own ids in its copy", async () => {
    const [owner, visitor] = await ownerAndVisitor(layoutLinked(['a', OWNER_ID]));

    act(() => addLinkedBin(visitor, 'b', LOCAL_ID));
    act(() => addLinkedBin(owner, 'c', OWNER_ID));

    const inRoom = ['a:owner-design', 'b:owner-design', 'c:owner-design'];
    const inVisitor = ['a:design_shared_1', 'b:design_shared_1', 'c:design_shared_1'];
    expect(linkedOf(owner, visitor)).toEqual([inRoom, inRoom, inVisitor]);
  });

  it("give the owner's ids back to a room that a visitor seeded with its own", async () => {
    const [owner, visitor] = await ownerAndVisitor(layoutLinked(['a', LOCAL_ID]));

    act(() => addLinkedBin(visitor, 'b', LOCAL_ID));

    const inRoom = ['a:owner-design', 'b:owner-design'];
    const inVisitor = ['a:design_shared_1', 'b:design_shared_1'];
    expect(linkedOf(owner, visitor)).toEqual([inRoom, inRoom, inVisitor]);
  });
});
