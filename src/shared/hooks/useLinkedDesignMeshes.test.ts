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
import type { MeshData } from '@/shared/types/generation';

vi.mock('@/features/bin-designer', () => ({
  loadDesign: vi.fn(),
  useCustomBins: vi.fn(() => []),
}));

vi.mock('@/shared/generation/meshAsset', () => ({
  decodeMeshData: vi.fn(),
}));

vi.mock('@/shared/generation/meshPersistence', () => ({
  binMeshCacheKey: vi.fn(() => 'persist-key'),
  loadPersistedBinMesh: vi.fn(async () => null),
  savePersistedBinMesh: vi.fn(),
}));

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: { acquire: vi.fn(), release: vi.fn() },
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
    params: { width: 2, depth: 1 } as unknown as BinParams,
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

describe('useLinkedDesignMeshes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLinkedDesignMeshCache();
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
      expect(result.current.get(D1)?.mesh).toBe(mesh);
    });
    expect(mockSavePersistedBinMesh).toHaveBeenCalledWith('persist-key', mesh);
    expect(mockRelease).toHaveBeenCalledTimes(1);
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
