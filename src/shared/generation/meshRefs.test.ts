import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isErr, isOk, unwrap } from '@/core/result';
import { encodeMeshData, isMeshAssetRef } from './meshAsset';
import type { MeshAsset, MeshAssetRef } from './meshAsset';
import { encodeMeshFile } from './meshFile';
import { __clearMeshOutlinesForTests, meshAssetOutlines } from './meshOutlines';
import {
  holderMeshHashes,
  inlineHolderMeshes,
  loadMeshOutlines,
  meshAssetFile,
  resolveMeshAsset,
  storeHolderMeshes,
  storeMeshAsset,
} from './meshRefs';
import {
  MESH_SWEEP_GRACE_MS,
  __resetMeshStoreForTests,
  getMeshFile,
  putMeshFile,
  sweepMeshFiles,
} from './meshStore';
import type * as MeshStore from './meshStore';

vi.mock('./meshStore', async (importOriginal) => {
  const actual = await importOriginal<typeof MeshStore>();
  return { ...actual, getMeshFile: vi.fn(actual.getMeshFile) };
});

function deleteDb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('gridfinity-mesh-files');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

async function makeAsset(name = 'wrench', scale = 40): Promise<MeshAsset> {
  const positions = new Float32Array([0, 0, 0, scale, 0, 0, 0, scale, 0, 0, 0, scale]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return {
    name,
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 4,
    sizeMm: { x: scale, y: scale, z: scale },
    outlines: [
      [
        { x: 0, y: 0 },
        { x: scale, y: 0.125 },
        { x: 0.5, y: scale },
      ],
    ],
  };
}

const MISSING_HASH = 'f'.repeat(64);

function missingRef(): MeshAssetRef {
  return {
    name: 'gone',
    hash: MISSING_HASH,
    triangleCount: 4,
    sizeMm: { x: 1, y: 1, z: 1 },
    bytes: 99,
  };
}

beforeEach(async () => {
  __resetMeshStoreForTests();
  __clearMeshOutlinesForTests();
  await deleteDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetMeshStoreForTests();
});

describe('storeMeshAsset', () => {
  it('stores the asset as one mesh file and answers a ref named by its SHA-256', async () => {
    const asset = await makeAsset();
    const file = unwrap(encodeMeshFile(asset));

    const ref = await storeMeshAsset(asset);

    expect(ref).toEqual({
      name: asset.name,
      hash: createHash('sha256').update(file).digest('hex'),
      triangleCount: asset.triangleCount,
      sizeMm: asset.sizeMm,
      bytes: file.byteLength,
    });
    expect(meshAssetOutlines(ref ?? undefined)).toEqual(asset.outlines);
  });

  it('answers null when the file cannot be written', async () => {
    const asset = await makeAsset();
    vi.stubGlobal('indexedDB', undefined);
    expect(await storeMeshAsset(asset)).toBeNull();
  });
});

describe('resolveMeshAsset', () => {
  it('round-trips a ref to the exact inline asset, key order included', async () => {
    const asset = await makeAsset();
    const ref = await storeMeshAsset(asset);
    __resetMeshStoreForTests();

    const resolved = await resolveMeshAsset(ref ?? missingRef());

    expect(JSON.stringify(resolved)).toBe(JSON.stringify(asset));
  });

  it('answers null for a ref whose file is not on this device', async () => {
    expect(await resolveMeshAsset(missingRef())).toBeNull();
  });
});

describe('storeHolderMeshes', () => {
  it('swaps every inline asset for a ref, in params and in an imported-mesh structure', async () => {
    const cutoutAsset = await makeAsset('wrench');
    const binAsset = await makeAsset('bin', 50);
    const design = {
      name: 'd',
      params: { width: 2, meshAssets: { a: cutoutAsset } },
      structure: { kind: 'importedMesh', heightUnits: 3, asset: binAsset },
    };

    const stored = await storeHolderMeshes(design);

    expect(isMeshAssetRef(stored.params.meshAssets.a)).toBe(true);
    expect(isMeshAssetRef(stored.structure.asset)).toBe(true);
    expect(stored.params.width).toBe(2);
    expect(stored.structure.heightUnits).toBe(3);
    expect(design.params.meshAssets.a).toBe(cutoutAsset);
  });

  it('is idempotent: a holder of refs comes back as the same object', async () => {
    const stored = await storeHolderMeshes({ params: { meshAssets: { a: await makeAsset() } } });
    expect(await storeHolderMeshes(stored)).toBe(stored);
  });

  it('keeps an asset inline when its file cannot be written', async () => {
    const asset = await makeAsset();
    vi.stubGlobal('indexedDB', undefined);
    const holder = { params: { meshAssets: { a: asset } } };
    expect(await storeHolderMeshes(holder)).toBe(holder);
  });

  it('keeps an asset the file format cannot hold inline', async () => {
    const holder = { params: { meshAssets: { a: { ...(await makeAsset()), outlines: [] } } } };
    expect(await storeHolderMeshes(holder)).toBe(holder);
  });

  it('shares one file between copies of the same mesh', async () => {
    const asset = await makeAsset();
    const original = await storeHolderMeshes({ params: { meshAssets: { a: asset } } });
    const duplicate = await storeHolderMeshes({
      params: { meshAssets: { b: { ...asset, sizeMm: { ...asset.sizeMm } } } },
    });

    expect(holderMeshHashes(duplicate)).toEqual(holderMeshHashes(original));
    const swept = await sweepMeshFiles(new Set(), Date.now() + MESH_SWEEP_GRACE_MS + 1);
    expect(swept).toEqual(holderMeshHashes(original));
  });

  it('leaves holders without meshes untouched', async () => {
    const holder = { params: { width: 1 }, structure: { kind: 'assembly' } };
    expect(await storeHolderMeshes(holder)).toBe(holder);
  });
});

describe('inlineHolderMeshes', () => {
  it('restores the inline design the refs were made from', async () => {
    const design = {
      params: {
        width: 2,
        meshAssets: { a: await makeAsset('wrench'), b: await makeAsset('x', 20) },
      },
      structure: { kind: 'importedMesh', heightUnits: 3, asset: await makeAsset('bin', 50) },
    };
    const stored = await storeHolderMeshes(design);
    __resetMeshStoreForTests();

    const inline = await inlineHolderMeshes(stored);
    expect(isOk(inline) && JSON.stringify(inline.value)).toBe(JSON.stringify(design));
  });

  it('fails, naming the file, rather than drop a mesh whose file is missing', async () => {
    const inline = await inlineHolderMeshes({ params: { meshAssets: { a: missingRef() } } });
    expect(isErr(inline) && inline.error).toMatchObject({
      code: 'STORAGE_MESH_MISSING',
      hash: MISSING_HASH,
    });
  });
});

describe('loadMeshOutlines', () => {
  it('reads outlines for refs and leaves a missing file pending', async () => {
    const asset = await makeAsset();
    const ref = await storeMeshAsset(asset);
    __clearMeshOutlinesForTests();
    expect(meshAssetOutlines(ref ?? undefined)).toBeUndefined();

    await loadMeshOutlines([ref ?? missingRef(), missingRef()]);

    expect(meshAssetOutlines(ref ?? undefined)).toEqual(asset.outlines);
    expect(meshAssetOutlines(missingRef())).toBeUndefined();
  });

  it('reads again a file that arrived while an earlier read found it missing', async () => {
    const asset = await makeAsset('late', 30);
    const file = await meshAssetFile(asset);
    if (!file) throw new Error('fixture');
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(getMeshFile).mockImplementationOnce(async () => {
      await held;
      return null;
    });

    const first = loadMeshOutlines([file.ref]);
    await putMeshFile(file.bytes);
    const second = loadMeshOutlines([file.ref]);
    release();
    await Promise.all([first, second]);

    expect(meshAssetOutlines(file.ref)).toEqual(asset.outlines);
  });
});
