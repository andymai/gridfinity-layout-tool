import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollabSync } from '@/hooks/useCollabSync';
import { useLayoutStore } from '@/core/store/layout';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import type { Layout, Bin } from '@/core/types';

// Mock liveblocks hooks
const mockUseStorage = vi.fn();
const mockUseMutation = vi.fn();
const mockUpdateRemoteLayout = vi.fn();

vi.mock('../../liveblocks.config', () => ({
  useStorage: (selector: (root: { layout: Layout } | null) => Layout | null) => mockUseStorage(selector),
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

function createBinOnGrid(id: string, layerId = 'layer1'): Bin {
  return {
    id,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    depth: 1,
    layerId,
    category: 'cat1',
    label: '',
    notes: '',
  };
}

function createBinInStaging(id: string): Bin {
  return {
    id,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    depth: 1,
    layerId: STAGING_ID,
    category: 'cat1',
    label: '',
    notes: '',
  };
}

describe('useCollabSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset store to default state
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({
      layout: defaultLayout,
      activeLayoutId: 'test-layout',
      lastEditSource: 'init',
    });

    // Default mock: no remote layout
    mockUseStorage.mockImplementation((selector) => {
      return selector(null);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial sync', () => {
    it('pushes local layout to remote when local has content', () => {
      // Local has a bin on the grid
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

      // Remote has a bin
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
      mockUseStorage.mockImplementation((selector) => {
        return selector(null);
      });

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
      mockUseStorage.mockImplementation((selector) => {
        return selector(null);
      });

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
