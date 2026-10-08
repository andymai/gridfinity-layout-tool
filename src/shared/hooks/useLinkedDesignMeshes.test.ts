import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestBin, resetAllStores } from '@/test/testUtils';
import { binId, designId, gridUnits, mm } from '@/core/types';
import type { Bin } from '@/core/types';
import { createDefaultLayout } from '@/core/constants';
import { useLayoutStore } from '@/core/store/layout';
import { ok, err } from '@/core/result';
import type { StorageError } from '@/core/result';
import {
  useLinkedDesignMeshes,
  clearLinkedDesignMeshCache,
  MAX_CACHE_ENTRIES,
} from '@/shared/hooks/useLinkedDesignMeshes';
import {
  loadDesign,
  useCustomBins,
  type SavedDesign,
  type CustomBinRef,
  type BinParams,
} from '@/features/bin-designer';
import { decodeMeshData } from '@/shared/generation/meshAsset';
import { meshAssetFile, storeMeshAsset } from '@/shared/generation/meshRefs';
import { putMeshFile } from '@/shared/generation/meshStore';
import { loadPersistedBinMesh, savePersistedBinMesh } from '@/shared/generation/meshPersistence';
import { bridgeManager } from '@/shared/generation/bridge';
import type { KernelName } from '@/shared/generation/bridge';
import type { MeshData } from '@/shared/types/generation';

let mockActiveKernel: KernelName = 'occt-wasm';

const BODY_BASE_MM = 4.75;

vi.mock('@/features/bin-designer', () => ({
  loadDesign: vi.fn(),
  useCustomBins: vi.fn(() => []),
  binDimensions: vi.fn(() => ({ floorZ: BODY_BASE_MM })),
}));

vi.mock('@/shared/generation/meshAsset', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  decodeMeshData: vi.fn(),
}));

const OWN_OVERHANG_SUFFIX = '-own-overhang';

