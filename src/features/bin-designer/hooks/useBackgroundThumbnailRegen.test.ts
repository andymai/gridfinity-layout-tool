/**
 * Tests for the background thumbnail-regen hook.
 *
 * The full pipeline (Three.js + WASM bridge) can't run in jsdom, so the tests
 * focus on the orchestration:
 *   - one-shot scheduling under StrictMode-style remounts
 *   - the sync-settled gate for authenticated vs anonymous sessions
 *   - the generationStatus pause / resume signal
 *   - the batch summary event shape on completion + on early abort
 *
 * `regenerateThumbnail` and `updateDesignThumbnail` are mocked; we assert the
 * loop's *control flow*, not the rendering output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ok, err, storageUnavailable } from '@/core/result';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '../constants/defaults';
import { THUMBNAIL_VERSION } from '../types';
import type { SavedDesign } from '../types';
import { designId } from '@/core/types';

vi.mock('../utils/thumbnailRegenerator', () => ({
  regenerateThumbnail: vi.fn(),
}));

vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  listDesigns: vi.fn(),
  updateDesignThumbnail: vi.fn(),
}));

vi.mock('../store/customBinRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof CustomBinRegistry>();
  return {
    upsertRegistryEntry: vi.fn(),
    loadRegistry: vi.fn(() => []),
    registryAssemblyEntry: actual.registryAssemblyEntry,
    registryEdgeFields: vi.fn(() => ({})),
    registryHeightFields: vi.fn(() => ({})),
    registryOverhangFields: vi.fn(() => ({})),
    registryKnifeRestFields: vi.fn(() => ({})),
  };
});

vi.mock('./useDesignThumbnail', () => ({
  updateThumbnailCache: vi.fn(),
}));

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: {
    acquire: vi.fn().mockResolvedValue({}),
    release: vi.fn(),
  },
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

import { regenerateThumbnail } from '../utils/thumbnailRegenerator';
import type * as CustomBinRegistry from '../store/customBinRegistry';
import { loadRegistry, upsertRegistryEntry } from '../store/customBinRegistry';
import * as DesignerStorage from '@/features/bin-designer/storage/DesignerStorage';
import { bridgeManager } from '@/shared/generation/bridge';
import { trackEvent } from '@/shared/analytics/posthog';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSyncStatusStore } from '@/core/sync/status';
import { useDesignerStore } from '../store/designer';
import { useBackgroundThumbnailRegen, __resetForTests } from './useBackgroundThumbnailRegen';
import { resetAllStores } from '@/test/testUtils';

function makeDesign(
  overrides: Partial<Omit<SavedDesign, 'id'>> & { id?: string } = {}
): SavedDesign {
  const { id, ...rest } = overrides;
  return {
    id: designId(id ?? 'design-1'),
    name: 'Test Bin',
    params: { ...DEFAULT_BIN_PARAMS },
    thumbnail: null,
    thumbnailVersion: undefined,
    exportFileNameConfig: null,
    createdAt: '2026-05-19T00:00:00.000Z',
    updatedAt: '2026-05-19T00:00:00.000Z',
    ...rest,
  };
}

function makeAssembly(id: string, overrides: Partial<SavedDesign> = {}): SavedDesign {
  const { params: _params, ...bin } = makeDesign({ id, name: 'Workshop build' });
  return {
    ...bin,
    kind: 'assembly',
    envelope: {
      width: 4,
      depth: 2,
      gridUnitMm: 42,
      heightUnitMm: 7,
      attachment: {
        magnetHoles: false,
        magnetDiameter: 6.5,
        magnetDepth: 2.4,
        screwHoles: false,
        screwDiameter: 3,
      },
      featureColors: { enabled: false },
    } as SavedDesign['envelope'],
    structure: {
      kind: 'assembly',
      schemaVersion: 1,
      base: { floorThickness: 2 },
      mirrorAxis: 'x',
      parts: [],
    },
    ...overrides,
  };
}

/**
 * jsdom doesn't ship rIC. Polyfill to a microtask so tests don't depend on
 * real idle time, and so the loop's yield-between-items resolves promptly.
 */
