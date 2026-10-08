/**
 * Sync payloads of designs and versions whose meshes are refs. A push sends the
 * refs once the account holds every file; to a server without a mesh store it
 * sends byte for byte what the inline design produced. What comes back is
 * stored as refs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: vi.fn() }));
vi.mock('@/shared/generation/meshStore', async (importOriginal) => {
  const actual = await importOriginal<typeof MeshStore>();
  return { ...actual, getMeshFile: vi.fn(actual.getMeshFile) };
});

import { unwrap } from '@/core/result';
import { designId } from '@/core/types';
import { encodeMeshData, isMeshAssetRef } from '@/shared/generation/meshAsset';
import type { MeshAsset, MeshAssetEntry, MeshAssetRef } from '@/shared/generation/meshAsset';
import { holderMeshHashes, meshAssetFile } from '@/shared/generation/meshRefs';
import { __resetMeshCloudForTests } from '@/shared/generation/meshCloud';
import { __resetMeshStoreForTests, getMeshFile, putMeshFile } from '@/shared/generation/meshStore';
import type * as MeshStore from '@/shared/generation/meshStore';
import { compressString, decompressString } from '@/shared/utils/compression';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import type { ImportedMeshStructure } from '@/shared/types/item';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { AdapterChange } from '@/core/sync/adapters/types';
import type { BinParams, Cutout, DesignVersion, SavedDesign } from '../types';
import { closeDesignerDb, deleteDesign, loadDesign } from '../storage/DesignerStorage';
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

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function requests(method: string): string[] {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === method).map(([url]) => url);
}

beforeEach(async () => {
  closeDesignerDb();
  __resetMeshStoreForTests();
  __resetMeshCloudForTests();
  await deleteDb('gridfinity-designer-v1');
  await deleteDb('gridfinity-mesh-files');
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  __resetMeshCloudForTests();
  vi.unstubAllGlobals();
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

  async function skippedForLateFile(scale: number): Promise<{
    bytes: Uint8Array<ArrayBuffer>;
    changes: AdapterChange[];
    stop: () => void;
  }> {
    const file = await meshAssetFile(await makeAsset('late', scale));
    if (!file) throw new Error('fixture');
    await writeRaw(
      rawDesign({
        ...DEFAULT_BIN_PARAMS,
        cutouts: [meshCutout('c1', 'm1')],
        meshAssets: { m1: file.ref },
      })
    );
    const changes: AdapterChange[] = [];
    const stop = designAdapter.subscribe((change) => changes.push(change));
    expect(await designAdapter.get(DESIGN_ID)).toBeNull();
    return { bytes: file.bytes, changes, stop };
  }

  it('queue a design skipped for a missing mesh file again once the file arrives', async () => {
    const { bytes, changes, stop } = await skippedForLateFile(20);

    await putMeshFile(bytes);

    await vi.waitFor(() =>
      expect(changes).toEqual([
        { kind: 'put', id: DESIGN_ID, modifiedAt: Date.parse('2026-01-02T00:00:00.000Z') },
      ])
    );
    stop();
    expect(await designAdapter.get(DESIGN_ID)).not.toBeNull();
  });

  it('queue it at the edit time the design has when the file arrives', async () => {
    const { bytes, changes, stop } = await skippedForLateFile(22);
    const design = unwrap(await loadDesign(DESIGN_ID));
    await writeRaw({ ...design, updatedAt: '2026-01-05T00:00:00.000Z' });

    await putMeshFile(bytes);

    await vi.waitFor(() =>
      expect(changes).toEqual([
        { kind: 'put', id: DESIGN_ID, modifiedAt: Date.parse('2026-01-05T00:00:00.000Z') },
      ])
    );
    stop();
  });

  it('queue a design whose file landed before its skip was noted', async () => {
    const file = await meshAssetFile(await makeAsset('raced', 24));
    if (!file) throw new Error('fixture');
    await writeRaw(
      rawDesign({
        ...DEFAULT_BIN_PARAMS,
        cutouts: [meshCutout('c1', 'm1')],
        meshAssets: { m1: file.ref },
      })
    );
    const changes: AdapterChange[] = [];
    const stop = designAdapter.subscribe((change) => changes.push(change));
    vi.mocked(getMeshFile).mockImplementationOnce(async () => {
      await putMeshFile(file.bytes);
      return null;
    });

    expect(await designAdapter.get(DESIGN_ID)).toBeNull();

    await vi.waitFor(() => expect(changes.map((c) => c.kind)).toEqual(['put']));
    stop();
  });

  it('leave a design deleted after its push was skipped deleted when the file arrives', async () => {
    const { bytes, changes, stop } = await skippedForLateFile(23);
    unwrap(await deleteDesign(DESIGN_ID));

    await putMeshFile(bytes);
    await new Promise((resolve) => setTimeout(resolve, 50));
    stop();

    expect(changes.map((c) => c.kind)).toEqual(['delete']);
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

  it('queue a version skipped for a missing mesh file again once the file arrives', async () => {
    const file = await meshAssetFile(await makeAsset('late', 21));
    if (!file) throw new Error('fixture');
    await (
      await getDb()
    ).put(
      DESIGN_VERSIONS_STORE,
      rawVersion({ name: 'Sync', params: { ...DEFAULT_BIN_PARAMS, meshAssets: { m1: file.ref } } })
    );
    const changes: AdapterChange[] = [];
    const stop = designVersionAdapter.subscribe((change) => changes.push(change));
    expect(await designVersionAdapter.get(VERSION_ID)).toBeNull();

    await putMeshFile(file.bytes);

    await vi.waitFor(() =>
      expect(changes).toEqual([
        { kind: 'put', id: VERSION_ID, modifiedAt: Date.parse('2026-01-01T00:00:00.000Z') },
      ])
    );
    stop();
    expect(await designVersionAdapter.get(VERSION_ID)).not.toBeNull();
  });
});

describe('pushes through the mesh store', () => {
  function meshAssetsOf(params: unknown): MeshAssetEntry[] {
    return Object.values((params as BinParams).meshAssets ?? {});
  }

  /** A stored design of refs, and the inline payload it was made from. */
  async function refDesign(): Promise<{ hashes: string[]; inline: unknown }> {
    await writeRaw(rawDesign(await inlineParams()));
    const inline = await designAdapter.get(DESIGN_ID);
    await moveInlineMeshesToFiles();
    return { hashes: holderMeshHashes(unwrap(await loadDesign(DESIGN_ID))), inline };
  }

  async function lateFileDesign(scale: number): Promise<Uint8Array<ArrayBuffer>> {
    const file = await meshAssetFile(await makeAsset('elsewhere', scale));
    if (!file) throw new Error('fixture');
    await writeRaw(
      rawDesign({
        ...DEFAULT_BIN_PARAMS,
        cutouts: [meshCutout('c1', 'm1')],
        meshAssets: { m1: file.ref },
      })
    );
    return file.bytes;
  }

  it('send the refs once the files the account lacks are uploaded', async () => {
    const { hashes } = await refDesign();
    const [lacked, held] = hashes;
    fetchMock.mockImplementation(async (url, init) => {
      const status = init?.method === 'HEAD' && url.endsWith(lacked) ? 404 : 200;
      return new Response(null, { status });
    });

    const plan = await designAdapter.preparePush?.(DESIGN_ID);

    if (plan?.status !== 'send') throw new Error(`expected send, got ${plan?.status}`);
    expect(meshAssetsOf(plan.item.payload.params).map((a) => isMeshAssetRef(a))).toEqual([
      true,
      true,
    ]);
    expect(requests('PUT')).toEqual([`/api/meshes/${lacked}`]);
    expect(requests('HEAD').sort()).toEqual(
      [`/api/meshes/${held}`, `/api/meshes/${lacked}`].sort()
    );
  });

  it('send every mesh inline, as before, to a server without a mesh store', async () => {
    const { inline } = await refDesign();
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const plan = await designAdapter.preparePush?.(DESIGN_ID);

    expect(plan?.status).toBe('send');
    expect(JSON.stringify(plan?.status === 'send' ? plan.item : null)).toBe(JSON.stringify(inline));
  });

  it('start no download once sync has stopped', async () => {
    await lateFileDesign(29);
    const stop = designAdapter.subscribe(() => undefined);
    stop();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requests('HEAD')).toEqual([]);
  });

  it('send a file the server refuses inline, and the rest as refs', async () => {
    const { hashes } = await refDesign();
    const [refused, held] = hashes;
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method !== 'HEAD') return new Response(null, { status: 413 });
      return new Response(null, { status: url.endsWith(held) ? 200 : 404 });
    });

    const plan = await designAdapter.preparePush?.(DESIGN_ID);

    if (plan?.status !== 'send') throw new Error(`expected send, got ${plan?.status}`);
    const sent = meshAssetsOf(plan.item.payload.params).map((a) =>
      isMeshAssetRef(a) ? a.hash : 'inline'
    );
    expect(sent.sort()).toEqual([held, 'inline'].sort());
    expect(requests('PUT')).toEqual([`/api/meshes/${refused}`]);
  });

  it('defer the push when an upload fails', async () => {
    await refDesign();
    fetchMock.mockImplementation(
      async (_url, init) => new Response(null, { status: init?.method === 'HEAD' ? 404 : 500 })
    );

    expect(await designAdapter.preparePush?.(DESIGN_ID)).toEqual({
      status: 'defer',
      reason: 'mesh upload: HTTP 500',
    });
  });

  it('reject the push while offline, as a push does, so no retry is spent', async () => {
    await refDesign();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(designAdapter.preparePush?.(DESIGN_ID)).rejects.toThrow('Failed to fetch');
  });

  it('send the refs of a design whose files only the server has', async () => {
    await lateFileDesign(27);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const plan = await designAdapter.preparePush?.(DESIGN_ID);

    expect(plan?.status).toBe('send');
    expect(requests('PUT')).toEqual([]);
  });

  it('hold a push naming a file on neither side until the file arrives', async () => {
    const bytes = await lateFileDesign(28);
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    const changes: AdapterChange[] = [];
    const stop = designAdapter.subscribe((change) => changes.push(change));

    expect(await designAdapter.preparePush?.(DESIGN_ID)).toEqual({ status: 'skip' });
    await putMeshFile(bytes);

    await vi.waitFor(() =>
      expect(changes).toEqual([
        { kind: 'put', id: DESIGN_ID, modifiedAt: Date.parse('2026-01-02T00:00:00.000Z') },
      ])
    );
    stop();
  });

  it('ask again for a file the server says the account lacks', async () => {
    const { hashes } = await refDesign();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await designAdapter.preparePush?.(DESIGN_ID);
    fetchMock.mockClear();

    await designAdapter.preparePush?.(DESIGN_ID);
    expect(fetchMock).not.toHaveBeenCalled();

    designVersionAdapter.onMissing?.([hashes[0]]);
    await designAdapter.preparePush?.(DESIGN_ID);
    expect(requests('HEAD')).toEqual([`/api/meshes/${hashes[0]}`]);
  });

  it("send a version's refs once the account holds its files", async () => {
    const params = await inlineParams();
    await (
      await getDb()
    ).put(DESIGN_VERSIONS_STORE, {
      id: 'version_push',
      designId: DESIGN_ID,
      name: 'v1',
      content: compressString(JSON.stringify({ name: 'Sync', params })),
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      origin: 'manual',
    } satisfies DesignVersion);
    await moveInlineMeshesToFiles();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const plan = await designVersionAdapter.preparePush?.('version_push');

    if (plan?.status !== 'send') throw new Error(`expected send, got ${plan?.status}`);
    const content = plan.item.payload.content as { params: BinParams };
    expect(meshAssetsOf(content.params).every((a) => isMeshAssetRef(a))).toBe(true);
    expect(requests('HEAD')).toHaveLength(2);
  });
});

