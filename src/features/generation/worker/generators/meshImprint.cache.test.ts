// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { clearMeshImprintCache, prepareMeshImprints } from './meshImprint';
import { decodeMeshEntry } from '../meshFiles';
import type * as MeshFilesModule from '../meshFiles';
import { encodeMeshData } from '@/shared/generation/meshAsset';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { isErr, unwrap } from '@/core/result';

vi.mock('../meshFiles', async (importOriginal) => {
  const actual = await importOriginal<typeof MeshFilesModule>();
  return { ...actual, decodeMeshEntry: vi.fn(actual.decodeMeshEntry) };
});

let module: ManifoldToplevel;

beforeAll(async () => {
  const ManifoldModule = (await import('manifold-3d')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmBinary = readFileSync(join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
  module = await ManifoldModule({ wasmBinary } as unknown as { locateFile: () => string });
  module.setup();
}, 60_000);

async function boxAsset(width: number): Promise<MeshAsset> {
  // prettier-ignore
  const positions = new Float32Array([
    0, 0, 0, width, 0, 0, width, 10, 0, 0, 10, 0,
    0, 0, 5, width, 0, 5, width, 10, 5, 0, 10, 5,
  ]);
  // prettier-ignore
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ]);
  return {
    name: `box-${width}`,
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 12,
    sizeMm: { x: width, y: 10, z: 5 },
    outlines: [
      [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: 10 },
        { x: 0, y: 10 },
      ],
    ],
  };
}

function imprint(i: number, meshId: string, width: number): Cutout {
  return {
    id: `cutout-${i}`,
    shape: 'mesh',
    meshId,
    x: 0,
    y: 0,
    width,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}

function design(assets: readonly MeshAsset[]): BinParams {
  const meshAssets: Record<string, MeshAsset> = {};
  const cutouts = assets.map((asset, i) => {
    meshAssets[`asset-${i}`] = asset;
    return imprint(i, `asset-${i}`, asset.sizeMm.x);
  });
  return { ...DEFAULT_BIN_PARAMS, style: 'solid', cutouts, meshAssets };
}

async function decodes(params: BinParams): Promise<number> {
  vi.mocked(decodeMeshEntry).mockClear();
  await prepareMeshImprints(params, module);
  return vi.mocked(decodeMeshEntry).mock.calls.length;
}

describe('prepareMeshImprints cache', () => {
  let boxes: MeshAsset[];

  beforeAll(async () => {
    boxes = await Promise.all(Array.from({ length: 20 }, (_, i) => boxAsset(10 + i)));
  });

  beforeEach(() => {
    clearMeshImprintCache();
  });

  afterAll(() => {
    clearMeshImprintCache();
  });

  it('keeps every tool a design needs when it holds more meshes than the cache', async () => {
    const big = design(boxes);
    expect(await decodes(big)).toBe(boxes.length);
    expect(await decodes(big)).toBe(0);
  }, 60_000);

  it('shrinks back to its usual size once a smaller design is prepared', async () => {
    const big = design(boxes);
    await decodes(big);
    await decodes(design(boxes.slice(0, 1)));
    expect(await decodes(big)).toBe(boxes.length - 16);
  }, 60_000);

  it('decodes the same bytes again under a different declared count', async () => {
    const box = boxes[0];
    expect(await decodes(design([box]))).toBe(1);
    expect(await decodes(design([{ ...box, triangleCount: box.triangleCount - 1 }]))).toBe(1);
    const understated = await vi.mocked(decodeMeshEntry).mock.results[0].value;
    expect(understated && isErr(understated)).toBe(true);
  }, 60_000);
});
