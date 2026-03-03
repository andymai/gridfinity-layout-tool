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

vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({
    generateSplitPreview: mockGenerateSplitPreview,
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending microtasks so async effects resolve. */
async function flush(): Promise<void> {
  await act(async () => {
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
