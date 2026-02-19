import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSnapshotAutoSave } from './useSnapshotAutoSave';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useSnapshotStore } from '@/core/store/snapshots';
import { createTestLayout, createTestLibrary } from '@/test/testUtils';
import { layoutId } from '@/core/types';
import type { Snapshot } from '@/core/types';

// Mock scheduleIdleCallback to execute immediately
vi.mock('@/shared/utils', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import required in mock factory
  const actual = await importOriginal<typeof import('@/shared/utils')>();
  return {
    ...actual,
    scheduleIdleCallback: (
      cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void
    ) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    },
    cancelIdleCallback: vi.fn(),
  };
});

const TEST_ID = layoutId('test-layout');

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 'test-layout-1234567890',
    layoutId: TEST_ID,
    timestamp: Date.now(),
    preview: { binCount: 1, layerCount: 1 },
    ...overrides,
  };
}

describe('useSnapshotAutoSave', () => {
  let addSnapshotSpy: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let loadForLayoutSpy: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Set up stores with valid state
    const layout = createTestLayout();
    const library = createTestLibrary(TEST_ID);

    useLayoutStore.setState({ layout, activeLayoutId: TEST_ID });
    useLibraryStore.setState({ library, isLoaded: true });

    // Mock store actions
    addSnapshotSpy = vi.fn().mockResolvedValue(undefined);
    loadForLayoutSpy = vi.fn().mockResolvedValue(undefined);
    useSnapshotStore.setState({
      snapshots: [],
      isLoading: false,
      addSnapshot: addSnapshotSpy,
      loadForLayout: loadForLayoutSpy,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('bootstrap (initial snapshot)', () => {
    const layoutWithBins = createTestLayout({
      bins: [
        {
          id: 'bin-1' as never,
          x: 0,
          y: 0,
          width: 1,
          depth: 1,
          height: 3,
          layerId: 'layer1' as never,
          category: 'cat1' as never,
          label: '',
          notes: '',
        },
      ],
    });

    it('creates initial snapshot when no snapshots exist for a non-empty layout', async () => {
      useLayoutStore.setState({ layout: layoutWithBins });

      renderHook(() => useSnapshotAutoSave());

      // Flush microtasks (loadForLayout promise)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(loadForLayoutSpy).toHaveBeenCalledWith(TEST_ID);
      expect(addSnapshotSpy).toHaveBeenCalledTimes(1);
    });

    it('does not create initial snapshot when snapshots already exist', async () => {
      useLayoutStore.setState({ layout: layoutWithBins });

      // After loadForLayout, set snapshots to non-empty
      loadForLayoutSpy.mockImplementation(() => {
        useSnapshotStore.setState({ snapshots: [makeSnapshot()] });
        return Promise.resolve();
      });

      renderHook(() => useSnapshotAutoSave());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(loadForLayoutSpy).toHaveBeenCalledWith(TEST_ID);
      expect(addSnapshotSpy).not.toHaveBeenCalled();
    });

    it('skips bootstrap for shared preview layouts', async () => {
      useLayoutStore.setState({
        layout: layoutWithBins,
        activeLayoutId: layoutId('__shared_preview__'),
      });

      renderHook(() => useSnapshotAutoSave());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(loadForLayoutSpy).not.toHaveBeenCalled();
    });

    it('skips bootstrap for empty layouts', async () => {
      // Default createTestLayout() has bins: [] — bootstrap should skip
      renderHook(() => useSnapshotAutoSave());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(loadForLayoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('periodic snapshots', () => {
    beforeEach(() => {
      // Pre-populate snapshots so bootstrap doesn't fire
      loadForLayoutSpy.mockImplementation(() => {
        useSnapshotStore.setState({ snapshots: [makeSnapshot()] });
        return Promise.resolve();
      });
    });

    it('does not create snapshot before 2 minutes', async () => {
      renderHook(() => useSnapshotAutoSave());

      // Flush bootstrap
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      addSnapshotSpy.mockClear();

      // Advance 1 minute
      vi.advanceTimersByTime(60_000);

      expect(addSnapshotSpy).not.toHaveBeenCalled();
    });

    it('creates snapshot after 2 minutes when layout has changed', async () => {
      renderHook(() => useSnapshotAutoSave());

      // Flush bootstrap
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      addSnapshotSpy.mockClear();

      // Simulate a layout change
      act(() => {
        useLayoutStore.setState({
          layout: createTestLayout({ name: 'Changed Layout' }),
        });
      });

      // Advance past 2 minutes
      await act(async () => {
        vi.advanceTimersByTime(121_000);
      });

      expect(addSnapshotSpy).toHaveBeenCalledTimes(1);
      expect(addSnapshotSpy).toHaveBeenCalledWith(
        'test-layout',
        expect.objectContaining({ name: 'Changed Layout' })
      );
    });

    it('skips snapshot when activeLayoutId is __shared_preview__', async () => {
      useLayoutStore.setState({
        activeLayoutId: layoutId('__shared_preview__'),
      });

      renderHook(() => useSnapshotAutoSave());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      addSnapshotSpy.mockClear();

      act(() => {
        useLayoutStore.setState({
          layout: createTestLayout({ name: 'Preview Change' }),
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(121_000);
      });

      expect(addSnapshotSpy).not.toHaveBeenCalled();
    });

    it('does not snapshot if layout has not changed', async () => {
      renderHook(() => useSnapshotAutoSave());

      // Flush bootstrap
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      addSnapshotSpy.mockClear();

      // Don't change the layout, just advance time
      await act(async () => {
        vi.advanceTimersByTime(121_000);
      });

      expect(addSnapshotSpy).not.toHaveBeenCalled();
    });

    it('cleans up interval on unmount', async () => {
      const { unmount } = renderHook(() => useSnapshotAutoSave());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      unmount();

      // No errors on unmount, interval cleaned up
    });
  });
});