vi.mock('@/shared/generation/meshPersistence', () => ({
  // Kernel-sensitive so the per-kernel namespacing is observable, and
  // overhang-sensitive so a params variant without one is too.
  binMeshCacheKey: vi.fn(
    (p: BinParams, kernel: KernelName) =>
      `persist-key-${kernel}${p.overhang ? OWN_OVERHANG_SUFFIX : ''}`
  ),
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
const B1 = binId('bin-1');

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

function makeBinDesign(params: Partial<BinParams> = {}): SavedDesign {
  return {
    id: D1,
    name: 'Test Design',
    params: {
      width: 2,
      depth: 1,
      label: { enabled: false },
      base: {},
      ...params,
    } as unknown as BinParams,
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

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(B1)).toBeDefined();
    });
    const entry = result.current.get(B1);
    expect(entry?.mesh).toBe(mesh);
    expect(entry?.width).toBe(2);
    expect(entry?.depth).toBe(1);
    expect(entry?.bodyBaseMm).toBe(BODY_BASE_MM);
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

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      // No plates present, so the mesh passes through untouched rather than
      // being re-wrapped by the strip.
      expect(result.current.get(B1)?.mesh).toBe(mesh);
    });
    expect(result.current.get(B1)?.bodyBaseMm).toBe(BODY_BASE_MM);
    expect(mockSavePersistedBinMesh).toHaveBeenCalledWith('persist-key-occt-wasm', mesh);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('shows a mesh built while a mesh file was missing without persisting it', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));
    mockAcquire.mockResolvedValue({
      generateImmediate: vi.fn(async () => ({ mesh, meshesPending: true })),
    } as unknown as Awaited<ReturnType<typeof bridgeManager.acquire>>);

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(B1)?.mesh).toBe(mesh);
    });
    expect(mockSavePersistedBinMesh).not.toHaveBeenCalled();
  });

  it('rebuilds a mesh built without a file once that file arrives', async () => {
    const file = await meshAssetFile({
      name: 'wrench',
      data: 'AAAB',
      triangleCount: 1,
      sizeMm: { x: 20, y: 10, z: 5 },
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 0, y: 10 },
        ],
      ],
    });
    if (!file) throw new Error('fixture');
    const uncut = makeMesh();
    const cut = makeMesh();
    const generateImmediate = vi
      .fn()
      .mockResolvedValueOnce({ mesh: uncut, meshesPending: true })
      .mockResolvedValueOnce({ mesh: cut });
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign({ meshAssets: { m1: file.ref } })));
    mockAcquire.mockResolvedValue({ generateImmediate } as unknown as Awaited<
      ReturnType<typeof bridgeManager.acquire>
    >);

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));
    await waitFor(() => {
      expect(result.current.get(B1)?.mesh).toBe(uncut);
    });

    await putMeshFile(file.bytes);

    await waitFor(() => {
      expect(result.current.get(B1)?.mesh).toBe(cut);
    });
    expect(generateImmediate).toHaveBeenCalledTimes(2);
    expect(mockSavePersistedBinMesh).toHaveBeenCalledTimes(1);
    expect(mockSavePersistedBinMesh).toHaveBeenCalledWith('persist-key-occt-wasm', cut);
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

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(B1)?.mesh).toBe(mesh);
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

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(B1)).toBeDefined();
    });

    const persisted = mockSavePersistedBinMesh.mock.calls[0][1];
    expect(persisted).not.toHaveProperty('labelPlates');
    expect(result.current.get(B1)?.mesh).not.toHaveProperty('labelPlates');
  });

  it('generates an assembly through the item bridge and persists under the item key', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeAssemblyDesign()));
    const generateItemImmediate = vi.fn(async () => ({ mesh }));
    mockAcquire.mockResolvedValue({
      generateItemImmediate,
    } as unknown as Awaited<ReturnType<typeof bridgeManager.acquire>>);

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(B1)?.mesh).toBe(mesh);
    });
    expect(generateItemImmediate).toHaveBeenCalledWith(
      expect.objectContaining({ structure: expect.objectContaining({ kind: 'assembly' }) })
    );
    expect(mockLoadPersistedBinMesh).toHaveBeenCalledWith('item-key-occt-wasm');
    expect(mockSavePersistedBinMesh).toHaveBeenCalledWith('item-key-occt-wasm', mesh);
    expect(result.current.get(B1)).toMatchObject({ width: 2, depth: 1 });
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('serves a persisted assembly mesh without touching the bridge', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeAssemblyDesign()));
    mockLoadPersistedBinMesh.mockResolvedValue(mesh);

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(B1)?.mesh).toBe(mesh);
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

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(B1)).toBeDefined();
    });
    const entry = result.current.get(B1);
    // Stored frame has bbox min at origin; preview frame is XY-centered
    expect(Array.from(entry?.mesh.vertices ?? [])).toEqual([-20, -20, 0, 20, 20, 28]);
    expect(entry?.width).toBe(1);
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('decodes an imported STL design stored as a ref from its mesh file', async () => {
    const ref = await storeMeshAsset({
      name: 'holder',
      data: 'AAAA',
      triangleCount: 1,
      sizeMm: { x: 40, y: 40, z: 28 },
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 0, y: 40 },
        ],
      ],
    });
    const design = makeImportedDesign();
    const structure = design.structure;
    if (!ref || structure?.kind !== 'importedMesh') throw new Error('fixture');
    mockUseCustomBins.mockReturnValue([makeRegistryRef({ width: 1, depth: 1 })]);
    mockLoadDesign.mockResolvedValue(ok({ ...design, structure: { ...structure, asset: ref } }));
    mockDecodeMeshData.mockResolvedValue(
      ok({
        positions: new Float32Array([0, 0, 0, 40, 40, 28]),
        indices: new Uint32Array([0, 1, 0]),
      })
    );

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(result.current.get(B1)).toBeDefined();
    });
    expect(mockDecodeMeshData).toHaveBeenCalledWith('AAAA');
  });

  it('caches failures so a broken design does not retry every render', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      err({ type: 'not_found', message: 'gone' } as unknown as StorageError)
    );

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
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

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignMeshes(bins));

    await waitFor(() => {
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
    expect(result.current.size).toBe(0);
  });

  describe('a placement whose overhang replaces the design own', () => {
    const MARGIN_BIN = binId('bin-margin');
    const PLAIN_BIN = binId('bin-plain');
    const ownOverhangMesh = makeMesh();
    const bareMesh = makeMesh();

    function placeInPaddedDrawer(): Bin[] {
      const base = createDefaultLayout();
      useLayoutStore.setState({
        layout: {
          ...base,
          drawer: { ...base.drawer, width: gridUnits(5), depth: gridUnits(4) },
          baseplateParams: {
            magnetHoles: false,
            magnetDiameter: mm(6),
            magnetDepth: mm(2),
            paddingLeft: mm(4.5),
            paddingRight: mm(0),
            paddingFront: mm(0),
            paddingBack: mm(0),
          },
        },
      });
      return [
        createTestBin({ id: MARGIN_BIN, linkedDesignId: D1, extendToMargin: true }),
        createTestBin({ id: PLAIN_BIN, linkedDesignId: D1, x: gridUnits(2), y: gridUnits(1) }),
      ];
    }

    beforeEach(() => {
      mockLoadPersistedBinMesh.mockImplementation(async (key: string) =>
        key.endsWith(OWN_OVERHANG_SUFFIX) ? ownOverhangMesh : bareMesh
      );
    });

    afterEach(() => {
      resetAllStores();
    });

    it('draws the extended placement without the design own overhang, the rest with it', async () => {
      mockUseCustomBins.mockReturnValue([
        makeRegistryRef({ overhangMm: { left: 3, right: 0, front: 0, back: 0 } }),
      ]);
      mockLoadDesign.mockResolvedValue(
        ok(
          makeBinDesign({
            overhang: { left: 3, right: 0, front: 0, back: 0, enabled: true },
          })
        )
      );

      const bins = placeInPaddedDrawer();
      const { result } = renderHook(() => useLinkedDesignMeshes(bins));

      await waitFor(() => {
        expect(result.current.get(MARGIN_BIN)?.mesh).toBe(bareMesh);
        expect(result.current.get(PLAIN_BIN)?.mesh).toBe(ownOverhangMesh);
      });
      expect(result.current.get(MARGIN_BIN)?.sig).not.toBe(result.current.get(PLAIN_BIN)?.sig);
      expect(result.current.get(MARGIN_BIN)?.bodyBaseMm).toBe(BODY_BASE_MM);
    });

    it('keeps one shared mesh for an assembly, which never extends into the margin', async () => {
      mockUseCustomBins.mockReturnValue([
        makeRegistryRef({
          kind: 'assembly',
          overhangMm: { left: 3, right: 0, front: 0, back: 0 },
        }),
      ]);
      mockLoadDesign.mockResolvedValue(ok(makeAssemblyDesign()));
      mockAcquire.mockResolvedValue({
        generateItemImmediate: vi.fn(async () => ({ mesh: makeMesh() })),
      } as unknown as Awaited<ReturnType<typeof bridgeManager.acquire>>);

      const bins = placeInPaddedDrawer();
      const { result } = renderHook(() => useLinkedDesignMeshes(bins));

      await waitFor(() => {
        expect(result.current.get(MARGIN_BIN)).toBeDefined();
      });
      expect(result.current.get(MARGIN_BIN)).toBe(result.current.get(PLAIN_BIN));
      expect(mockLoadDesign).toHaveBeenCalledTimes(1);
    });

    it('keeps one shared mesh when the design has no overhang of its own', async () => {
      mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
      mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));

      const bins = placeInPaddedDrawer();
      const { result } = renderHook(() => useLinkedDesignMeshes(bins));

      await waitFor(() => {
        expect(result.current.get(MARGIN_BIN)).toBeDefined();
      });
      expect(result.current.get(MARGIN_BIN)).toBe(result.current.get(PLAIN_BIN));
      expect(mockLoadDesign).toHaveBeenCalledTimes(1);
    });
  });

  it('reuses cached meshes across mounts without reloading', async () => {
    const mesh = makeMesh();
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeBinDesign()));
    mockLoadPersistedBinMesh.mockResolvedValue(mesh);

    const bins = [createTestBin({ id: B1, linkedDesignId: D1 })];
    const first = renderHook(() => useLinkedDesignMeshes(bins));
    await waitFor(() => {
      expect(first.result.current.get(B1)).toBeDefined();
    });
    first.unmount();

    const second = renderHook(() => useLinkedDesignMeshes(bins));
    expect(second.result.current.get(B1)?.mesh).toBe(mesh);
    expect(mockLoadDesign).toHaveBeenCalledTimes(1);
  });

  describe('with more meshes in use than the cache bound', () => {
    function manyDesigns(from: number, count: number): { refs: CustomBinRef[]; bins: Bin[] } {
      const refs: CustomBinRef[] = [];
      const bins: Bin[] = [];
      for (let i = from; i < from + count; i++) {
        const id = designId(`design-${i}`);
        refs.push(makeRegistryRef({ id }));
        bins.push(createTestBin({ id: binId(`bin-${i}`), linkedDesignId: id }));
      }
      return { refs, bins };
    }

    beforeEach(() => {
      mockLoadDesign.mockImplementation(async (id) => ok({ ...makeBinDesign(), id }));
      mockLoadPersistedBinMesh.mockResolvedValue(makeMesh());
    });

    it('keeps every mesh a mounted preview is showing', async () => {
      const { refs, bins } = manyDesigns(0, MAX_CACHE_ENTRIES + 1);
      mockUseCustomBins.mockReturnValue(refs);

      const { result } = renderHook(() => useLinkedDesignMeshes(bins));

      await waitFor(() => {
        expect(mockLoadDesign).toHaveBeenCalledTimes(MAX_CACHE_ENTRIES + 1);
      });
      await waitFor(() => {
        expect(result.current.size).toBe(MAX_CACHE_ENTRIES + 1);
      });
    });

    const OVER = MAX_CACHE_ENTRIES + 8;
    const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    it('trims back to the bound once a preview stops showing its meshes', async () => {
      const { refs, bins } = manyDesigns(0, OVER);
      mockUseCustomBins.mockReturnValue(refs);

      const first = renderHook(() => useLinkedDesignMeshes(bins));
      await waitFor(() => {
        expect(first.result.current.size).toBe(OVER);
      });
      first.unmount();
      await flushMicrotasks();

      // Only the 8 least recently used were trimmed, so only they reload.
      const second = renderHook(() => useLinkedDesignMeshes(bins));
      await waitFor(() => {
        expect(second.result.current.size).toBe(OVER);
      });
      expect(mockLoadDesign).toHaveBeenCalledTimes(OVER + 8);
    });

    it('keeps the meshes a requests update still shows, without reloading them', async () => {
      const { refs, bins } = manyDesigns(0, OVER);
      mockUseCustomBins.mockReturnValue(refs);

      const { result, rerender } = renderHook(
        ({ bins }: { bins: Bin[] }) => useLinkedDesignMeshes(bins),
        { initialProps: { bins } }
      );
      await waitFor(() => {
        expect(result.current.size).toBe(OVER);
      });

      // A fresh array re-runs the loading effect: every key is unpinned and
      // pinned again in one commit.
      rerender({ bins: [...bins] });
      await flushMicrotasks();

      expect(result.current.size).toBe(OVER);
      expect(mockLoadDesign).toHaveBeenCalledTimes(OVER);
    });

    it('reloads a mesh evicted while nothing was showing it', async () => {
      const sets = [0, 1, 2].map((i) => manyDesigns(i * MAX_CACHE_ENTRIES, MAX_CACHE_ENTRIES));
      mockUseCustomBins.mockReturnValue(sets.flatMap((s) => s.refs));

      const { result, rerender } = renderHook(
        ({ bins }: { bins: Bin[] }) => useLinkedDesignMeshes(bins),
        { initialProps: { bins: sets[0].bins } }
      );
      // Two more full sets leave more unused entries than the bound holds, so
      // the oldest, the first set, is evicted.
      for (const set of [sets[1], sets[2], sets[0]]) {
        await waitFor(() => {
          expect(result.current.size).toBe(MAX_CACHE_ENTRIES);
        });
        rerender({ bins: set.bins });
      }
      await waitFor(() => {
        expect(result.current.size).toBe(MAX_CACHE_ENTRIES);
      });
      expect(mockLoadDesign).toHaveBeenCalledTimes(MAX_CACHE_ENTRIES * 4);
    });
  });
});
