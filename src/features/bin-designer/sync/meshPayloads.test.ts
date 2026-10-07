/**
 * Sync payloads of designs and versions whose meshes are refs. The server and
 * other devices take inline meshes only, so what goes out must be byte for byte
 * what the inline design produced, and what comes back must be stored as refs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: vi.fn() }));
vi.mock('@/shared/generation/meshStore', async (importOriginal) => {
  const actual = await importOriginal<typeof MeshStore>();
  return { ...actual, getMeshFile: vi.fn(actual.getMeshFile) };
});

import { unwrap } from '@/core/result';
import { designId } from '@/core/types';
import { encodeMeshData, isMeshAssetRef } from '@/shared/generation/meshAsset';
import type { MeshAsset, MeshAssetEntry, MeshAssetRef } from '@/shared/generation/meshAsset';
import { holderMeshHashes } from '@/shared/generation/meshRefs';
import { __resetMeshStoreForTests, getMeshFile } from '@/shared/generation/meshStore';
import type * as MeshStore from '@/shared/generation/meshStore';
import { compressString, decompressString } from '@/shared/utils/compression';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams, Cutout, DesignVersion, SavedDesign } from '../types';
import { closeDesignerDb, loadDesign } from '../storage/DesignerStorage';
import { getDesignVersionRecord } from '../storage/DesignVersionService';
import { DESIGNS_STORE, DESIGN_VERSIONS_STORE, getDb } from '../storage/designerDb';
import { moveInlineMeshesToFiles } from '../storage/designMeshFiles';
import { designAdapter } from './designAdapter';
import { designVersionAdapter } from './designVersionAdapter';

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

async function makeAsset(name: string, scale: number): Promise<MeshAsset> {
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
        { x: scale, y: 0.5 },
        { x: 0.25, y: scale },
      ],
    ],
  };
}

function meshCutout(id: string, meshId: string): Cutout {
  return {
    id,
    shape: 'mesh',
    meshId,
    x: 5,
    y: 5,
    width: 30,
    depth: 30,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}

async function inlineParams(): Promise<BinParams> {
  return {
    ...DEFAULT_BIN_PARAMS,
    cutouts: [meshCutout('c1', 'm1'), meshCutout('c2', 'm2')],
    meshAssets: { m1: await makeAsset('wrench', 30), m2: await makeAsset('pliers', 25) },
  };
}

const MISSING: MeshAssetRef = {
  name: 'gone',
  hash: '2'.repeat(64),
  triangleCount: 4,
  sizeMm: { x: 30, y: 30, z: 30 },
  bytes: 1,
};

const DESIGN_ID = designId('design_sync');

async function writeRaw(design: SavedDesign): Promise<void> {
  await (await getDb()).put(DESIGNS_STORE, design);
}

function rawDesign(params: BinParams): SavedDesign {
  return {
    id: DESIGN_ID,
    name: 'Sync',
    params,
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    exportFileNameConfig: null,
    tags: ['tools'],
  };
}

beforeEach(async () => {
  closeDesignerDb();
  __resetMeshStoreForTests();
  await deleteDb('gridfinity-designer-v1');
  await deleteDb('gridfinity-mesh-files');
});

describe('design sync payloads', () => {
  it('push the same payload for a ref design as the inline design produced', async () => {
    await writeRaw(rawDesign(await inlineParams()));
    const before = await designAdapter.get(DESIGN_ID);
    const listedBefore = await designAdapter.list();

    expect(await moveInlineMeshesToFiles()).toBe(1);
    __resetMeshStoreForTests();
    const stored = unwrap(await loadDesign(DESIGN_ID));
    expect(Object.values(stored.params?.meshAssets ?? {}).every(isMeshAssetRef)).toBe(true);

    expect(JSON.stringify(await designAdapter.get(DESIGN_ID))).toBe(JSON.stringify(before));
    const listed = await designAdapter.list();
    expect(listed.map((i) => [i.id, i.modifiedAt])).toEqual(
      listedBefore.map((i) => [i.id, i.modifiedAt])
    );
  });

  it('list designs and versions without reading a mesh file', async () => {
    const params = await inlineParams();
    await writeRaw(rawDesign(params));
    await (
      await getDb()
    ).put(DESIGN_VERSIONS_STORE, {
      id: 'version_list',
      designId: DESIGN_ID,
      name: 'v1',
      content: compressString(JSON.stringify({ name: 'Sync', params })),
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      origin: 'manual',
    } satisfies DesignVersion);
    await moveInlineMeshesToFiles();
    __resetMeshStoreForTests();
    vi.mocked(getMeshFile).mockClear();

    const designs = await designAdapter.list();
    const versions = await designVersionAdapter.list();

    expect(designs.map((i) => i.id)).toEqual([DESIGN_ID]);
    expect(versions.map((i) => i.id)).toEqual(['version_list']);
    expect(getMeshFile).not.toHaveBeenCalled();
    const listedParams = designs[0].payload.params as BinParams;
    expect(Object.values(listedParams.meshAssets ?? {}).every(isMeshAssetRef)).toBe(true);
  });

  it('store a pulled inline design as refs, and push it back unchanged', async () => {
    const params = await inlineParams();
    await designAdapter.applyRemote({
      id: DESIGN_ID,
      payload: { name: 'Pulled', params },
      modifiedAt: Date.parse('2026-02-01T00:00:00.000Z'),
    });

    const stored = unwrap(await loadDesign(DESIGN_ID));
    expect(holderMeshHashes(stored)).toHaveLength(2);
    const pushed = await designAdapter.get(DESIGN_ID);
    const pushedParams = pushed?.payload.params as BinParams | undefined;
    expect(JSON.stringify(pushedParams?.meshAssets)).toBe(JSON.stringify(params.meshAssets));
  });

  it('do not push a design whose mesh file is missing, but still list it', async () => {
    await writeRaw(
      rawDesign({
        ...DEFAULT_BIN_PARAMS,
        cutouts: [meshCutout('c1', 'm1')],
        meshAssets: { m1: MISSING },
      })
    );
    expect(await designAdapter.get(DESIGN_ID)).toBeNull();
    expect((await designAdapter.list()).map((i) => i.id)).toEqual([DESIGN_ID]);
  });
});

describe('design version sync payloads', () => {
  const VERSION_ID = 'version_sync';

  function rawVersion(content: unknown): DesignVersion {
    return {
      id: VERSION_ID,
      designId: DESIGN_ID,
      name: 'v1',
      content: compressString(JSON.stringify(content)),
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      origin: 'manual',
    };
  }

  it('push the same body for a ref version as the inline version produced', async () => {
    await (
      await getDb()
    ).put(DESIGN_VERSIONS_STORE, rawVersion({ name: 'Sync', params: await inlineParams() }));
    const before = await designVersionAdapter.get(VERSION_ID);

    expect(await moveInlineMeshesToFiles()).toBe(1);
    __resetMeshStoreForTests();

    expect(JSON.stringify(await designVersionAdapter.get(VERSION_ID))).toBe(JSON.stringify(before));
  });

  it('store a pulled version body with refs', async () => {
    const params = await inlineParams();
    await designVersionAdapter.applyRemote({
      id: VERSION_ID,
      payload: {
        designId: DESIGN_ID,
        name: 'v1',
        content: { name: 'Sync', params },
        createdAt: '2026-01-01T00:00:00.000Z',
        origin: 'manual',
      },
      modifiedAt: Date.parse('2026-01-03T00:00:00.000Z'),
    });

    const record = unwrap(await getDesignVersionRecord(VERSION_ID));
    const body = JSON.parse(decompressString(record?.content ?? '') ?? '{}') as {
      params: { meshAssets: Record<string, MeshAssetEntry> };
    };
    expect(Object.values(body.params.meshAssets).every(isMeshAssetRef)).toBe(true);
    const pushed = await designVersionAdapter.get(VERSION_ID);
    expect(pushed?.payload.content).toEqual({ name: 'Sync', params });
  });

  it('do not push a version whose mesh file is missing', async () => {
    await (
      await getDb()
    ).put(
      DESIGN_VERSIONS_STORE,
      rawVersion({ name: 'Sync', params: { ...DEFAULT_BIN_PARAMS, meshAssets: { m1: MISSING } } })
    );
    expect(await designVersionAdapter.get(VERSION_ID)).toBeNull();
    expect((await designVersionAdapter.list()).map((i) => i.id)).toEqual([VERSION_ID]);
  });
});
