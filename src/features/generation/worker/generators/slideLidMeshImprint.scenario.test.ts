// @vitest-environment node
/**
 * A mesh imprint beside a sliding lid's channel.
 *
 * Imprints subtract in the mesh domain after the channel is fused, and a tool
 * taller than its pocket rises well past the fill. Measured as a delta against
 * the same bin without the imprint, so a surface the channel always had cannot
 * pass for one the imprint spared.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ManifoldToplevel } from 'manifold-3d';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { buildSTLBuffer } from '@/shared/generation/export';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { isOk } from '@/core/result';
import { DEFAULT_LID_SLIDE_CONFIG } from '@/features/bin-designer/types/lid';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { slideLidFillOffsetMm } from '@/features/bin-designer/utils/slideLidPlanForParams';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { columnCrossings } from './__kernel-tests__/meshAssertions';
import { binWallTopZ } from './__kernel-tests__/slideLidSeating';
import { setManifoldModuleForTests } from '../manifoldRuntime';
import { prepareMeshImprints } from './meshImprint';
import { importMeshFromStl } from './meshImport';

let module: ManifoldToplevel;
let tallTool: MeshAsset | undefined;

/** Triangle soup for an axis-aligned box with outward winding. */
function boxSoup(w: number, d: number, h: number): Float32Array {
  const c = [
    [0, 0, 0],
    [w, 0, 0],
    [w, d, 0],
    [0, d, 0],
    [0, 0, h],
    [w, 0, h],
    [w, d, h],
    [0, d, h],
  ];
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [2, 3, 7],
    [2, 7, 6],
    [0, 4, 7],
    [0, 7, 3],
    [1, 2, 6],
    [1, 6, 5],
  ];
  const soup = new Float32Array(faces.length * 9);
  faces.forEach((face, f) => face.forEach((vi, v) => soup.set(c[vi], f * 9 + v * 3)));
  return soup;
}

beforeAll(async () => {
  await initBrepjs();
  const ManifoldModule = (await import('manifold-3d')).default;
  const wasmBinary = readFileSync(join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
  module = await ManifoldModule({ wasmBinary } as unknown as { locateFile: () => string });
  module.setup();
  setManifoldModuleForTests(module);

  // Import lays a mesh on its largest face; a quarter turn stands it up.
  const soup = boxSoup(6, 20, 25);
  for (const rotation of [
    { x: 90, y: 0, z: 0 },
    { x: 0, y: 90, z: 0 },
  ]) {
    const imported = await importMeshFromStl(
      buildSTLBuffer(soup, new Float32Array(soup.length), 'tool'),
      'tool.stl',
      rotation,
      module
    );
    if (!isOk(imported)) throw new Error(`fixture import failed: ${imported.error.message}`);
    if (imported.value.asset.sizeMm.z > 20) {
      tallTool = imported.value.asset;
      break;
    }
  }
}, 120_000);

function tool(): MeshAsset {
  if (!tallTool) throw new Error('expected the tool to import standing up');
  return tallTool;
}

/** Sunk 10mm against the left wall, which the front-entry channel runs along. */
function imprint(): Cutout {
  return {
    id: 'tall',
    shape: 'mesh',
    meshId: 'tool',
    x: 0,
    y: 30,
    width: tool().sizeMm.x,
    depth: tool().sizeMm.y,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}

function solidSlide(cutouts: Cutout[], topOffset: number): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 2,
    height: 5,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig, topOffset },
    meshAssets: { tool: tool() },
    cutouts,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'slide',
      slide: DEFAULT_LID_SLIDE_CONFIG,
    },
  };
}

describe('a mesh imprint beside a sliding lid channel', () => {
  it('leaves the channel standing above the fill', async () => {
    const topOffset = slideLidFillOffsetMm(solidSlide([], 0));
    if (topOffset === null) throw new Error('expected a fill that fits the channel');
    const pocket = imprint();
    const withImprint = solidSlide([pocket], topOffset);
    const without = solidSlide([], topOffset);
    await prepareMeshImprints(withImprint, module);

    const { innerW, innerD } = binDimensions(withImprint);
    // Inside the shelf's reach of the left wall, level with the imprint.
    const x = -innerW / 2 + 1.03;
    const y = pocket.y + pocket.depth / 2 - innerD / 2 + 0.17;
    const fillTopZ = binWallTopZ(withImprint) - topOffset;
    const crossings = (params: BinParams): number[] => {
      const mesh = getGenerateBin()(params, undefined, true);
      if (!mesh) throw new Error('expected the bin to build');
      return columnCrossings(mesh, x, y);
    };
    const above = (zs: number[]): number[] => zs.filter((z) => z > fillTopZ + 0.1);

    const channel = above(crossings(without));
    expect(channel.length).toBeGreaterThan(0);
    const cut = crossings(withImprint);
    const pocketFloorZ = fillTopZ - pocket.cutDepth;
    expect(cut.some((z) => Math.abs(z - pocketFloorZ) < 0.05)).toBe(true);
    const kept = above(cut);
    expect(kept.length).toBe(channel.length);
    kept.forEach((z, i) => expect(z).toBeCloseTo(channel[i], 2));
  }, 300_000);
});
