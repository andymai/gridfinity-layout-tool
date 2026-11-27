import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { MeshData } from '@/shared/types/generation';
import type { YearBinRef } from '../types';
import { __resetYearMeshesForTests, useYearMeshes } from './useYearMeshes';

const bridge = { generateImmediate: vi.fn(), hardResetWorker: vi.fn(), cancel: vi.fn() };
vi.mock('@/shared/generation/bridge', () => ({
  getActiveKernel: () => 'occt-wasm',
  bridgeManager: { acquire: vi.fn(async () => bridge), release: vi.fn() },
}));

const stored = new Map<string, MeshData>();
vi.mock('@/shared/generation/meshPersistence', () => ({
  binMeshCacheKey: (params: { height: number }) => `key-${params.height}`,
  loadPersistedBinMesh: async (key: string) => stored.get(key) ?? null,
  savePersistedBinMesh: vi.fn((key: string, mesh: MeshData) => stored.set(key, mesh)),
}));

vi.mock('@/shared/utils/knifeRestPlan', () => ({
  planKnifeRest: () => ({ side: 'right' }),
  knifeRestMatedOffset: () => ({ x: 120, y: 0 }),
}));

const kernel = { cached: true };
vi.mock('../utils/kernelCache', () => ({ isKernelCached: async () => kernel.cached }));

const { bridgeManager } = await import('@/shared/generation/bridge');
const { savePersistedBinMesh } = await import('@/shared/generation/meshPersistence');

function mesh(triangleCount: number): MeshData {
  return {
    vertices: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    edgeVertices: new Float32Array(0),
    triangleCount,
  };
}

function design(id: string, height: number): YearBinRef {
  return { id, name: id, thumbnail: null, params: { ...DEFAULT_BIN_PARAMS, height } };
}