describe('pulls through the mesh store', () => {
  const CDN = 'https://store.public.blob.vercel-storage.com/meshes/';

  /** A ref the account holds, whose file is on the CDN but not on this device. */
  async function remoteRef(scale: number): Promise<{ ref: MeshAssetRef; bytes: Uint8Array }> {
    const file = await meshAssetFile(await makeAsset('remote', scale));
    if (!file) throw new Error('fixture');
    return file;
  }

  function serve(
    files: ReadonlyMap<string, Uint8Array>,
    cdn: (bytes: Uint8Array) => Promise<Response> = async (bytes) =>
      new Response(bytes.slice(), { status: 200 })
  ): void {
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'HEAD') {
        const hash = url.slice('/api/meshes/'.length);
        return files.has(hash)
          ? new Response(null, { status: 200, headers: { 'X-Mesh-Url': CDN + hash } })
          : new Response(null, { status: 404 });
      }
      const bytes = files.get(url.slice(CDN.length));
      return bytes ? cdn(bytes) : new Response(null, { status: 404 });
    });
  }

  function refParams(ref: MeshAssetRef): BinParams {
    return { ...DEFAULT_BIN_PARAMS, cutouts: [meshCutout('c1', 'm1')], meshAssets: { m1: ref } };
  }

  it('store a pulled design of refs as refs, and fetch its files without holding up the pull', async () => {
    const { ref, bytes } = await remoteRef(41);
    let release: () => void = () => {};
    serve(
      new Map([[ref.hash, bytes]]),
      (body) =>
        new Promise((resolve) => {
          release = () => resolve(new Response(body.slice(), { status: 200 }));
        })
    );

    await designAdapter.applyRemote({
      id: DESIGN_ID,
      payload: { name: 'Pulled', params: refParams(ref) },
      modifiedAt: Date.parse('2026-02-01T00:00:00.000Z'),
    });

    const stored = unwrap(await loadDesign(DESIGN_ID));
    expect(stored.params?.meshAssets).toEqual({ m1: ref });
    await vi.waitFor(() => expect(requests('HEAD')).toEqual([`/api/meshes/${ref.hash}`]));
    expect(await getMeshFile(ref.hash)).toBeNull();

    release();
    await vi.waitFor(async () => expect(await getMeshFile(ref.hash)).toEqual(bytes));
  });

  it('fetch the files a pulled version names', async () => {
    const { ref, bytes } = await remoteRef(42);
    serve(new Map([[ref.hash, bytes]]));

    await designVersionAdapter.applyRemote({
      id: 'version_pulled',
      payload: {
        designId: DESIGN_ID,
        name: 'v1',
        content: { name: 'Sync', params: refParams(ref) },
        createdAt: '2026-01-01T00:00:00.000Z',
        origin: 'manual',
      },
      modifiedAt: Date.parse('2026-01-03T00:00:00.000Z'),
    });

    await vi.waitFor(async () => expect(await getMeshFile(ref.hash)).toEqual(bytes));
  });

  it('keep a pulled design whose file cannot be fetched, its pocket pending', async () => {
    const { ref } = await remoteRef(43);
    serve(new Map());

    await designAdapter.applyRemote({
      id: DESIGN_ID,
      payload: { name: 'Pulled', params: refParams(ref) },
      modifiedAt: Date.parse('2026-02-01T00:00:00.000Z'),
    });

    await vi.waitFor(() => expect(requests('HEAD')).toHaveLength(1));
    expect(unwrap(await loadDesign(DESIGN_ID)).params?.meshAssets).toEqual({ m1: ref });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('try again, once sync starts, for a file an earlier pull could not fetch', async () => {
    const { ref, bytes } = await remoteRef(44);
    await writeRaw(rawDesign(refParams(ref)));
    serve(new Map([[ref.hash, bytes]]));

    const stop = designAdapter.subscribe(() => {});

    await vi.waitFor(async () => expect(await getMeshFile(ref.hash)).toEqual(bytes));
    stop();
  });
});

