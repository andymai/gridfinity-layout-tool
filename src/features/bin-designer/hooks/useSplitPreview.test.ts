import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSplitPreview } from './useSplitPreview';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_UI_STATE,
  DEFAULT_GENERATION_STATE,
} from '@/features/bin-designer/constants/defaults';

// ── Bridge mock ──────────────────────────────────────────────────────────────

const mockGenerateSplitPreview = vi.fn();
const mockDraftGenerateSplitPreview = vi.fn();
// Exact-build time estimate consulted by the draft-skip gate. null = no
// history / worker busy → treated as slow → draft proceeds (the default, so
// existing draft tests are unaffected). A test can resolve a fast value to
// exercise the skip path.
const mockEstimateGenerate = vi.fn<() => Promise<number | null>>(() => Promise.resolve(null));
// Null by default → no draft bridge (exact-only), so existing exact-path tests
// are unaffected. Individual tests set a draft bridge to exercise arbitration.
type PreviewBridge = {
  generateSplitPreview: typeof mockDraftGenerateSplitPreview;
  isDestroyed: boolean;
} | null;
let mockPreviewBridge: PreviewBridge = null;
const mockReleasePreview = vi.fn();
// Overridable so a test can defer the bridge acquire (simulate a late load).
let acquirePreviewImpl: () => Promise<PreviewBridge> = () => Promise.resolve(mockPreviewBridge);

vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({
    generateSplitPreview: mockGenerateSplitPreview,
    estimateGenerate: mockEstimateGenerate,
    isDestroyed: false,
  }),
  createDraftSkipGate: () => () => 1000,
  workerPoolManager: {
    get: () => null,
    acquire: () => Promise.reject(new Error('No pool in test')),
    release: () => {},
  },
  bridgeManager: {
    acquirePreview: () => acquirePreviewImpl(),
    releasePreview: () => mockReleasePreview(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending microtasks so async effects resolve. */
async function flush(): Promise<void> {
  await act(async () => {
    // Several microtask cycles: the draft path awaits the exact-build estimate
    // before dispatching, then awaits the split result — each is its own hop.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** A minimal SplitPreview result with N pieces. */
function makeSplitResult(count = 1) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    col: i + 1,
    row: 1,
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    edgeVertices: new Float32Array(0),
  }));
  return { pieces };
}

/** A stub mesh entry for pre-seeding the store. */
const STUB_MESH_ENTRY = {
  col: 1,
  row: 1,
  mesh: {
    vertices: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    edgeVertices: new Float32Array(0),
  },
};

/** Set store to the common "oversized + exploded" state.
 *  Uses 'generating' status so tests can trigger the split preview
 *  by transitioning to 'complete' (simulating main generation finishing). */
function setOversizedExplodedState(overrides?: {
  width?: number;
  depth?: number;
  splitViewMode?: 'exploded' | 'assembled';
  generationStatus?: string;
}) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: overrides?.width ?? 8,
      ...(overrides?.depth !== undefined ? { depth: overrides.depth } : {}),
    },
    generation: {
      ...DEFAULT_GENERATION_STATE,
      status: overrides?.generationStatus ?? 'generating',
    },
    ui: {
      ...DEFAULT_UI_STATE,
      splitViewMode: overrides?.splitViewMode ?? 'exploded',
      splitPieceMeshes: [],
    },
  });
}

/** Simulate the main generation completing (generating → complete transition). */
function completeMainGeneration() {
  useDesignerStore.setState((s) => ({
    generation: { ...s.generation, status: 'complete' as const },
  }));
}

