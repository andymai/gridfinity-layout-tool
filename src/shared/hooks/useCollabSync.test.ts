import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollabSync } from '@/shared/hooks/useCollabSync';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import type { Layout, Bin, LayerId } from '@/core/types';
import { binId, categoryId, gridUnits, heightUnits, layerId, layoutId } from '@/core/types';
import { stampFor, type RoomLinkStamp } from '@/shared/utils/roomLinkStamp';

// Mock liveblocks hooks
const mockUseStorage = vi.fn();
const mockUseMutation = vi.fn();
const mockUpdateRemoteLayout = vi.fn();

vi.mock('@/liveblocks.config', () => ({
  useStorage: (selector: (root: { layout: Layout }) => Layout) => mockUseStorage(selector),
  useMutation: (callback: unknown) => {
    mockUseMutation(callback);
    return mockUpdateRemoteLayout;
  },
}));

function createTestLayout(bins: Bin[] = []): Layout {
  return {
    ...createDefaultLayout(),
    bins,
  };
}

function createBin(id: string, layer: LayerId): Bin {
  return {
    id: binId(id),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    height: heightUnits(1),
    depth: gridUnits(1),
    layerId: layer,
    category: categoryId('cat1'),
    label: '',
    notes: '',
  };
}

function createBinOnGrid(id: string, layer: LayerId = layerId('layer1')): Bin {
  return createBin(id, layer);
}

function createBinInStaging(id: string): Bin {
  return createBin(id, STAGING_ID);
}

