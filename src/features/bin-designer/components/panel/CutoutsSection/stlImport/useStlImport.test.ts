import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { MAX_MESH_FILE_BYTES, isMeshAssetRef } from '@/shared/generation/meshAsset';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { resolveMeshAsset, storeMeshAsset } from '@/shared/generation/meshRefs';
import type * as MeshRefs from '@/shared/generation/meshRefs';

const importMesh = vi.fn();
vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: {
    acquire: vi.fn(async () => ({ importMesh })),
    release: vi.fn(),
  },
}));

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

vi.mock('@/shared/generation/meshRefs', async (importOriginal) => {
  const actual = await importOriginal<typeof MeshRefs>();
  return { ...actual, storeMeshAsset: vi.fn(actual.storeMeshAsset) };
});

import { useStlImport } from './useStlImport';

const asset: MeshAsset = {
  name: 'wrench',
  data: 'AAAA',
  triangleCount: 12,
  sizeMm: { x: 20, y: 10, z: 5 },
  outlines: [
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ],
  ],
};

function makeFile(size = 100, name = 'tool.stl'): File {
  const file = new File([new Uint8Array(size)], name, { type: 'model/stl' });
  return file;
}

/** The hook creates a hidden input; feed a file through it. */
function feedFile(file: File): void {
  const input = document.querySelector<HTMLInputElement>('input[type="file"][accept=".stl"]');
  if (!input) throw new Error('hidden stl input not mounted');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('useStlImport', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useToastStore.setState(useToastStore.getInitialState());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects oversized files before touching the worker', async () => {
    const { result } = renderHook(() => useStlImport());
    const big = makeFile(10);
    Object.defineProperty(big, 'size', { value: MAX_MESH_FILE_BYTES + 1 });

    act(() => {
      feedFile(big);
    });

    await waitFor(() => {
      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
    });
    expect(importMesh).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });

  it('imports a file into a pending orientation state', async () => {
    importMesh.mockResolvedValue({
      ok: true,
      asset,
      positions: new Float32Array(9),
      indices: new Uint32Array(3),
      suggestedCutDepth: 5,
    });
    const { result } = renderHook(() => useStlImport());

    act(() => {
      feedFile(makeFile());
    });

    await waitFor(() => {
      expect(result.current.pending).not.toBeNull();
    });
    expect(result.current.pending?.asset.name).toBe('wrench');
    expect(result.current.pending?.suggestedCutDepth).toBe(5);
  });

  it('surfaces worker import errors as toasts', async () => {
    importMesh.mockResolvedValue({ ok: false, reason: 'not_manifold', message: 'holes' });
    const { result } = renderHook(() => useStlImport());

    act(() => {
      feedFile(makeFile());
    });

    await waitFor(() => {
      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
    });
    expect(result.current.pending).toBeNull();
  });

  it('discards an in-flight import resolved after cancel (no dialog re-open)', async () => {
    let resolveImport: (value: unknown) => void = () => undefined;
    importMesh.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        })
    );
    const { result } = renderHook(() => useStlImport());

    act(() => {
      feedFile(makeFile());
    });
    // Let the file read + acquire settle so importMesh is actually in flight
    await waitFor(() => {
      expect(importMesh).toHaveBeenCalled();
    });

    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      resolveImport({
        ok: true,
        asset,
        positions: new Float32Array(9),
        indices: new Uint32Array(3),
        suggestedCutDepth: 5,
      });
      await Promise.resolve();
    });

    expect(result.current.pending).toBeNull();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('re-runs the import with a normalized axis rotation', async () => {
    importMesh.mockResolvedValue({
      ok: true,
      asset,
      positions: new Float32Array(9),
      indices: new Uint32Array(3),
      suggestedCutDepth: 5,
    });
    const { result } = renderHook(() => useStlImport());

    act(() => {
      feedFile(makeFile());
    });
    await waitFor(() => {
      expect(result.current.pending).not.toBeNull();
    });
    expect(importMesh).toHaveBeenLastCalledWith(expect.anything(), 'tool.stl', {
      x: 0,
      y: 0,
      z: 0,
    });

    act(() => {
      result.current.setAxisRotation('z', -15);
    });
    await waitFor(() => {
      expect(result.current.pending?.rotation).toEqual({ x: 0, y: 0, z: 345 });
    });
    expect(importMesh).toHaveBeenLastCalledWith(expect.anything(), 'tool.stl', {
      x: 0,
      y: 0,
      z: 345,
    });
  });

  it('places the pending mesh as a centered cutout, its asset stored as a mesh file', async () => {
    importMesh.mockResolvedValue({
      ok: true,
      asset,
      positions: new Float32Array(9),
      indices: new Uint32Array(3),
      suggestedCutDepth: 5,
    });
    const { result } = renderHook(() => useStlImport());

    act(() => {
      feedFile(makeFile());
    });
    await waitFor(() => {
      expect(result.current.pending).not.toBeNull();
    });

    await act(async () => {
      await result.current.place();
    });

    const { params } = useDesignerStore.getState();
    expect(params.cutouts).toHaveLength(1);
    const placed = params.cutouts[0];
    expect(placed.shape).toBe('mesh');
    expect(placed.width).toBe(20);
    expect(placed.cutDepth).toBe(5);
    expect(placed.meshId).toBeDefined();
    const entry = params.meshAssets?.[placed.meshId ?? ''];
    expect(entry && isMeshAssetRef(entry)).toBe(true);
    expect(entry && (await resolveMeshAsset(entry))).toEqual(asset);
    expect(result.current.pending).toBeNull();
  });
});

