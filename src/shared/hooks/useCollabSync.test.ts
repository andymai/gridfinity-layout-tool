import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollabSync } from '@/shared/hooks/useCollabSync';
import { useLayoutStore } from '@/core/store/layout';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import type { Layout, Bin, LayerId } from '@/core/types';
import { binId, categoryId, gridUnits, heightUnits, layerId, layoutId } from '@/core/types';

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
    it('pushes local layout to remote when local has content', () => {
      const localLayout = createTestLayout([createBinOnGrid('bin1')]);
      useLayoutStore.setState({ layout: localLayout, lastEditSource: 'init' });

      // Remote is empty
      const remoteLayout = createTestLayout();
      mockUseStorage.mockImplementation((selector) => {
        return selector({ layout: remoteLayout });
      });

      renderHook(() => useCollabSync());

      // Should push local to remote
      expect(mockUpdateRemoteLayout).toHaveBeenCalledWith(localLayout);
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