function installIdlePolyfill(): () => void {
  const originalRic = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  const originalCancel = (window as unknown as { cancelIdleCallback?: (id: number) => void })
    .cancelIdleCallback;
  (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback = (
    cb
  ) => {
    queueMicrotask(cb);
    return 0;
  };
  (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback = () => {};
  return () => {
    if (originalRic) {
      (window as unknown as { requestIdleCallback: typeof originalRic }).requestIdleCallback =
        originalRic;
    } else {
      delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    }
    if (originalCancel) {
      (window as unknown as { cancelIdleCallback: typeof originalCancel }).cancelIdleCallback =
        originalCancel;
    } else {
      delete (window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback;
    }
  };
}

describe('useBackgroundThumbnailRegen', () => {
  let restoreIdle: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetForTests();
    // Reset shared Zustand stores per project convention (see src/test/README.md).
    // `resetAllStores` doesn't cover the session/sync/designer stores this
    // hook reads, so those still need explicit setState below.
    resetAllStores();
    restoreIdle = installIdlePolyfill();

    // Anonymous + idle by default. Tests opt into authenticated/syncing.
    useSessionStore.setState({ status: 'anonymous', user: null });
    useSyncStatusStore.setState({
      state: 'idle',
      pendingCount: 0,
      lastSyncedAt: undefined,
      lastError: undefined,
    });
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });

    vi.mocked(regenerateThumbnail).mockResolvedValue('data:image/webp;base64,FAKE');
    vi.mocked(DesignerStorage.updateDesignThumbnail).mockImplementation((id) =>
      Promise.resolve(
        ok({
          id,
          name: 'Test Bin',
          params: { ...DEFAULT_BIN_PARAMS },
          thumbnail: 'data:image/webp;base64,FAKE',
          thumbnailVersion: THUMBNAIL_VERSION,
          exportFileNameConfig: null,
          createdAt: '2026-05-19T00:00:00.000Z',
          updatedAt: '2026-05-19T00:01:00.000Z',
        })
      )
    );
  });

  afterEach(() => {
    restoreIdle();
  });

  it('does nothing when no designs need regeneration', async () => {
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(
      ok([
        makeDesign({
          thumbnail: 'data:image/webp;base64,VALID',
          thumbnailVersion: THUMBNAIL_VERSION,
        }),
      ])
    );

    renderHook(() => useBackgroundThumbnailRegen());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(regenerateThumbnail).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('regenerates designs with missing or outdated thumbnails and writes a batch-summary event', async () => {
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(
      ok([
        makeDesign({ id: 'd1', thumbnail: null }),
        makeDesign({ id: 'd2', thumbnail: 'stale', thumbnailVersion: 0 }),
        makeDesign({ id: 'd3', thumbnail: 'fresh', thumbnailVersion: THUMBNAIL_VERSION }),
      ])
    );

    renderHook(() => useBackgroundThumbnailRegen());

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalled();
    });

    expect(regenerateThumbnail).toHaveBeenCalledTimes(2);
    expect(DesignerStorage.updateDesignThumbnail).toHaveBeenCalledWith(
      'd1',
      'data:image/webp;base64,FAKE'
    );
    expect(DesignerStorage.updateDesignThumbnail).toHaveBeenCalledWith(
      'd2',
      'data:image/webp;base64,FAKE'
    );
    expect(trackEvent).toHaveBeenCalledWith(
      'bin_designer_bg_thumbnail_regen',
      expect.objectContaining({
        designs_total: 2,
        designs_regenerated: 2,
        designs_failed: 0,
      })
    );
    // Bridge held once for the whole batch, not per design.
    expect(bridgeManager.acquire).toHaveBeenCalledTimes(1);
    expect(bridgeManager.release).toHaveBeenCalledTimes(1);
  });

  it('counts a regen as failed when the renderer returns null', async () => {
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(
      ok([makeDesign({ id: 'd1' }), makeDesign({ id: 'd2' })])
    );
    vi.mocked(regenerateThumbnail)
      .mockResolvedValueOnce('data:image/webp;base64,OK')
      .mockResolvedValueOnce(null);

    renderHook(() => useBackgroundThumbnailRegen());

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalled();
    });

    expect(trackEvent).toHaveBeenCalledWith(
      'bin_designer_bg_thumbnail_regen',
      expect.objectContaining({
        designs_total: 2,
        designs_regenerated: 1,
        designs_failed: 1,
      })
    );
    // The failed design wasn't written to IndexedDB.
    expect(DesignerStorage.updateDesignThumbnail).toHaveBeenCalledTimes(1);
  });

  it('counts a regen as failed when the IndexedDB write fails', async () => {
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(ok([makeDesign({ id: 'd1' })]));
    vi.mocked(DesignerStorage.updateDesignThumbnail).mockResolvedValueOnce(
      err(storageUnavailable('indexedDB', new Error('quota')))
    );

    renderHook(() => useBackgroundThumbnailRegen());

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalled();
    });

    expect(trackEvent).toHaveBeenCalledWith(
      'bin_designer_bg_thumbnail_regen',
      expect.objectContaining({ designs_regenerated: 0, designs_failed: 1 })
    );
  });

  it('runs only once across remounts (one-shot per session)', async () => {
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(ok([makeDesign({ id: 'd1' })]));

    const { unmount } = renderHook(() => useBackgroundThumbnailRegen());

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledTimes(1);
    });

    unmount();
    renderHook(() => useBackgroundThumbnailRegen());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(regenerateThumbnail).toHaveBeenCalledTimes(1);
  });

  it('waits for sync to settle before scanning when authenticated', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', email: 'a@b.c', provider: 'google' },
    });
    useSyncStatusStore.setState({
      state: 'syncing',
      pendingCount: 0,
      lastSyncedAt: undefined,
      lastError: undefined,
    });
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(ok([makeDesign({ id: 'd1' })]));

    renderHook(() => useBackgroundThumbnailRegen());

    // While sync is still in flight, the scan hasn't started.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(DesignerStorage.listDesigns).not.toHaveBeenCalled();

    // Settle sync.
    act(() => {
      useSyncStatusStore.setState({
        state: 'idle',
        pendingCount: 0,
        lastSyncedAt: Date.now(),
        lastError: undefined,
      });
    });

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalled();
    });
    expect(regenerateThumbnail).toHaveBeenCalled();
  });

  it('skips the sync gate for anonymous sessions and runs immediately', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    useSyncStatusStore.setState({
      state: 'idle',
      pendingCount: 0,
      lastSyncedAt: undefined, // never synced — that's fine for anon
      lastError: undefined,
    });
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(ok([makeDesign({ id: 'd1' })]));

    renderHook(() => useBackgroundThumbnailRegen());

    await waitFor(() => {
      expect(regenerateThumbnail).toHaveBeenCalled();
    });
  });

  it('aborts cleanly on unmount mid-batch without firing telemetry', async () => {
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(
      ok([makeDesign({ id: 'd1' }), makeDesign({ id: 'd2' })])
    );
    // Hold the first regen call open so we can unmount mid-flight.
    const deferredFirst: { resolve: ((v: string | null) => void) | null } = { resolve: null };
    vi.mocked(regenerateThumbnail).mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          deferredFirst.resolve = resolve;
        })
    );

    const { unmount } = renderHook(() => useBackgroundThumbnailRegen());

    // Wait until the first regen call has been issued.
    await waitFor(() => {
      expect(regenerateThumbnail).toHaveBeenCalledTimes(1);
    });

    unmount();
    deferredFirst.resolve?.('data:image/webp;base64,OK');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Second design never started because the controller aborted.
    expect(regenerateThumbnail).toHaveBeenCalledTimes(1);
    // No batch summary on abort.
    expect(trackEvent).not.toHaveBeenCalled();
  });

  // A stored Workshop design with no registry entry reads as a parametric bin
  // in the layout, so the startup pass registers it.
  describe('unregistered assemblies', () => {
    it('registers an assembly that has no registry entry, without a thumbnail render', async () => {
      vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(ok([makeAssembly('w')]));

      renderHook(() => useBackgroundThumbnailRegen());

      await waitFor(() => {
        expect(upsertRegistryEntry).toHaveBeenCalledTimes(1);
      });
      expect(upsertRegistryEntry).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w', name: 'Workshop build', kind: 'assembly', width: 4 })
      );
      expect(regenerateThumbnail).not.toHaveBeenCalled();
    });

    it('leaves an assembly that already has an entry alone, kind or not', async () => {
      vi.mocked(loadRegistry).mockReturnValueOnce([
        {
          id: designId('w'),
          name: 'Renamed',
          width: 1,
          depth: 1,
          height: 3,
          updatedAt: '2026-05-19T00:00:00.000Z',
        },
      ]);
      vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(
        ok([makeAssembly('w', { thumbnail: 'fresh', thumbnailVersion: THUMBNAIL_VERSION })])
      );

      renderHook(() => useBackgroundThumbnailRegen());

      await waitFor(() => {
        expect(DesignerStorage.listDesigns).toHaveBeenCalled();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
      expect(upsertRegistryEntry).not.toHaveBeenCalled();
    });

    it('registers nothing for a bin whose thumbnail is current', async () => {
      vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(
        ok([makeDesign({ id: 'd1', thumbnail: 'fresh', thumbnailVersion: THUMBNAIL_VERSION })])
      );

      renderHook(() => useBackgroundThumbnailRegen());

      await waitFor(() => {
        expect(DesignerStorage.listDesigns).toHaveBeenCalled();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
      expect(upsertRegistryEntry).not.toHaveBeenCalled();
    });
  });
});