describe('whole-bin STL designs', () => {
  const CDN = 'https://store.public.blob.vercel-storage.com/meshes/';
  const ENVELOPE = {
    ...createDefaultEnvelope(DEFAULT_BIN_PARAMS.featureColors),
    width: 2,
    depth: 1.5,
  };

  function structureOf(asset: MeshAssetEntry): ImportedMeshStructure {
    return {
      kind: 'importedMesh',
      heightUnits: 4,
      asset,
      volumeMm3: 51_000,
      sourceFileName: 'parts_bin.stl',
    };
  }

  function rawImported(asset: MeshAssetEntry): SavedDesign {
    return {
      id: DESIGN_ID,
      name: 'Parts bin',
      kind: 'importedMesh',
      envelope: ENVELOPE,
      structure: structureOf(asset),
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      exportFileNameConfig: null,
    };
  }

  function assetOf(holder: { structure?: unknown }): MeshAssetEntry {
    return (holder.structure as ImportedMeshStructure).asset;
  }

  function serve(files: ReadonlyMap<string, Uint8Array>): void {
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'HEAD') {
        const hash = url.slice('/api/meshes/'.length);
        return files.has(hash)
          ? new Response(null, { status: 200, headers: { 'X-Mesh-Url': CDN + hash } })
          : new Response(null, { status: 404 });
      }
      const bytes = files.get(url.slice(CDN.length));
      return bytes
        ? new Response(bytes.slice(), { status: 200 })
        : new Response(null, { status: 404 });
    });
  }

  it('push the mesh by ref once the account holds its file', async () => {
    await writeRaw(rawImported(await makeAsset('parts_bin', 61)));
    await moveInlineMeshesToFiles();
    const stored = unwrap(await loadDesign(DESIGN_ID));
    const [hash] = holderMeshHashes(stored);
    fetchMock.mockImplementation(
      async (_url, init) => new Response(null, { status: init?.method === 'HEAD' ? 404 : 200 })
    );

    const plan = await designAdapter.preparePush?.(DESIGN_ID);

    if (plan?.status !== 'send') throw new Error(`expected send, got ${plan?.status}`);
    expect(plan.item.payload).toEqual({
      name: 'Parts bin',
      kind: 'importedMesh',
      envelope: ENVELOPE,
      structure: structureOf(assetOf(stored)),
    });
    expect(isMeshAssetRef(assetOf(plan.item.payload))).toBe(true);
    expect(requests('PUT')).toEqual([`/api/meshes/${hash}`]);
  });

  it('push the mesh inline, as the inline design did, to a server without a mesh store', async () => {
    await writeRaw(rawImported(await makeAsset('parts_bin', 62)));
    const inline = await designAdapter.get(DESIGN_ID);
    await moveInlineMeshesToFiles();
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const plan = await designAdapter.preparePush?.(DESIGN_ID);

    expect(inline && isMeshAssetRef(assetOf(inline.payload))).toBe(false);
    expect(JSON.stringify(plan?.status === 'send' ? plan.item : null)).toBe(JSON.stringify(inline));
  });

  it('hold a push whose mesh file is on neither side until the file arrives', async () => {
    const file = await meshAssetFile(await makeAsset('elsewhere_bin', 63));
    if (!file) throw new Error('fixture');
    await writeRaw(rawImported(file.ref));
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    const changes: AdapterChange[] = [];
    const stop = designAdapter.subscribe((change) => changes.push(change));

    expect(await designAdapter.preparePush?.(DESIGN_ID)).toEqual({ status: 'skip' });
    expect(requests('PUT')).toEqual([]);
    await putMeshFile(file.bytes);

    await vi.waitFor(() =>
      expect(changes).toEqual([
        { kind: 'put', id: DESIGN_ID, modifiedAt: Date.parse('2026-01-02T00:00:00.000Z') },
      ])
    );
    stop();
  });

  it('store a pulled design of refs as refs, and fetch its file', async () => {
    const file = await meshAssetFile(await makeAsset('remote_bin', 64));
    if (!file) throw new Error('fixture');
    serve(new Map([[file.ref.hash, file.bytes]]));

    await designAdapter.applyRemote({
      id: DESIGN_ID,
      payload: {
        name: 'Parts bin',
        kind: 'importedMesh',
        envelope: ENVELOPE,
        structure: structureOf(file.ref),
      },
      modifiedAt: Date.parse('2026-02-01T00:00:00.000Z'),
    });

    const stored = unwrap(await loadDesign(DESIGN_ID));
    expect(stored.kind).toBe('importedMesh');
    expect(stored.envelope).toEqual(ENVELOPE);
    expect(stored.structure).toEqual(structureOf(file.ref));
    await vi.waitFor(async () => expect(await getMeshFile(file.ref.hash)).toEqual(file.bytes));
  });

  it('store a pulled inline design as a ref, and push it back unchanged', async () => {
    const asset = await makeAsset('inline_bin', 65);

    await designAdapter.applyRemote({
      id: DESIGN_ID,
      payload: {
        name: 'Parts bin',
        kind: 'importedMesh',
        envelope: ENVELOPE,
        structure: structureOf(asset),
      },
      modifiedAt: Date.parse('2026-02-01T00:00:00.000Z'),
    });

    expect(isMeshAssetRef(assetOf(unwrap(await loadDesign(DESIGN_ID))))).toBe(true);
    const pushed = await designAdapter.get(DESIGN_ID);
    expect(JSON.stringify(pushed?.payload.structure)).toBe(JSON.stringify(structureOf(asset)));
  });

  it("send a version's mesh by ref, and store and fetch a pulled version's", async () => {
    const asset = await makeAsset('versioned_bin', 66);
    await (
      await getDb()
    ).put(DESIGN_VERSIONS_STORE, {
      id: 'version_imported',
      designId: DESIGN_ID,
      name: 'v1',
      content: compressString(
        JSON.stringify({
          name: 'Parts bin',
          kind: 'importedMesh',
          envelope: ENVELOPE,
          structure: structureOf(asset),
        })
      ),
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      origin: 'manual',
    } satisfies DesignVersion);
    await moveInlineMeshesToFiles();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const plan = await designVersionAdapter.preparePush?.('version_imported');

    if (plan?.status !== 'send') throw new Error(`expected send, got ${plan?.status}`);
    const content = plan.item.payload.content as { kind: string; structure: unknown };
    expect(content.kind).toBe('importedMesh');
    expect(isMeshAssetRef(assetOf(content))).toBe(true);
    expect(requests('HEAD')).toHaveLength(1);

    const remote = await meshAssetFile(await makeAsset('pulled_version_bin', 67));
    if (!remote) throw new Error('fixture');
    serve(new Map([[remote.ref.hash, remote.bytes]]));
    await designVersionAdapter.applyRemote({
      id: 'version_pulled_imported',
      payload: {
        designId: DESIGN_ID,
        name: 'v2',
        content: {
          name: 'Parts bin',
          kind: 'importedMesh',
          envelope: ENVELOPE,
          structure: structureOf(remote.ref),
        },
        createdAt: '2026-01-04T00:00:00.000Z',
        origin: 'manual',
      },
      modifiedAt: Date.parse('2026-01-04T00:00:00.000Z'),
    });

    await vi.waitFor(async () => expect(await getMeshFile(remote.ref.hash)).toEqual(remote.bytes));
    const listed = await designVersionAdapter.list();
    expect(listed.map((item) => item.id).sort()).toEqual([
      'version_imported',
      'version_pulled_imported',
    ]);
  });
});
