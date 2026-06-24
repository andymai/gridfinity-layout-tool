import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeneration } from './useGeneration';
import { useDesignerStore } from '../store';
import type { GenerationBridge } from '@/shared/generation/bridge';

// Mock bridgeManager to isolate tests from the singleton
const mockBridge = {
  isDestroyed: false,
  init: vi.fn(),
  generate: vi.fn(),
  generateImmediate: vi.fn(),
  estimateGenerate: vi.fn(),
  destroy: vi.fn(),
  cancel: vi.fn(),
  getThreadingInfo: vi.fn(() => ({ isThreaded: false, hardwareConcurrency: 4 })),
} as unknown as GenerationBridge;

const mockAcquire = vi.fn<() => Promise<GenerationBridge>>();
const mockRelease = vi.fn();
const mockGet = vi.fn<() => GenerationBridge | null>();
const mockAcquirePreview = vi.fn<() => Promise<GenerationBridge | null>>();
const mockReleasePreview = vi.fn();

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: {
    acquire: () => mockAcquire(),
    release: () => mockRelease(),
    get: () => mockGet(),
    acquirePreview: () => mockAcquirePreview(),
    releasePreview: () => mockReleasePreview(),
  },
  GenerationBridge: vi.fn(),
  getActiveBridge: vi.fn(),
  FAST_EXACT_SKIP_MS: 1000,
  // Stable threshold — burst behavior is covered by draftPolicy's own tests.
  createDraftSkipGate: () => () => 1000,
}));

// Pristine default params, captured before any test mutates the store singleton.
// Tests that toggle a feature (e.g. scoop, to force a fallback path) must not
// leak it into the next test, so beforeEach restores this.
const PRISTINE_PARAMS = useDesignerStore.getState().params;

