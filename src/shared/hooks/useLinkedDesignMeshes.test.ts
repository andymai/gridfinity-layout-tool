import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestBin } from '@/test/testUtils';
import { designId } from '@/core/types';
import { ok, err } from '@/core/result';
import type { StorageError } from '@/core/result';
import {
  useLinkedDesignMeshes,
  clearLinkedDesignMeshCache,
} from '@/shared/hooks/useLinkedDesignMeshes';
import {
  loadDesign,
  useCustomBins,
  type SavedDesign,
  type CustomBinRef,
  type BinParams,
} from '@/features/bin-designer';
import { decodeMeshData } from '@/shared/generation/meshAsset';
import { loadPersistedBinMesh, savePersistedBinMesh } from '@/shared/generation/meshPersistence';
import { bridgeManager } from '@/shared/generation/bridge';
import type { KernelName } from '@/shared/generation/bridge';
import type { MeshData } from '@/shared/types/generation';

let mockActiveKernel: KernelName = 'occt-wasm';

vi.mock('@/features/bin-designer', () => ({
  loadDesign: vi.fn(),
  useCustomBins: vi.fn(() => []),
}));

vi.mock('@/shared/generation/meshAsset', () => ({
  decodeMeshData: vi.fn(),
}));

vi.mock('@/shared/generation/meshPersistence', () => ({
  // Kernel-sensitive so the per-kernel namespacing is observable.
  binMeshCacheKey: vi.fn((_p: unknown, kernel: KernelName) => `persist-key-${kernel}`),
  itemMeshCacheKey: vi.fn((_i: unknown, kernel: KernelName) => `item-key-${kernel}`),
  loadPersistedBinMesh: vi.fn(async () => null),
  savePersistedBinMesh: vi.fn(),
}));

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: { acquire: vi.fn(), release: vi.fn() },
  getActiveKernel: () => mockActiveKernel,
}));

const mockLoadDesign = vi.mocked(loadDesign);
const mockUseCustomBins = vi.mocked(useCustomBins);
const mockDecodeMeshData = vi.mocked(decodeMeshData);
const mockLoadPersistedBinMesh = vi.mocked(loadPersistedBinMesh);
const mockSavePersistedBinMesh = vi.mocked(savePersistedBinMesh);
const mockAcquire = vi.mocked(bridgeManager.acquire);
const mockRelease = vi.mocked(bridgeManager.release);

const D1 = designId('design-1');

function makeMesh(): MeshData {
  return {
    vertices: new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    edgeVertices: new Float32Array(0),
    triangleCount: 1,
  };
}