/** Reset both stores to a known baseline before each test. */
function resetStores() {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS },
    generation: { ...DEFAULT_GENERATION_STATE },
    ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
  });

  useSettingsStore.setState((state) => ({
    settings: {
      ...state.settings,
      defaultPrintBedSize: 256,
      defaultGridUnitMm: 42,
    },
  }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSplitPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    mockGenerateSplitPreview.mockResolvedValue(makeSplitResult(2));
    mockDraftGenerateSplitPreview.mockResolvedValue(makeSplitResult(2));
    mockEstimateGenerate.mockResolvedValue(null); // slow by default → draft proceeds
    mockPreviewBridge = null; // exact-only unless a test opts into the draft bridge
    acquirePreviewImpl = () => Promise.resolve(mockPreviewBridge);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Condition: bin does NOT need split ──────────────────────────────────

  it('does NOT call bridge when bin fits on print bed (small bin)', async () => {
    renderHook(() => useSplitPreview());
    await flush();

    expect(mockGenerateSplitPreview).not.toHaveBeenCalled();
  });

  it('clears splitPieceMeshes when bin no longer needs split', async () => {
    useDesignerStore.setState({
      ui: {
        ...DEFAULT_UI_STATE,
        splitViewMode: 'exploded',
        splitPieceMeshes: [STUB_MESH_ENTRY],
      },
      params: { ...DEFAULT_BIN_PARAMS, width: 2 },
    });

    renderHook(() => useSplitPreview());
    await flush();

    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(0);
  });

  // ── Condition: splitViewMode is 'assembled' ─────────────────────────────

  it('calls bridge in assembled mode too (meshes needed for both modes)', async () => {
    setOversizedExplodedState({ splitViewMode: 'assembled' });

    renderHook(() => useSplitPreview());
    completeMainGeneration();
    await flush();

    expect(mockGenerateSplitPreview).toHaveBeenCalledTimes(1);
  });

  it('keeps existing meshes when in assembled mode', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      generation: { ...DEFAULT_GENERATION_STATE, status: 'generating' },
      ui: {
        ...DEFAULT_UI_STATE,
        splitViewMode: 'assembled',
        splitPieceMeshes: [STUB_MESH_ENTRY],
      },
    });

    renderHook(() => useSplitPreview());
    completeMainGeneration();
    await flush();

    // Meshes are regenerated (bridge called), not cleared
    expect(mockGenerateSplitPreview).toHaveBeenCalledTimes(1);
  });

  // ── Condition: generation is NOT idle ──────────────────────────────────

  it('does NOT call bridge when generation is in progress', async () => {
    setOversizedExplodedState({ generationStatus: 'generating' });

    renderHook(() => useSplitPreview());
    await flush();

    expect(mockGenerateSplitPreview).not.toHaveBeenCalled();
  });

  it('does NOT call bridge when generation has errored', async () => {
    setOversizedExplodedState({ generationStatus: 'error' });

    renderHook(() => useSplitPreview());
    await flush();

    expect(mockGenerateSplitPreview).not.toHaveBeenCalled();
  });

  // ── Happy path: all conditions met ─────────────────────────────────────

  it('calls bridge after main generation completes (width split)', async () => {
    setOversizedExplodedState();

    renderHook(() => useSplitPreview());
    completeMainGeneration();
    await flush();

    expect(mockGenerateSplitPreview).toHaveBeenCalledTimes(1);
  });

  it('calls bridge after main generation completes (depth split)', async () => {
    setOversizedExplodedState({ width: 2, depth: 8 });

    renderHook(() => useSplitPreview());
    completeMainGeneration();
    await flush();

    expect(mockGenerateSplitPreview).toHaveBeenCalledTimes(1);
  });

  it('stores mesh entries returned by bridge into the designer store', async () => {
    setOversizedExplodedState();

    renderHook(() => useSplitPreview());
    completeMainGeneration();
    await flush();

    const meshes = useDesignerStore.getState().ui.splitPieceMeshes;
    expect(meshes).toHaveLength(2);
    expect(meshes[0]).toHaveProperty('mesh');
    expect(meshes[0]).toHaveProperty('col');
    expect(meshes[0]).toHaveProperty('row');
  });

  it('passes params and cut planes to bridge.generateSplitPreview', async () => {
    setOversizedExplodedState();

    renderHook(() => useSplitPreview());
    completeMainGeneration();
    await flush();

    const call = mockGenerateSplitPreview.mock.calls[0];
    expect(call[0]).toMatchObject({ width: 8 });
    expect(Array.isArray(call[1])).toBe(true);
    expect(Array.isArray(call[2])).toBe(true);
    expect(call[3]).toHaveProperty('splitConnectorConfig');
  });

  // ── Stale request guard ─────────────────────────────────────────────────

  it('ignores results from superseded requests (stale guard)', async () => {
    let resolveFirst!: (v: { pieces: unknown[] }) => void;
    let resolveSecond!: (v: { pieces: unknown[] }) => void;

    const firstResult = new Promise<{ pieces: unknown[] }>((res) => {
      resolveFirst = res;
    });
    const secondResult = new Promise<{ pieces: unknown[] }>((res) => {
      resolveSecond = res;
    });

    mockGenerateSplitPreview.mockReturnValueOnce(firstResult).mockReturnValueOnce(secondResult);
    setOversizedExplodedState();

    const { rerender } = renderHook(() => useSplitPreview());
    completeMainGeneration();
    rerender();

    // Simulate second param change + generation cycle
    act(() => {
      useDesignerStore.getState().setParam('width', 9);
      useDesignerStore.setState((s) => ({
        generation: { ...s.generation, status: 'generating' as const },
      }));
    });
    rerender();
    completeMainGeneration();
    rerender();

    // Resolve the newer request first
    await act(async () => {
      resolveSecond(makeSplitResult(3));
      await Promise.resolve();
    });
    const afterSecond = useDesignerStore.getState().ui.splitPieceMeshes;

    // Resolve the stale request -- should be ignored
    await act(async () => {
      resolveFirst(makeSplitResult(1));
      await Promise.resolve();
    });
    const afterFirst = useDesignerStore.getState().ui.splitPieceMeshes;

    expect(afterFirst).toHaveLength(afterSecond.length);
  });

  // ── Manifold draft path ─────────────────────────────────────────────────

  /** Enable the draft (Manifold) preview bridge for a test. */
  function enableDraftBridge() {
    mockPreviewBridge = {
      generateSplitPreview: mockDraftGenerateSplitPreview,
      isDestroyed: false,
    };
  }

  it('renders a draft split before the exact generation completes', async () => {
    enableDraftBridge();
    mockDraftGenerateSplitPreview.mockResolvedValue(makeSplitResult(2));
    // Status stays 'generating' — the exact path is gated on completion, so any
    // meshes here come from the draft.
    setOversizedExplodedState({ generationStatus: 'generating' });

    renderHook(() => useSplitPreview());
    await flush();

    expect(mockDraftGenerateSplitPreview).toHaveBeenCalledTimes(1);
    expect(mockGenerateSplitPreview).not.toHaveBeenCalled();
    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(2);
  });

  it('skips the draft when the exact build is predicted faster than the gate', async () => {
    enableDraftBridge();
    // Exact predicted at 50ms — under the 1000ms gate, so the draft would just
    // flicker before the exact lands. The gate suppresses it.
    mockEstimateGenerate.mockResolvedValue(50);
    mockDraftGenerateSplitPreview.mockResolvedValue(makeSplitResult(2));
    setOversizedExplodedState({ generationStatus: 'generating' });

    renderHook(() => useSplitPreview());
    await flush();

    expect(mockDraftGenerateSplitPreview).not.toHaveBeenCalled();
  });

  it('exact result supersedes the draft once main generation completes', async () => {
    enableDraftBridge();
    mockDraftGenerateSplitPreview.mockResolvedValue(makeSplitResult(2));
    mockGenerateSplitPreview.mockResolvedValue(makeSplitResult(4));
    setOversizedExplodedState({ generationStatus: 'generating' });

    const { rerender } = renderHook(() => useSplitPreview());
    await flush(); // draft lands (2 pieces)
    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(2);

    completeMainGeneration();
    rerender();
    await flush(); // exact lands (4 pieces), superseding the draft

    expect(mockGenerateSplitPreview).toHaveBeenCalledTimes(1);
    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(4);
  });

  it('drops a slow draft that resolves after the exact result finalized', async () => {
    enableDraftBridge();
    // Draft resolves manually, after the exact result.
    let resolveDraft: (r: ReturnType<typeof makeSplitResult>) => void = () => {};
    mockDraftGenerateSplitPreview.mockReturnValue(
      new Promise((res) => {
        resolveDraft = res;
      })
    );
    mockGenerateSplitPreview.mockResolvedValue(makeSplitResult(4));
    setOversizedExplodedState({ generationStatus: 'generating' });

    const { rerender } = renderHook(() => useSplitPreview());
    await flush();

    completeMainGeneration();
    rerender();
    await flush(); // exact lands (4 pieces) and finalizes the token
    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(4);

    // The stale draft resolves late — must NOT clobber the exact result.
    await act(async () => {
      resolveDraft(makeSplitResult(2));
      await Promise.resolve();
    });
    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(4);
  });

  it('does NOT downgrade the exact result when the draft bridge loads late', async () => {
    // The bridge resolves only when we call it — simulating Manifold loading
    // after the exact split has already finalized for this edit.
    let resolveAcquire: (b: PreviewBridge) => void = () => {};
    acquirePreviewImpl = () =>
      new Promise<PreviewBridge>((res) => {
        resolveAcquire = res;
      });
    mockGenerateSplitPreview.mockResolvedValue(makeSplitResult(4));
    mockDraftGenerateSplitPreview.mockResolvedValue(makeSplitResult(2));
    setOversizedExplodedState({ generationStatus: 'generating' });

    const { rerender } = renderHook(() => useSplitPreview());
    completeMainGeneration();
    rerender();
    await flush(); // exact lands (4 pieces) and finalizes — no draft bridge yet
    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(4);

    // Bridge finishes loading now (late). The previewReady re-fire must NOT
    // dispatch a draft for the already-finalized edit, nor overwrite the exact.
    await act(async () => {
      resolveAcquire({
        generateSplitPreview: mockDraftGenerateSplitPreview,
        isDestroyed: false,
      });
      await Promise.resolve();
    });
    await flush();

    expect(mockDraftGenerateSplitPreview).not.toHaveBeenCalled();
    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(4);
  });

  // ── Switching between modes preserves meshes ────────────────────────────

  it('preserves meshes when switching from exploded to assembled', async () => {
    setOversizedExplodedState();

    const { rerender } = renderHook(() => useSplitPreview());
    completeMainGeneration();
    await flush();

    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(2);

    act(() => {
      useDesignerStore.getState().setSplitViewMode('assembled');
    });
    rerender();
    await flush();

    // Meshes persist — SplitBinMeshes uses them in both modes
    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(2);
  });
});