beforeEach(() => {
  __resetYearMeshesForTests();
  stored.clear();
  kernel.cached = true;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useYearMeshes', () => {
  it('reads a cached mesh without touching the worker', async () => {
    stored.set('key-6', mesh(900));
    const designs = [design('a', 6)];
    const { result } = renderHook(() => useYearMeshes(designs, 0.4, true));
    await waitFor(() => expect(result.current.get('a')?.triangles).toBe(900));
    expect(bridgeManager.acquire).not.toHaveBeenCalled();
  });

  it('generates a missing mesh, saves it back, and lets the worker go on unmount', async () => {
    bridge.generateImmediate.mockResolvedValue({ mesh: mesh(1500), timingMs: 10 });
    const designs = [design('a', 9)];
    const { result, unmount } = renderHook(() => useYearMeshes(designs, 0.4, true));
    await waitFor(() => expect(result.current.get('a')?.triangles).toBe(1500));
    expect(savePersistedBinMesh).toHaveBeenCalledWith('key-9', expect.anything());
    unmount();
    await waitFor(() => expect(bridgeManager.release).toHaveBeenCalledTimes(1));
  });

  it('leaves a missing mesh to the thumbnail when the kernel is not on the device', async () => {
    kernel.cached = false;
    const designs = [design('a', 9)];
    const { result } = renderHook(() => useYearMeshes(designs, 0.4, true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(result.current.size).toBe(0);
    expect(bridgeManager.acquire).not.toHaveBeenCalled();
  });

  it('cuts off a design that takes too long and resets the worker', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    bridge.generateImmediate.mockReturnValue(new Promise(() => {}));
    const designs = [design('a', 12)];
    renderHook(() => useYearMeshes(designs, 0.4, true));
    await vi.waitFor(() => expect(bridge.generateImmediate).toHaveBeenCalled());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(bridge.hardResetWorker).toHaveBeenCalledTimes(1);
  });

  it('cancels the slow request before the reset, so its watchdog cannot reset the new worker', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    bridge.generateImmediate.mockReturnValue(new Promise(() => {}));
    renderHook(() => useYearMeshes([design('a', 12)], 0.4, true));
    await vi.waitFor(() => expect(bridge.generateImmediate).toHaveBeenCalled());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
    const [cancelled] = bridge.cancel.mock.invocationCallOrder;
    const [reset] = bridge.hardResetWorker.mock.invocationCallOrder;
    expect(cancelled).toBeLessThan(reset ?? 0);
  });

  it('leaves no deadline armed on the shared worker when the page leaves mid-generation', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    bridge.generateImmediate.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderHook(() => useYearMeshes([design('a', 12)], 0.4, true));
    await vi.waitFor(() => expect(bridge.generateImmediate).toHaveBeenCalled());
    unmount();
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(bridge.hardResetWorker).not.toHaveBeenCalled();
  });

  it('generates once for saved copies that share their params', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    bridge.generateImmediate.mockReturnValue(new Promise(() => {}));
    renderHook(() => useYearMeshes([design('a', 12), design('copy', 12)], 0.4, true));
    await vi.waitFor(() => expect(bridge.generateImmediate).toHaveBeenCalled());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });
    expect(bridge.generateImmediate).toHaveBeenCalledTimes(1);
    expect(bridge.hardResetWorker).toHaveBeenCalledTimes(1);
  });

  it('keeps the thumbnail for a mesh whose pocket files have not arrived, and tries again later', async () => {
    bridge.generateImmediate.mockResolvedValue({ mesh: mesh(700), meshesPending: true });
    const designs = [design('a', 9)];
    const first = renderHook(() => useYearMeshes(designs, 0.4, true));
    await vi.waitFor(() => expect(bridge.generateImmediate).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(first.result.current.size).toBe(0);
    expect(savePersistedBinMesh).not.toHaveBeenCalled();
    first.unmount();

    renderHook(() => useYearMeshes(designs, 0.4, true));
    await vi.waitFor(() => expect(bridge.generateImmediate).toHaveBeenCalledTimes(2));
  });

  it('shows every cached mesh before it generates the missing ones', async () => {
    bridge.generateImmediate.mockReturnValue(new Promise(() => {}));
    stored.set('key-6', mesh(900));
    const designs = [design('slow', 9), design('cached', 6)];
    const { result } = renderHook(() => useYearMeshes(designs, 0.4, true));
    await waitFor(() => expect(result.current.get('cached')?.triangles).toBe(900));
  });

  it('keeps the cached meshes when the engine fails to start', async () => {
    vi.mocked(bridgeManager.acquire).mockRejectedValueOnce(new Error('init failed'));
    stored.set('key-6', mesh(900));
    const designs = [design('missing', 9), design('cached', 6)];
    const { result } = renderHook(() => useYearMeshes(designs, 0.4, true));
    await waitFor(() => expect(result.current.get('cached')?.triangles).toBe(900));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(result.current.has('missing')).toBe(false);
    expect(bridge.generateImmediate).not.toHaveBeenCalled();
  });

  it('starts no generation when the page leaves while the engine starts', async () => {
    let started: (value: typeof bridge) => void = () => undefined;
    vi.mocked(bridgeManager.acquire).mockReturnValueOnce(
      new Promise((resolve) => {
        started = resolve;
      }) as never
    );
    const { unmount } = renderHook(() => useYearMeshes([design('a', 9)], 0.4, true));
    await vi.waitFor(() => expect(bridgeManager.acquire).toHaveBeenCalled());
    unmount();
    await act(async () => {
      started(bridge);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(bridge.generateImmediate).not.toHaveBeenCalled();
    expect(bridgeManager.release).toHaveBeenCalledTimes(1);
  });

  it('places a companion knife rest beside the block', async () => {
    const rested = {
      ...mesh(400),
      knifeRestMesh: { ...mesh(100), vertices: new Float32Array([0, 0, 0]) },
    };
    stored.set('key-6', rested);
    const { result } = renderHook(() => useYearMeshes([design('a', 6)], 0.4, true));
    await waitFor(() => expect(result.current.get('a')?.restOffset).toEqual({ x: 120, y: 0 }));
  });

  it('does nothing until enabled', () => {
    const designs = [design('a', 6)];
    const { result } = renderHook(() => useYearMeshes(designs, 0.4, false));
    expect(result.current.size).toBe(0);
  });
});