function makeRegistryRef(overrides: Partial<CustomBinRef> = {}): CustomBinRef {
  return {
    id: D1,
    name: 'Test Design',
    width: 2,
    depth: 1,
    height: 6,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBinDesign(): SavedDesign {
  return {
    id: D1,
    name: 'Test Design',
    params: { width: 2, depth: 1, label: { enabled: false } } as unknown as BinParams,
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
  };
}

function makeImportedDesign(): SavedDesign {
  return {
    id: D1,
    name: 'Imported STL',
    kind: 'importedMesh',
    envelope: {
      width: 1,
      depth: 1,
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
    } as unknown as SavedDesign['envelope'],
    structure: {
      kind: 'importedMesh',
      heightUnits: 4,
      asset: {
        name: 'holder',
        data: 'base64-gma1',
        triangleCount: 1,
        sizeMm: { x: 40, y: 40, z: 28 },
        outlines: [],
      },
    },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
  };
}

function makeAssemblyDesign(): SavedDesign {
  return {
    id: D1,
    name: 'Workshop Holder',
    kind: 'assembly',
    envelope: {
      width: 2,
      depth: 1,
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
    } as unknown as SavedDesign['envelope'],
    structure: {
      kind: 'assembly',
      schemaVersion: 1,
      base: { floorThickness: 2 },
      mirrorAxis: 'x',
      parts: [],
    } as unknown as SavedDesign['structure'],
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
  };
}

describe('useLinkedDesignMeshes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLinkedDesignMeshCache();
    mockActiveKernel = 'occt-wasm';
    mockUseCustomBins.mockReturnValue([]);
    mockLoadPersistedBinMesh.mockResolvedValue(null);
  });

  it('returns an empty map when no bins are linked', () => {
    const bins = [createTestBin()];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    expect(result.current.size).toBe(0);
    expect(mockLoadDesign).not.toHaveBeenCalled();
  });

  it('uses the persisted mesh cache without touching the worker bridge', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));
    mockLoadPersistedBinMesh.mockResolvedValue(mesh);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(D1)).toBeDefined();
    });
    const entry = result.current.get(D1);
    expect(entry?.mesh).toBe(mesh);
    expect(entry?.width).toBe(2);
    expect(entry?.depth).toBe(1);
    expect(entry?.sig).toContain('2026-01-01T00:00:00.000Z');
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('generates via the bridge on a persisted-cache miss and persists the result', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));
    mockAcquire.mockResolvedValue({
      generateImmediate: vi.fn(async () => ({ mesh })),
    } as unknown as Awaited<ReturnType<typeof bridgeManager.acquire>>);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      // No plates present, so the mesh passes through untouched rather than
      // being re-wrapped by the strip.
      expect(result.current.get(D1)?.mesh).toBe(mesh);
    });
    expect(mockSavePersistedBinMesh).toHaveBeenCalledWith('persist-key-occt-wasm', mesh);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  // This reader returns a persisted hit and stops, with no regeneration
  // behind it, so a key shared across engines would strand the other engine's
  // mesh in the layout preview until LRU eviction.
  it('reads and writes under a key namespaced by the active kernel', async () => {
    const mesh = makeMesh();
    mockActiveKernel = 'brepkit';
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));
    mockAcquire.mockResolvedValue({
      generateImmediate: vi.fn(async () => ({ mesh })),
    } as unknown as Awaited<ReturnType<typeof bridgeManager.acquire>>);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(D1)?.mesh).toBe(mesh);
    });
    expect(mockLoadPersistedBinMesh).toHaveBeenCalledWith('persist-key-brepkit');
    expect(mockSavePersistedBinMesh).toHaveBeenCalledWith('persist-key-brepkit', mesh);
  });

  // Label plates are a bin-designer affordance and aren't requested here, but
  // the bridge's params cache is shared across callers, so one can alias in.
  // Baking plate buffers into every cross-session cache entry would inflate it
  // for geometry the layout never renders.
  it('strips label plates before persisting a generated mesh', async () => {
    const mesh = { ...makeMesh(), labelPlates: { plates: [], omittedCount: 0 } };
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));
    mockAcquire.mockResolvedValue({
      generateImmediate: vi.fn(async () => ({ mesh })),
    } as unknown as Awaited<ReturnType<typeof bridgeManager.acquire>>);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(D1)).toBeDefined();
    });

    const persisted = mockSavePersistedBinMesh.mock.calls[0][1];
    expect(persisted).not.toHaveProperty('labelPlates');
    expect(result.current.get(D1)?.mesh).not.toHaveProperty('labelPlates');
  });

  it('generates an assembly through the item bridge and persists under the item key', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeAssemblyDesign()));
    const generateItemImmediate = vi.fn(async () => ({ mesh }));
    mockAcquire.mockResolvedValue({
      generateItemImmediate,
    } as unknown as Awaited<ReturnType<typeof bridgeManager.acquire>>);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(D1)?.mesh).toBe(mesh);
    });
    expect(generateItemImmediate).toHaveBeenCalledWith(
      expect.objectContaining({ structure: expect.objectContaining({ kind: 'assembly' }) })
    );
    expect(mockLoadPersistedBinMesh).toHaveBeenCalledWith('item-key-occt-wasm');
    expect(mockSavePersistedBinMesh).toHaveBeenCalledWith('item-key-occt-wasm', mesh);
    expect(result.current.get(D1)).toMatchObject({ width: 2, depth: 1 });
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('serves a persisted assembly mesh without touching the bridge', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeAssemblyDesign()));
    mockLoadPersistedBinMesh.mockResolvedValue(mesh);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(D1)?.mesh).toBe(mesh);
    });
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('decodes imported STL designs on the main thread, centered on XY', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef({ width: 1, depth: 1 })]);
    mockLoadDesign.mockResolvedValue(ok(makeImportedDesign()));
    mockDecodeMeshData.mockResolvedValue(
      ok({
        positions: new Float32Array([0, 0, 0, 40, 40, 28]),
        indices: new Uint32Array([0, 1, 0]),
      })
    );

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(D1)).toBeDefined();
    });
    const entry = result.current.get(D1);
    // Stored frame has bbox min at origin; preview frame is XY-centered
    expect(Array.from(entry?.mesh.vertices ?? [])).toEqual([-20, -20, 0, 20, 20, 28]);
    expect(entry?.width).toBe(1);
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('caches failures so a broken design does not retry every render', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      err({ type: 'not_found', message: 'gone' } as unknown as StorageError)
    );

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result, rerender } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(mockLoadDesign).toHaveBeenCalledTimes(1);
    });
    expect(result.current.size).toBe(0);

    rerender();
    expect(mockLoadDesign).toHaveBeenCalledTimes(1);
  });

  it('releases the bridge when generation throws and caches the miss', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));
    mockAcquire.mockResolvedValue({
      generateImmediate: vi.fn(async () => {
        throw new Error('worker died');
      }),
    } as unknown as Awaited<ReturnType<typeof bridgeManager.acquire>>);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
    expect(result.current.size).toBe(0);
  });

  it('reuses cached meshes across mounts without reloading', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));
    mockLoadPersistedBinMesh.mockResolvedValue(mesh);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const first = renderHook(() => useLinkedDesignMeshes(bins));
    await waitFor(() => {
      expect(first.result.current.get(D1)).toBeDefined();
    });
    first.unmount();

    const second = renderHook(() => useLinkedDesignMeshes(bins));
    expect(second.result.current.get(D1)?.mesh).toBe(mesh);
    expect(mockLoadDesign).toHaveBeenCalledTimes(1);
  });
});