describe('useGeneration', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Reset mock bridge state
    (mockBridge as { isDestroyed: boolean }).isDestroyed = false;
    (mockBridge.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
      mesh: {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        indices: new Uint32Array([0, 1, 2]),
        edgeVertices: new Float32Array(0),
        triangleCount: 1,
      },
      timingMs: 5,
    });
    (mockBridge.getThreadingInfo as ReturnType<typeof vi.fn>).mockReturnValue({
      isThreaded: false,
      hardwareConcurrency: 4,
    });

    mockAcquire.mockReset();
    mockAcquire.mockResolvedValue(mockBridge);
    mockRelease.mockReset();
    mockGet.mockReset();
    mockGet.mockReturnValue(mockBridge);
    mockAcquirePreview.mockReset();
    mockAcquirePreview.mockResolvedValue(null); // preview off by default
    mockReleasePreview.mockReset();
    // Unknown estimate = slow → the draft path stays active unless a test
    // explicitly predicts a fast exact.
    (mockBridge.estimateGenerate as ReturnType<typeof vi.fn>).mockReset();
    (mockBridge.estimateGenerate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // Full store reset — including params, so a feature toggled by one test
    // (forcing a fallback) can't change the next test's direct-mesh eligibility.
    useDesignerStore.setState({
      wasmStatus: 'unloaded',
      generation: { status: 'idle', mesh: null, isDraft: false, progress: 0 },
      params: PRISTINE_PARAMS,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes the worker on mount', async () => {
    renderHook(() => useGeneration());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(mockAcquire).toHaveBeenCalledTimes(1);
    expect(useDesignerStore.getState().wasmStatus).toBe('ready');
  });

  it('sets wasmStatus to loading then ready', async () => {
    expect(useDesignerStore.getState().wasmStatus).toBe('unloaded');

    renderHook(() => useGeneration());

    // Immediately after mount, should be loading
    expect(useDesignerStore.getState().wasmStatus).toBe('loading');

    // After init completes
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(useDesignerStore.getState().wasmStatus).toBe('ready');
  });

  it('triggers initial generation after init', async () => {
    renderHook(() => useGeneration());

    // acquire() resolves + initial generation triggers
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Wait for the generate call (which goes through the bridge, not Worker directly)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(201);
    });

    const state = useDesignerStore.getState();
    expect(state.generation.status).toBe('complete');
    expect(state.generation.mesh).not.toBeNull();
    expect(state.generation.mesh?.vertices).not.toBeNull();
  });

  it('regenerates when params change', async () => {
    renderHook(() => useGeneration());

    // Complete initial generation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(201);
    });

    expect(useDesignerStore.getState().generation.status).toBe('complete');

    // Change params
    act(() => {
      useDesignerStore.getState().setParam('width', 4);
    });

    // Wait for re-generation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(201);
    });

    expect(useDesignerStore.getState().generation.status).toBe('complete');
  });

  it('releases bridge on unmount', async () => {
    const { unmount } = renderHook(() => useGeneration());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockAcquire).toHaveBeenCalledTimes(1);

    unmount();

    // Should call release() to decrement ref count
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('handles generation error', async () => {
    (mockBridge.generate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Generation failed')
    );

    renderHook(() => useGeneration());

    // acquire() resolves
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Wait for generation attempt
    await act(async () => {
      await vi.advanceTimersByTimeAsync(201);
    });

    const state = useDesignerStore.getState();
    expect(state.generation.status).toBe('error');
    expect(state.generation.mesh?.error).toBe('Generation failed');
  });

  it('renders the draft first, then the exact result supersedes it (manifold_preview)', async () => {
    const draftVerts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const exactVerts = new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]);
    const meshOf = (vertices: Float32Array, timingMs = 1) => ({
      mesh: {
        vertices,
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        indices: new Uint32Array([0, 1, 2]),
        edgeVertices: new Float32Array(0),
        triangleCount: 1,
      },
      timingMs,
    });

    const previewBridge = {
      isDestroyed: false,
      generateImmediate: vi.fn().mockResolvedValue(meshOf(draftVerts)),
      destroy: vi.fn(),
    } as unknown as GenerationBridge;
    mockAcquirePreview.mockResolvedValue(previewBridge);

    // The initial render runs exact-only (preview bridge isn't acquired until
    // after the first generation). Its SLOW timing (>= FAST_EXACT_SKIP_MS)
    // keeps the draft path active for the edit, whose exact is held open so
    // the draft is guaranteed to apply first.
    let resolveExact: (v: unknown) => void = () => {};
    (mockBridge.generate as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(meshOf(exactVerts, 5000))
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveExact = r;
        })
      );

    renderHook(() => useGeneration());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Initial generation is exact-only — no draft, preview now acquired.
    expect(useDesignerStore.getState().generation.isDraft).toBe(false);

    // Edit now that the preview bridge is live → draft on the leading edge.
    // Enable a scoop so the bin is NOT direct-mesh-eligible: that forces the
    // async Manifold draft path this test exercises (a simple bin would instead
    // paint the synchronous direct mesh — covered separately below).
    await act(async () => {
      useDesignerStore.setState((s) => ({
        params: { ...s.params, scoop: { ...s.params.scoop, enabled: true } },
        generation: { ...s.generation, epoch: 1 },
      }));
      await vi.advanceTimersByTimeAsync(1);
    });

    // Draft on screen; status stays 'generating' (exact still computing).
    let gen = useDesignerStore.getState().generation;
    expect(gen.isDraft).toBe(true);
    expect(gen.mesh?.vertices).toBe(draftVerts);
    expect(gen.status).toBe('generating');

    // Exact lands and supersedes the draft.
    await act(async () => {
      resolveExact(meshOf(exactVerts));
      await vi.advanceTimersByTimeAsync(1);
    });

    gen = useDesignerStore.getState().generation;
    expect(gen.isDraft).toBe(false);
    expect(gen.mesh?.vertices).toBe(exactVerts);
    expect(gen.status).toBe('complete');
  });

  it('paints a synchronous direct-mesh draft for a simple bin, suppressing the Manifold draft', async () => {
    const draftVerts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const exactVerts = new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]);
    const meshOf = (vertices: Float32Array, timingMs = 1) => ({
      mesh: {
        vertices,
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        indices: new Uint32Array([0, 1, 2]),
        edgeVertices: new Float32Array(0),
        triangleCount: 1,
      },
      timingMs,
    });

    const generateImmediate = vi.fn().mockResolvedValue(meshOf(draftVerts));
    const previewBridge = {
      isDestroyed: false,
      generateImmediate,
      destroy: vi.fn(),
    } as unknown as GenerationBridge;
    mockAcquirePreview.mockResolvedValue(previewBridge);

    let resolveExact: (v: unknown) => void = () => {};
    (mockBridge.generate as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(meshOf(exactVerts, 5000))
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveExact = r;
        })
      );

    renderHook(() => useGeneration());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Edit on the default (direct-mesh-eligible) bin. The procedural mesh paints
    // synchronously before the worker runs and the slower Manifold draft is
    // suppressed, so a detailed draft — not the single-triangle Manifold mock —
    // is on screen while the exact result is held open.
    generateImmediate.mockClear();
    await act(async () => {
      useDesignerStore.setState((s) => ({ generation: { ...s.generation, epoch: 1 } }));
      await vi.advanceTimersByTimeAsync(1);
    });

    let gen = useDesignerStore.getState().generation;
    expect(gen.isDraft).toBe(true);
    expect(gen.status).toBe('generating');
    // The detailed direct mesh is on screen (hundreds of vertices) — never the
    // 3-vertex Manifold draft, which is suppressed once the direct mesh paints,
    // so the user sees a single draft→exact swap, not draft→draft→exact.
    expect(gen.mesh?.vertices).not.toBe(draftVerts);
    expect(gen.mesh?.vertices?.length ?? 0).toBeGreaterThan(100);

    // The Manifold draft stays suppressed even after timers flush — it must
    // never overwrite the direct mesh with its own (draftVerts) result.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(useDesignerStore.getState().generation.mesh?.vertices).not.toBe(draftVerts);

    // Exact lands and supersedes the direct-mesh draft.
    await act(async () => {
      resolveExact(meshOf(exactVerts));
      await vi.advanceTimersByTimeAsync(1);
    });
    gen = useDesignerStore.getState().generation;
    expect(gen.isDraft).toBe(false);
    expect(gen.mesh?.vertices).toBe(exactVerts);
    expect(gen.status).toBe('complete');
  });

  it('renders a Manifold pre-draft while the exact worker is still loading (cold start)', async () => {
    const draftVerts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const previewBridge = {
      isDestroyed: false,
      generateImmediate: vi.fn().mockResolvedValue({
        mesh: {
          vertices: draftVerts,
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          triangleCount: 1,
        },
        timingMs: 1,
      }),
      destroy: vi.fn(),
    } as unknown as GenerationBridge;
    mockAcquirePreview.mockResolvedValue(previewBridge);

    // Hold the exact bridge open — the Manifold worker's WASM is far smaller,
    // so on a real cold start it resolves seconds earlier.
    let resolveAcquire: (bridge: GenerationBridge) => void = () => {};
    mockAcquire.mockReturnValue(
      new Promise<GenerationBridge>((r) => {
        resolveAcquire = r;
      })
    );

    renderHook(() => useGeneration());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Pre-draft on screen while the exact worker is still initializing.
    let state = useDesignerStore.getState();
    expect(state.wasmStatus).toBe('loading');
    expect(state.generation.isDraft).toBe(true);
    expect(state.generation.mesh?.vertices).toBe(draftVerts);

    // Exact bridge arrives → initial generation supersedes the pre-draft.
    await act(async () => {
      resolveAcquire(mockBridge);
      await vi.advanceTimersByTimeAsync(1);
    });

    state = useDesignerStore.getState();
    expect(state.wasmStatus).toBe('ready');
    expect(state.generation.isDraft).toBe(false);
    expect(state.generation.status).toBe('complete');
    expect(state.generation.mesh?.vertices).not.toBe(draftVerts);
  });

  it('skips the draft when the last exact was fast — no flicker (manifold_preview)', async () => {
    const previewBridge = {
      isDestroyed: false,
      // Resolves defensively so a wrongly-dispatched draft fails the assertion
      // below rather than crashing on `.then` of undefined.
      generateImmediate: vi.fn().mockResolvedValue({
        mesh: {
          vertices: new Float32Array(9),
          normals: new Float32Array(9),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          triangleCount: 1,
        },
        timingMs: 1,
      }),
      destroy: vi.fn(),
    } as unknown as GenerationBridge;
    mockAcquirePreview.mockResolvedValue(previewBridge);
    // The exact worker's cache-aware estimate predicts a fast build — well
    // under FAST_EXACT_SKIP_MS — so the draft must not be dispatched.
    (mockBridge.estimateGenerate as ReturnType<typeof vi.fn>).mockResolvedValue(200);

    renderHook(() => useGeneration());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Edit after a fast exact → straight to exact, no draft.
    await act(async () => {
      useDesignerStore.setState((s) => ({ generation: { ...s.generation, epoch: 1 } }));
      await vi.advanceTimersByTimeAsync(201);
    });

    expect(previewBridge.generateImmediate).not.toHaveBeenCalled();
    const gen = useDesignerStore.getState().generation;
    expect(gen.isDraft).toBe(false);
    expect(gen.status).toBe('complete');
  });
});
