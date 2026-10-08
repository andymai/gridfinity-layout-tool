import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { isErr, unwrap } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { encodeMeshData, isMeshAssetRef } from '@/shared/generation/meshAsset';
import type { MeshAsset, MeshAssetRef } from '@/shared/generation/meshAsset';
import { encodeMeshFile } from '@/shared/generation/meshFile';
import { storeMeshAsset } from '@/shared/generation/meshRefs';
import { __resetMeshStoreForTests } from '@/shared/generation/meshStore';
import type { BinParams, Cutout } from '@/shared/types/bin';
import type { GridfinityItem } from '@/shared/types/item';
import { MeshDelivery, prepareMeshes } from './meshDelivery';
import type { GenerateMessage, WorkerMessage } from './types';

async function makeAsset(name: string, scale = 30): Promise<MeshAsset> {
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
        { x: scale, y: 0 },
        { x: 0, y: scale },
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

function generate(params: BinParams): GenerateMessage {
  return { type: 'GENERATE', payload: { params, requestId: 'r1' } };
}

function paramsOf(message: WorkerMessage): BinParams {
  if (message.type !== 'GENERATE') throw new Error('expected GENERATE');
  return message.payload.params;
}

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const MISSING: MeshAssetRef = {
  name: 'gone',
  hash: '7'.repeat(64),
  triangleCount: 4,
  sizeMm: { x: 30, y: 30, z: 30 },
  bytes: 1,
};

beforeEach(() => {
  __resetMeshStoreForTests();
});

describe('prepareMeshes', () => {
  it('sends a ref as is, with the file it names', async () => {
    const asset = await makeAsset('a');
    const ref = (await storeMeshAsset(asset)) ?? MISSING;
    const params = { ...DEFAULT_BIN_PARAMS, meshAssets: { m1: ref } };
    const message = generate(params);

    const prepared = unwrap(await prepareMeshes(message));

    expect(prepared.pending).toBe(false);
    expect(prepared.apply(message)).toBe(message);
    expect([...prepared.files.keys()]).toEqual([ref.hash]);
    expect(prepared.files.get(ref.hash)).toEqual(unwrap(encodeMeshFile(asset)));
  });

  it('turns an inline asset into a ref, so the worker never receives mesh data inline', async () => {
    const asset = await makeAsset('b');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      cutouts: [meshCutout('c1', 'm1')],
      meshAssets: { m1: asset },
    };
    const message = generate(params);

    const prepared = unwrap(await prepareMeshes(message));
    const sent = paramsOf(prepared.apply(message)).meshAssets?.m1;

    const file = unwrap(encodeMeshFile(asset));
    expect(sent).toEqual({
      name: 'b',
      hash: sha(file),
      triangleCount: 4,
      sizeMm: asset.sizeMm,
      bytes: file.byteLength,
    });
    expect(prepared.files.get(sha(file))).toEqual(file);
    expect(paramsOf(prepared.apply(message)).cutouts).toBe(params.cutouts);
  });

  it('leaves out the cutouts of a ref whose file is missing, and says so', async () => {
    const kept = (await storeMeshAsset(await makeAsset('kept'))) ?? MISSING;
    const params = {
      ...DEFAULT_BIN_PARAMS,
      cutouts: [meshCutout('c1', 'gone'), meshCutout('c2', 'kept')],
      meshAssets: { gone: MISSING, kept },
    };
    const message = generate(params);

    const prepared = unwrap(await prepareMeshes(message));
    const sent = paramsOf(prepared.apply(message));

    expect(prepared.pending).toBe(true);
    expect(sent.cutouts.map((c) => c.id)).toEqual(['c2']);
    expect(Object.keys(sent.meshAssets ?? {})).toEqual(['kept']);
  });

  it('applies the same rewrite to another request built from the same params', async () => {
    const params = { ...DEFAULT_BIN_PARAMS, meshAssets: { m1: await makeAsset('c') } };
    const prepared = unwrap(await prepareMeshes(generate(params)));
    const exported: WorkerMessage = {
      type: 'EXPORT',
      payload: { params, requestId: 'r2', format: 'stl' },
    };

    const sent = prepared.apply(exported);

    expect(sent.type).toBe('EXPORT');
    const entry = sent.type === 'EXPORT' ? sent.payload.params.meshAssets?.m1 : undefined;
    expect(entry && isMeshAssetRef(entry)).toBe(true);
  });

  it('swaps an imported STL design for a ref, and refuses one whose file is missing', async () => {
    const asset = await makeAsset('bin');
    const item = {
      envelope: { width: 1, depth: 1 },
      structure: { kind: 'importedMesh', heightUnits: 2, asset },
    } as unknown as GridfinityItem;
    const message: WorkerMessage = { type: 'GENERATE_ITEM', payload: { item, requestId: 'r' } };

    const prepared = unwrap(await prepareMeshes(message));
    const sent = prepared.apply(message);
    const sentAsset =
      sent.type === 'GENERATE_ITEM' && sent.payload.item.structure.kind === 'importedMesh'
        ? sent.payload.item.structure.asset
        : undefined;
    expect(sentAsset && isMeshAssetRef(sentAsset)).toBe(true);
    expect(prepared.files.size).toBe(1);

    const missing = {
      ...item,
      structure: { kind: 'importedMesh', heightUnits: 2, asset: MISSING },
    } as unknown as GridfinityItem;
    const refused = await prepareMeshes({
      type: 'GENERATE_ITEM',
      payload: { item: missing, requestId: 'r' },
    });
    expect(isErr(refused) && refused.error).toMatchObject({
      code: 'STORAGE_MESH_MISSING',
      hash: MISSING.hash,
    });
  });

  it('passes a design without meshes through untouched', async () => {
    const message = generate(DEFAULT_BIN_PARAMS);
    const prepared = unwrap(await prepareMeshes(message));
    expect(prepared.apply(message)).toBe(message);
    expect(prepared.files.size).toBe(0);
  });
});

