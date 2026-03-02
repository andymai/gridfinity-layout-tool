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

/** A minimal SplitPreview result with one piece. */
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

/** Reset both stores to a known baseline before each test. */
function resetStores() {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS },
    generation: { ...DEFAULT_GENERATION_STATE },
    ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
  });

  // Restore settings defaults (256mm bed / 42mm grid → maxGridUnits = 6)
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
    // DEFAULT_BIN_PARAMS has width=2, depth=2 — both well under maxGridUnits=6
    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGenerateSplitPreview).not.toHaveBeenCalled();
  });

  it('clears splitPieceMeshes when bin no longer needs split', async () => {
    // Pre-seed some meshes so we can confirm they get wiped
    useDesignerStore.setState({
      ui: {
        ...DEFAULT_UI_STATE,
        splitViewMode: 'exploded',
        splitPieceMeshes: [
          {
            col: 1,
            row: 1,
            mesh: {
              vertices: new Float32Array(0),
              normals: new Float32Array(0),
              indices: new Uint32Array(0),
              edgeVertices: new Float32Array(0),
            },
          },
        ],
      },
      params: { ...DEFAULT_BIN_PARAMS, width: 2 }, // small — doesn't need split
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(0);
  });

  // ── Condition: splitViewMode is 'assembled' ─────────────────────────────

  it('does NOT call bridge when splitViewMode is assembled', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 }, // large — would need split
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'assembled', splitPieceMeshes: [] },
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGenerateSplitPreview).not.toHaveBeenCalled();
  });

  it('clears existing meshes when switching to assembled mode', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      ui: {
        ...DEFAULT_UI_STATE,
        splitViewMode: 'assembled',
        splitPieceMeshes: [
          {
            col: 1,
            row: 1,
            mesh: {
              vertices: new Float32Array(0),
              normals: new Float32Array(0),
              indices: new Uint32Array(0),
              edgeVertices: new Float32Array(0),
            },
          },
        ],
      },
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(0);
  });

  // ── Condition: generation is NOT idle ──────────────────────────────────

  it('does NOT call bridge when generation is in progress', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      generation: { status: 'generating', mesh: null, progress: 0.5, epoch: 0 },
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGenerateSplitPreview).not.toHaveBeenCalled();
  });

  it('does NOT call bridge when generation has errored', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      generation: { status: 'error', mesh: null, progress: 0, epoch: 0 },
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGenerateSplitPreview).not.toHaveBeenCalled();
  });

  // ── Happy path: all conditions met ─────────────────────────────────────

  it('calls bridge when exploded + needsSplit (width) + idle', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      generation: { ...DEFAULT_GENERATION_STATE, status: 'idle' },
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGenerateSplitPreview).toHaveBeenCalledTimes(1);
  });

  it('calls bridge when exploded + needsSplit (depth) + idle', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, depth: 8 },
      generation: { ...DEFAULT_GENERATION_STATE, status: 'idle' },
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGenerateSplitPreview).toHaveBeenCalledTimes(1);
  });

  it('stores mesh entries returned by bridge into the designer store', async () => {
    mockGenerateSplitPreview.mockResolvedValue(makeSplitResult(2));

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      generation: { ...DEFAULT_GENERATION_STATE, status: 'idle' },
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    const meshes = useDesignerStore.getState().ui.splitPieceMeshes;
    expect(meshes).toHaveLength(2);
    expect(meshes[0]).toHaveProperty('mesh');
    expect(meshes[0]).toHaveProperty('col');
    expect(meshes[0]).toHaveProperty('row');
  });

  it('passes params and cut planes to bridge.generateSplitPreview', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      generation: { ...DEFAULT_GENERATION_STATE, status: 'idle' },
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
    });

    renderHook(() => useSplitPreview());

    await act(async () => {
      await Promise.resolve();
    });

    // The hook passes params directly — width must be 8, cutPlanes are arrays.
    // splitConnectorConfig comes from params.splitConnectors (undefined when not set).
    const call = mockGenerateSplitPreview.mock.calls[0];
    expect(call[0]).toMatchObject({ width: 8 });
    expect(Array.isArray(call[1])).toBe(true); // cutPlanesX
    expect(Array.isArray(call[2])).toBe(true); // cutPlanesY
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

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      generation: { ...DEFAULT_GENERATION_STATE, status: 'idle' },
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
    });

    const { rerender } = renderHook(() => useSplitPreview());

    // Trigger a second call by changing params — this bumps requestIdRef
    act(() => {
      useDesignerStore.getState().setParam('width', 9);
    });
    rerender();

    await act(async () => {
      // Resolve the SECOND (newer) request first — sets meshes from second call
      resolveSecond(makeSplitResult(3));
      await Promise.resolve();
    });

    const afterSecond = useDesignerStore.getState().ui.splitPieceMeshes;

    await act(async () => {
      // Now resolve the FIRST (stale) request — should be ignored
      resolveFirst(makeSplitResult(1));
      await Promise.resolve();
    });

    // Stale result should NOT overwrite the newer result
    const afterFirst = useDesignerStore.getState().ui.splitPieceMeshes;
    expect(afterFirst).toHaveLength(afterSecond.length);
  });

  // ── Switching from exploded → assembled clears meshes ──────────────────

  it('clears meshes when switching from exploded to assembled after bridge returned results', async () => {
    mockGenerateSplitPreview.mockResolvedValue(makeSplitResult(2));

    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
      generation: { ...DEFAULT_GENERATION_STATE, status: 'idle' },
      ui: { ...DEFAULT_UI_STATE, splitViewMode: 'exploded', splitPieceMeshes: [] },
    });

    const { rerender } = renderHook(() => useSplitPreview());

    // Let the bridge resolve and meshes populate
    await act(async () => {
      await Promise.resolve();
    });

    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(2);

    // Switch to assembled
    act(() => {
      useDesignerStore.getState().setSplitViewMode('assembled');
    });
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(useDesignerStore.getState().ui.splitPieceMeshes).toHaveLength(0);
  });
});