describe('useCollabSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({
      layout: defaultLayout,
      activeLayoutId: layoutId('test-layout'),
      lastEditSource: 'init',
    });

    // Default mock: no remote layout (Liveblocks returns undefined when storage not loaded)
    mockUseStorage.mockReturnValue(undefined);
    mockUpdateRemoteLayout.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial sync', () => {
    it('pushes a copy of unknown revision into an unstamped room without marking it saved', () => {
      const localLayout = createTestLayout([createBinOnGrid('bin1')]);
      useLayoutStore.setState({ layout: localLayout, lastEditSource: 'init' });

      const remoteLayout = createTestLayout();
      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: remoteLayout });
      });

      renderHook(() => useCollabSync());

      expect(mockUpdateRemoteLayout.mock.calls).toEqual([[localLayout, undefined]]);
    });

    it('pushes a copy of known revision into an unstamped room with that revision', () => {
      const localLayout = createTestLayout([createBinOnGrid('bin1')]);
      useLayoutStore.setState({ layout: localLayout, lastEditSource: 'init' });
      const emptyRoom = createTestLayout();
      mockUseStorage.mockImplementation((selector) => selector({ layout: emptyRoom }));

      renderHook(() => useCollabSync(stampFor(localLayout, '2026-11-01T10:00:00.000Z')));

      expect(mockUpdateRemoteLayout.mock.calls).toEqual([
        [localLayout, stampFor(localLayout, '2026-11-01T10:00:00.000Z')],
      ]);
    });

    it('keeps an unstamped room that has bins rather than push its own copy', () => {
      useLayoutStore.setState({
        layout: createTestLayout([createBinOnGrid('copy')]),
        lastEditSource: 'init',
      });
      const roomLayout = createTestLayout([createBinOnGrid('room')]);
      mockUseStorage.mockImplementation((selector) => selector({ layout: roomLayout }));

      renderHook(() =>
        useCollabSync(stampFor(useLayoutStore.getState().layout, '2026-11-01T10:00:00.000Z'))
      );

      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['room']);
    });

    it('imports remote layout when local is empty and remote has content', () => {
      // Local is empty
      const localLayout = createTestLayout();
      useLayoutStore.setState({ layout: localLayout, lastEditSource: 'init' });

      const remoteLayout = createTestLayout([createBinOnGrid('bin1')]);
      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: remoteLayout });
      });

      renderHook(() => useCollabSync());

      // Should import remote layout - verify the outcome rather than implementation
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });

    it('ignores staging bins when determining if layout has content', () => {
      // Local only has staging bins (not "real" content)
      const localLayout = createTestLayout([createBinInStaging('staging-bin')]);
      useLayoutStore.setState({ layout: localLayout, lastEditSource: 'init' });

      // Remote has real content
      const remoteLayout = createTestLayout([createBinOnGrid('grid-bin')]);
      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: remoteLayout });
      });

      renderHook(() => useCollabSync());

      // Should NOT push local (it's effectively empty)
      // The remote should be imported instead
      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
    });

    it('does not sync when remote layout is null', () => {
      mockUseStorage.mockReturnValue(undefined);

      renderHook(() => useCollabSync());

      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
    });
  });

  describe('local to remote sync', () => {
    it('pushes local changes to remote when lastEditSource is local', async () => {
      // Start with both having same empty layout
      const initialLayout = createTestLayout();
      useLayoutStore.setState({ layout: initialLayout, lastEditSource: 'init' });

      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: initialLayout });
      });

      const { rerender } = renderHook(() => useCollabSync());

      // Wait for initial sync to complete
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Simulate local edit
      const updatedLayout = createTestLayout([createBinOnGrid('new-bin')]);
      useLayoutStore.setState({ layout: updatedLayout, lastEditSource: 'local' });

      rerender();

      // Should push to remote
      expect(mockUpdateRemoteLayout).toHaveBeenCalledWith(updatedLayout);
    });

    it('does not push to remote when lastEditSource is remote', async () => {
      const initialLayout = createTestLayout();
      useLayoutStore.setState({ layout: initialLayout, lastEditSource: 'init' });

      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: initialLayout });
      });

      const { rerender } = renderHook(() => useCollabSync());

      // Wait for initial sync
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      mockUpdateRemoteLayout.mockClear();

      // Simulate remote edit (from another user)
      const updatedLayout = createTestLayout([createBinOnGrid('remote-bin')]);
      useLayoutStore.setState({ layout: updatedLayout, lastEditSource: 'remote' });

      rerender();

      // Should NOT push back (would cause loop)
      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
    });

    it('does not push when sync state is not ready', () => {
      // Remote is null, so sync state stays pending
      // The selector receives a null root, so return undefined to simulate unloaded storage
      mockUseStorage.mockReturnValue(undefined);

      renderHook(() => useCollabSync());

      // Simulate local edit before sync is ready
      const updatedLayout = createTestLayout([createBinOnGrid('bin1')]);
      useLayoutStore.setState({ layout: updatedLayout, lastEditSource: 'local' });

      // Should not push (not ready yet)
      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
    });
  });

  describe('remote to local sync', () => {
    it('imports remote changes after initial sync is complete', async () => {
      const initialLayout = createTestLayout();
      useLayoutStore.setState({ layout: initialLayout, lastEditSource: 'init' });

      let currentRemoteLayout = initialLayout;
      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: currentRemoteLayout });
      });

      const { rerender } = renderHook(() => useCollabSync());

      // Wait for initial sync to complete
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Simulate remote change
      currentRemoteLayout = createTestLayout([createBinOnGrid('remote-bin')]);
      useLayoutStore.setState({ lastEditSource: 'init' }); // Not 'local'

      rerender();

      // Local store should have the remote bin
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });

    it("keeps the active layout id, so the owner's library still saves a collaborator's edit", async () => {
      const initialLayout = createTestLayout();
      useLayoutStore.setState({ layout: initialLayout, lastEditSource: 'init' });

      let currentRemoteLayout = initialLayout;
      mockUseStorage.mockImplementation((selector) => selector({ layout: currentRemoteLayout }));
      const { rerender } = renderHook(() => useCollabSync());
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      currentRemoteLayout = createTestLayout([createBinOnGrid('remote-bin')]);
      rerender();

      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['remote-bin']);
      expect(useLayoutStore.getState().activeLayoutId).toBe('test-layout');
    });

    it('skips import when remote layout matches last synced layout', async () => {
      const initialLayout = createTestLayout([createBinOnGrid('bin1')]);
      useLayoutStore.setState({ layout: initialLayout, lastEditSource: 'init' });

      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: initialLayout });
      });

      const { rerender } = renderHook(() => useCollabSync());

      // Wait for initial sync
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Spy on setState to verify no re-import occurs
      const setStateSpy = vi.spyOn(useLayoutStore, 'setState');

      // Rerender with same remote layout
      rerender();

      // Should not re-import - setState shouldn't be called for layout changes
      // Filter out any calls that might be for other state updates
      const layoutSetCalls = setStateSpy.mock.calls.filter(
        (call) => call[0] && typeof call[0] === 'object' && 'layout' in call[0]
      );
      expect(layoutSetCalls).toHaveLength(0);

      setStateSpy.mockRestore();
    });

    it('ignores remote updates during initializing state', () => {
      // Local has content, will push to remote and enter initializing state
      const localLayout = createTestLayout([createBinOnGrid('local-bin')]);
      useLayoutStore.setState({ layout: localLayout, lastEditSource: 'init' });

      let remoteLayout = createTestLayout();
      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: remoteLayout });
      });

      const { rerender } = renderHook(() => useCollabSync());

      // During initializing, update remote
      remoteLayout = createTestLayout([createBinOnGrid('should-ignore')]);

      // Don't advance timers - stay in initializing state
      rerender();

      // Local should still have the original bin, not the ignored remote update
      expect(useLayoutStore.getState().layout.bins[0]?.id).toBe('local-bin');
    });
  });

  describe('read-only room', () => {
    type WriteLayout = (
      context: {
        storage: { set: (key: string, value: Layout) => void };
        self: { canWrite: boolean };
      },
      layout: Layout
    ) => boolean;

    function captureMutation(): WriteLayout {
      renderHook(() => useCollabSync());
      return mockUseMutation.mock.calls[0]?.[0] as WriteLayout;
    }

    it('leaves storage untouched when the room granted read access only', () => {
      const writeLayout = captureMutation();
      const set = vi.fn();

      const wrote = writeLayout(
        { storage: { set }, self: { canWrite: false } },
        createTestLayout()
      );

      expect(wrote).toBe(false);
      expect(set).not.toHaveBeenCalled();
    });

    it('writes when the room granted write access', () => {
      const writeLayout = captureMutation();
      const set = vi.fn();
      const layout = createTestLayout();

      const wrote = writeLayout({ storage: { set }, self: { canWrite: true } }, layout);

      expect(wrote).toBe(true);
      expect(set).toHaveBeenCalledWith('layout', layout);
    });

    it('takes the room layout on join when its own copy cannot be pushed', () => {
      mockUpdateRemoteLayout.mockReturnValue(false);
      const localLayout = createTestLayout([createBinOnGrid('stale-local')]);
      useLayoutStore.setState({ layout: localLayout, lastEditSource: 'init' });

      const remoteLayout = createTestLayout([createBinOnGrid('room-bin')]);
      mockUseStorage.mockImplementation((selector) => selector({ layout: remoteLayout }));

      renderHook(() => useCollabSync());

      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['room-bin']);
    });

    it('takes an empty room on join rather than keep its own refused copy', () => {
      mockUpdateRemoteLayout.mockReturnValue(false);
      useLayoutStore.setState({
        layout: createTestLayout([createBinOnGrid('stale-local')]),
        lastEditSource: 'init',
      });
      const emptyRoom = createTestLayout();
      mockUseStorage.mockImplementation((selector) => selector({ layout: emptyRoom }));

      renderHook(() => useCollabSync());

      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('takes the room layout over a local edit the room refused', async () => {
      mockUpdateRemoteLayout.mockReturnValue(false);
      const roomLayout = createTestLayout([createBinOnGrid('room-bin')]);
      useLayoutStore.setState({ layout: createTestLayout(), lastEditSource: 'init' });

      let remoteLayout = roomLayout;
      mockUseStorage.mockImplementation((selector) => selector({ layout: remoteLayout }));
      const { rerender } = renderHook(() => useCollabSync());

      act(() => {
        useLayoutStore.setState({
          layout: createTestLayout([createBinOnGrid('local-edit')]),
          lastEditSource: 'local',
        });
      });
      rerender();

      remoteLayout = createTestLayout([createBinOnGrid('owner-edit')]);
      rerender();

      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['owner-edit']);
    });

    it('takes a room update that lands in the same render as a refused edit', () => {
      mockUpdateRemoteLayout.mockReturnValue(false);
      const roomLayout = createTestLayout([createBinOnGrid('room-bin')]);
      useLayoutStore.setState({ layout: createTestLayout(), lastEditSource: 'init' });

      let remoteLayout = roomLayout;
      mockUseStorage.mockImplementation((selector) => selector({ layout: remoteLayout }));
      const { rerender } = renderHook(() => useCollabSync());

      remoteLayout = createTestLayout([createBinOnGrid('owner-edit')]);
      act(() => {
        useLayoutStore.setState({
          layout: createTestLayout([createBinOnGrid('local-edit')]),
          lastEditSource: 'local',
        });
      });
      rerender();

      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['owner-edit']);
    });

    it('keeps accepting room updates after a push is refused', () => {
      mockUpdateRemoteLayout.mockReturnValue(false);
      const localLayout = createTestLayout([createBinOnGrid('stale-local')]);
      useLayoutStore.setState({ layout: localLayout, lastEditSource: 'init' });

      let remoteLayout = createTestLayout([createBinOnGrid('room-bin')]);
      mockUseStorage.mockImplementation((selector) => selector({ layout: remoteLayout }));

      const { rerender } = renderHook(() => useCollabSync());

      remoteLayout = createTestLayout([createBinOnGrid('owner-edit')]);
      rerender();

      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['owner-edit']);
    });
  });

  describe('joining a stamped room', () => {
    const SAVED_AT = '2026-11-01T10:00:00.000Z';
    const LATER = '2026-11-01T10:05:00.000Z';
    const EARLIER = '2026-11-01T09:00:00.000Z';

    function joinRoom(room: Layout, stamp: RoomLinkStamp, copy: Layout, copyRevision?: string) {
      useLayoutStore.setState({ layout: copy, lastEditSource: 'init' });
      mockUseStorage.mockImplementation((selector) =>
        selector({ layout: room, metadata: { ownerId: 'owner', ...stamp } })
      );
      const save = copyRevision ? stampFor(copy, copyRevision) : undefined;
      return renderHook(() => useCollabSync(save));
    }

    function joinStaleRoomWith(copy: Layout, save: RoomLinkStamp) {
      const stale = createTestLayout([createBinOnGrid('stale')]);
      useLayoutStore.setState({ layout: copy, lastEditSource: 'init' });
      mockUseStorage.mockImplementation((selector) =>
        selector({ layout: stale, metadata: { ownerId: 'owner', ...stampFor(stale, SAVED_AT) } })
      );
      renderHook(() => useCollabSync(save));
    }

    it('takes no revision from a later save of a different layout', () => {
      const otherTabSave = createTestLayout([createBinOnGrid('other-tab')]);

      joinStaleRoomWith(
        createTestLayout([createBinOnGrid('this-tab')]),
        stampFor(otherTabSave, LATER)
      );

      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['stale']);
    });

    it('takes no revision from a record that names no layout', () => {
      joinStaleRoomWith(createTestLayout([createBinOnGrid('copy')]), { linkUpdatedAt: LATER });

      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
    });

    it('takes no revision once the copy changed after its save', () => {
      const savedCopy = createTestLayout([createBinOnGrid('saved-copy')]);

      joinStaleRoomWith(
        createTestLayout([createBinOnGrid('saved-copy'), createBinOnGrid('edited-since')]),
        stampFor(savedCopy, LATER)
      );

      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
    });

    it('takes the room when it holds edits made after the copy was saved to the link', () => {
      const saved = createTestLayout([createBinOnGrid('saved')]);
      const edited = createTestLayout([createBinOnGrid('saved'), createBinOnGrid('collab-edit')]);

      joinRoom(edited, stampFor(saved, SAVED_AT), saved, SAVED_AT);

      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual([
        'saved',
        'collab-edit',
      ]);
    });

    it('takes the room over a copy older than the revision it recorded', () => {
      const room = createTestLayout([createBinOnGrid('room')]);

      joinRoom(room, stampFor(room, SAVED_AT), createTestLayout([createBinOnGrid('old')]), EARLIER);

      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['room']);
    });

    it('keeps edits the link lacks even when the copy is from a later revision', () => {
      const saved = createTestLayout([createBinOnGrid('saved')]);
      const edited = createTestLayout([createBinOnGrid('collab-edit')]);

      joinRoom(
        edited,
        stampFor(saved, SAVED_AT),
        createTestLayout([createBinOnGrid('copy')]),
        LATER
      );

      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual(['collab-edit']);
    });

    it('pushes a copy from a later link revision and records that revision', () => {
      const stale = createTestLayout([createBinOnGrid('stale')]);
      const newer = createTestLayout([createBinOnGrid('edited-outside-room')]);

      joinRoom(stale, stampFor(stale, SAVED_AT), newer, LATER);

      expect(mockUpdateRemoteLayout).toHaveBeenCalledWith(newer, stampFor(newer, LATER));
      expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual([
        'edited-outside-room',
      ]);
    });

    it('keeps the active layout id when it takes the room layout', () => {
      const room = createTestLayout([createBinOnGrid('room')]);

      joinRoom(
        room,
        stampFor(room, SAVED_AT),
        createTestLayout([createBinOnGrid('copy')]),
        EARLIER
      );

      expect(useLayoutStore.getState().activeLayoutId).toBe('test-layout');
    });

    it('writes the stamp beside the layout, keeping the rest of the metadata', () => {
      renderHook(() => useCollabSync());
      const write = mockUseMutation.mock.calls[0]?.[0] as (
        context: {
          storage: { get: (key: string) => unknown; set: (key: string, value: unknown) => void };
          self: { canWrite: boolean };
        },
        layout: Layout,
        stamp?: RoomLinkStamp
      ) => boolean;
      const set = vi.fn();
      const get = vi.fn(() => ({ ownerId: 'owner', permission: 'edit', version: 1 }));
      const layout = createTestLayout([createBinOnGrid('copy')]);

      write({ storage: { get, set }, self: { canWrite: true } }, layout, stampFor(layout, LATER));

      expect(set).toHaveBeenCalledWith('layout', layout);
      expect(set).toHaveBeenCalledWith('metadata', {
        ownerId: 'owner',
        permission: 'edit',
        version: 1,
        ...stampFor(layout, LATER),
      });
    });
  });

  describe('room changes after an edit of its own', () => {
    function ids(): string[] {
      return useLayoutStore.getState().layout.bins.map((b) => b.id);
    }

    async function joinedRoomWith(start: Layout) {
      useLayoutStore.setState({ layout: start, lastEditSource: 'init' });
      let room = start;
      mockUseStorage.mockImplementation((selector) => selector({ layout: room }));
      const hook = renderHook(() => useCollabSync());
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      return {
        setRoom: (layout: Layout) => {
          room = layout;
          hook.rerender();
        },
        editLocally: (layout: Layout) => {
          act(() => {
            useLayoutStore.setState({ layout, lastEditSource: 'local' });
          });
        },
      };
    }

    it("imports a collaborator's edit that lands after this browser's own edit", async () => {
      const room = await joinedRoomWith(createTestLayout([createBinOnGrid('a')]));
      const ownEdit = createTestLayout([createBinOnGrid('a'), createBinOnGrid('own-b')]);
      room.editLocally(ownEdit);
      room.setRoom(ownEdit);

      room.setRoom(
        createTestLayout([createBinOnGrid('a'), createBinOnGrid('own-b'), createBinOnGrid('c')])
      );

      expect(ids()).toEqual(['a', 'own-b', 'c']);
      expect(useLayoutStore.getState().lastEditSource).toBe('remote');
    });

    it("builds this browser's next edit on the collaborator's edit", async () => {
      const room = await joinedRoomWith(createTestLayout([createBinOnGrid('a')]));
      const ownEdit = createTestLayout([createBinOnGrid('a'), createBinOnGrid('own-b')]);
      room.editLocally(ownEdit);
      room.setRoom(ownEdit);
      room.setRoom(
        createTestLayout([createBinOnGrid('a'), createBinOnGrid('own-b'), createBinOnGrid('c')])
      );

      const current = useLayoutStore.getState().layout;
      const nextEdit = { ...current, bins: [...current.bins, createBinOnGrid('own-d')] };
      room.editLocally(nextEdit);

      const pushed = mockUpdateRemoteLayout.mock.calls.at(-1)?.[0] as Layout | undefined;
      expect(pushed?.bins.map((b) => b.id)).toEqual(['a', 'own-b', 'c', 'own-d']);
    });

    it('does not import its own push coming back from the room', async () => {
      const room = await joinedRoomWith(createTestLayout([createBinOnGrid('a')]));
      const ownEdit = createTestLayout([createBinOnGrid('a'), createBinOnGrid('own-b')]);
      room.editLocally(ownEdit);

      room.setRoom(JSON.parse(JSON.stringify(ownEdit)) as Layout);

      expect(useLayoutStore.getState().layout).toBe(ownEdit);
      expect(useLayoutStore.getState().lastEditSource).toBe('local');
    });

    it('keeps an edit the room has not received when a room change lands in the same render', async () => {
      const room = await joinedRoomWith(createTestLayout([createBinOnGrid('a')]));
      const ownEdit = createTestLayout([createBinOnGrid('a'), createBinOnGrid('own-b')]);
      const theirs = createTestLayout([createBinOnGrid('a'), createBinOnGrid('their-c')]);
      useLayoutStore.setState({ layout: ownEdit, lastEditSource: 'local' });

      room.setRoom(theirs);

      expect(ids()).toEqual(['a', 'own-b']);
      expect(mockUpdateRemoteLayout).toHaveBeenLastCalledWith(ownEdit);
    });

    it('takes a room change that lands with a local action that left the layout as it was', async () => {
      const start = createTestLayout([createBinOnGrid('a')]);
      const room = await joinedRoomWith(start);
      const theirs = createTestLayout([createBinOnGrid('a'), createBinOnGrid('their-c')]);
      useLayoutStore.getState().setName(start.name);
      expect(useLayoutStore.getState().layout).toBe(start);
      expect(useLayoutStore.getState().lastEditSource).toBe('local');

      room.setRoom(theirs);

      expect(ids()).toEqual(['a', 'their-c']);
      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
    });

    it("adds no entry to this browser's undo history for an imported edit", async () => {
      const room = await joinedRoomWith(createTestLayout([createBinOnGrid('a')]));
      const ownEdit = createTestLayout([createBinOnGrid('a'), createBinOnGrid('own-b')]);
      room.editLocally(ownEdit);
      room.setRoom(ownEdit);
      const pastBefore = useHistoryStore.getState().past.length;

      room.setRoom(
        createTestLayout([createBinOnGrid('a'), createBinOnGrid('own-b'), createBinOnGrid('c')])
      );

      expect(ids()).toEqual(['a', 'own-b', 'c']);
      expect(useHistoryStore.getState().past).toHaveLength(pastBefore);
    });
  });

  describe('loop prevention', () => {
    it('prevents sync loops by tracking lastEditSource', async () => {
      const initialLayout = createTestLayout();
      useLayoutStore.setState({ layout: initialLayout, lastEditSource: 'init' });

      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: initialLayout });
      });

      const { rerender } = renderHook(() => useCollabSync());

      // Complete initial sync
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      mockUpdateRemoteLayout.mockClear();

      // Simulate receiving a remote update
      const remoteLayout = createTestLayout([createBinOnGrid('remote-bin')]);
      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: remoteLayout });
      });

      rerender();

      // The remote change should be imported with source 'remote'
      // This prevents the local→remote effect from pushing it back
      expect(mockUpdateRemoteLayout).not.toHaveBeenCalled();
    });
  });
});