describe('MeshDelivery', () => {
  const bytes = (n: number, fill: number): Uint8Array<ArrayBuffer> => new Uint8Array(n).fill(fill);

  it('sends each file to the worker once, as a transferred copy', () => {
    const delivery = new MeshDelivery();
    const file = bytes(100, 1);
    const files = new Map([['h1', file]]);

    const first = delivery.messagesFor(files);
    const second = delivery.messagesFor(files);

    expect(first).toHaveLength(1);
    expect(first[0].message).toEqual({ type: 'PUT_MESH', hash: 'h1', bytes: file });
    expect(first[0].transfer).toHaveLength(1);
    expect(first[0].transfer[0]).not.toBe(file.buffer);
    expect(second).toEqual([]);
  });

  it('drops the least recently needed files past its budget, never one the request needs', () => {
    const delivery = new MeshDelivery(250);
    delivery.messagesFor(new Map([['a', bytes(100, 1)]]));
    delivery.messagesFor(new Map([['b', bytes(100, 2)]]));
    delivery.messagesFor(new Map([['a', bytes(100, 1)]]));

    const out = delivery.messagesFor(new Map([['c', bytes(100, 3)]]));

    expect(out.map((o) => o.message.type)).toEqual(['PUT_MESH', 'DROP_MESH']);
    expect(out[1].message).toEqual({ type: 'DROP_MESH', hash: 'b' });
    expect(delivery.messagesFor(new Map([['a', bytes(100, 1)]]))).toEqual([]);
  });

  it('sends everything again to a replaced worker', () => {
    const delivery = new MeshDelivery();
    const files = new Map([['h1', bytes(10, 1)]]);
    delivery.messagesFor(files);
    delivery.reset();
    expect(delivery.messagesFor(files)).toHaveLength(1);
  });
});