describe('useStlImport placement while the mesh is being stored', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useToastStore.setState(useToastStore.getInitialState());
    importMesh.mockResolvedValue({
      ok: true,
      asset,
      positions: new Float32Array(9),
      indices: new Uint32Array(3),
      suggestedCutDepth: 5,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function holdNextStore(): () => void {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const real = vi.mocked(storeMeshAsset).getMockImplementation();
    vi.mocked(storeMeshAsset).mockImplementationOnce(async (stored) => {
      await held;
      return real ? real(stored) : null;
    });
    return release;
  }

  async function openPending() {
    const hook = renderHook(() => useStlImport());
    act(() => {
      feedFile(makeFile());
    });
    await waitFor(() => {
      expect(hook.result.current.pending).not.toBeNull();
    });
    return hook;
  }

  it('places once when Place is pressed twice before the mesh is stored', async () => {
    const release = holdNextStore();
    const { result } = await openPending();

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.place();
    });
    expect(result.current.placing).toBe(true);
    act(() => {
      second = result.current.place();
    });
    release();
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(useDesignerStore.getState().params.cutouts).toHaveLength(1);
    expect(result.current.placing).toBe(false);
    expect(result.current.pending).toBeNull();
  });

  it('places nothing when cancelled while the mesh is being stored', async () => {
    const release = holdNextStore();
    const { result } = await openPending();

    let placed: Promise<void> = Promise.resolve();
    act(() => {
      placed = result.current.place();
    });
    act(() => {
      result.current.cancel();
    });
    release();
    await act(async () => {
      await placed;
    });

    expect(useDesignerStore.getState().params.cutouts).toHaveLength(0);
    expect(result.current.pending).toBeNull();
    expect(result.current.placing).toBe(false);
  });

  async function placeWhileIdChanges(from: string | null, to: string) {
    useDesignerStore.getState().setCurrentDesignId(from);
    const release = holdNextStore();
    const hook = await openPending();
    let placed: Promise<void> = Promise.resolve();
    act(() => {
      placed = hook.result.current.place();
    });
    useDesignerStore.getState().setCurrentDesignId(to);
    release();
    await act(async () => {
      await placed;
    });
    return hook;
  }

  it('places nothing when another design is loaded while the mesh is being stored', async () => {
    const { result } = await placeWhileIdChanges('design-a', 'design-b');

    expect(useDesignerStore.getState().params.cutouts).toHaveLength(0);
    expect(result.current.pending).toBeNull();
    expect(result.current.placing).toBe(false);
  });

  it('still places when a new design is first saved while the mesh is being stored', async () => {
    await placeWhileIdChanges(null, 'design-a');

    expect(useDesignerStore.getState().params.cutouts).toHaveLength(1);
  });
});
