// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { MeshData } from '@/shared/types/generation';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import {
  binMeshCacheKey,
  loadPersistedBinMesh,
  savePersistedBinMesh,
  __savePersistedBinMeshForTests as saveMesh,
  __setMaxCacheBytesForTests,
  __resetMeshDbForTests,
} from './meshPersistence';

const DB_NAME = 'gridfinity-mesh-cache';

function deleteDb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/** Minimal deterministic mesh; `fill` makes byte content assertable. */
function makeMesh(overrides: Partial<MeshData> = {}): MeshData {
  return {
    vertices: new Float32Array([0, 0, 0, 1, 1, 1]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    edgeVertices: new Float32Array([0, 0, 0, 1, 0, 0]),
    triangleCount: 1,
    ...overrides,
  };
}

beforeEach(async () => {
  __resetMeshDbForTests();
  await deleteDb();
});

afterEach(() => {
  __resetMeshDbForTests();
  __setMaxCacheBytesForTests(); // restore the 64MB default
});

describe('binMeshCacheKey', () => {
  it('is stable regardless of param key order', () => {
    const a = binMeshCacheKey({ ...DEFAULT_BIN_PARAMS });
    const reordered = Object.fromEntries(
      Object.entries(DEFAULT_BIN_PARAMS).reverse()
    ) as typeof DEFAULT_BIN_PARAMS;
    const b = binMeshCacheKey(reordered);
    expect(a).toBe(b);
  });

  it('changes when any param changes', () => {
    const base = binMeshCacheKey(DEFAULT_BIN_PARAMS);
    const wider = binMeshCacheKey({ ...DEFAULT_BIN_PARAMS, width: DEFAULT_BIN_PARAMS.width + 1 });
    expect(wider).not.toBe(base);
  });

  it('is prefixed with the cache version so a bump orphans old keys', () => {
    expect(binMeshCacheKey(DEFAULT_BIN_PARAMS)).toMatch(/^v\d/);
  });
});

describe('persistence round-trip', () => {
  it('returns null on a miss', async () => {
    expect(await loadPersistedBinMesh('nope')).toBeNull();
  });

  it('round-trips a mesh including face groups, coarse LOD, and lid', async () => {
    const mesh = makeMesh({
      faceGroups: [{ start: 0, count: 3, tag: 1 }],
      coarseLOD: {
        vertices: new Float32Array([2, 2, 2]),
        indices: new Uint32Array([0]),
        triangleCount: 1,
      },
      lidMesh: {
        vertices: new Float32Array([9, 9, 9]),
        normals: new Float32Array([1, 0, 0]),
        indices: new Uint32Array([0]),
        edgeVertices: new Float32Array([9, 9, 9]),
        triangleCount: 1,
      },
    });

    await saveMesh('k1', mesh);

    const loaded = await loadPersistedBinMesh('k1');
    expect(loaded).not.toBeNull();
    expect(Array.from(loaded!.vertices)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(loaded!.faceGroups?.[0]).toMatchObject({ start: 0, count: 3, tag: 1 });
    expect(Array.from(loaded!.coarseLOD!.vertices)).toEqual([2, 2, 2]);
    expect(Array.from(loaded!.lidMesh!.vertices)).toEqual([9, 9, 9]);
  });

  it('overwrites an existing entry under the same key', async () => {
    await saveMesh('k1', makeMesh({ triangleCount: 1 }));
    await saveMesh('k1', makeMesh({ triangleCount: 42 }));

    const loaded = await loadPersistedBinMesh('k1');
    expect(loaded!.triangleCount).toBe(42);
  });

  it('savePersistedBinMesh (fire-and-forget) also persists', async () => {
    savePersistedBinMesh('k-ff', makeMesh({ triangleCount: 7 }));
    // Poll for the detached write to land — generous budget so a slow-CI
    // IndexedDB tick doesn't flake the test (still returns as soon as it's set).
    let loaded = await loadPersistedBinMesh('k-ff');
    for (let i = 0; i < 200 && !loaded; i++) {
      await new Promise((r) => setTimeout(r, 10));
      loaded = await loadPersistedBinMesh('k-ff');
    }
    expect(loaded).not.toBeNull();
    expect(loaded?.triangleCount).toBe(7);
  });
});

describe('eviction', () => {
  it('drops the oldest entries once the byte budget is exceeded', async () => {
    // Tiny budget so the eviction path is exercised without writing ~70MB.
    // Each mesh is ~64 bytes of vertices; a 400-byte budget holds only a few.
    __setMaxCacheBytesForTests(400);
    const small = () => makeMesh({ vertices: new Float32Array(16) }); // 64 bytes
    for (let i = 0; i < 20; i++) {
      await saveMesh(`k${i}`, small());
    }

    // The very first entries should have been evicted; recent ones survive.
    expect(await loadPersistedBinMesh('k0')).toBeNull();
    expect(await loadPersistedBinMesh('k19')).not.toBeNull();
  });
});
