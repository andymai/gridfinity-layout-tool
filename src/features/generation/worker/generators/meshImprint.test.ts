// @vitest-environment node
/**
 * Real-WASM tests for mesh imprint subtraction: occt builds the bin, the raw
 * manifold module (fs-instantiated) carves the imported pockets.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { setManifoldModuleForTests } from '../manifoldRuntime';
import { prepareMeshImprints, hasMeshImprints, clearMeshImprintCache } from './meshImprint';
import { importMeshFromStl } from './meshImport';
import { buildSTLBuffer } from '@/shared/generation/export';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { isOk } from '@/core/result';
import { SOCKET_HEIGHT } from './generatorConstants';
import { deriveDimensions } from './pipeline/context';
import { CUTOUT_COLOR_TAG_BASE } from '@/shared/generation/cutoutColorUnits';

let module: ManifoldToplevel;
let toolAsset: MeshAsset;

/** Triangle soup for an axis-aligned box with outward CCW winding. */
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
  faces.forEach((face, f) => {
    face.forEach((vi, v) => soup.set(c[vi], f * 9 + v * 3));
  });
  return soup;
}

beforeAll(async () => {
  await initBrepjs();
  const ManifoldModule = (await import('manifold-3d')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmBinary = readFileSync(join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
  module = await ManifoldModule({ wasmBinary } as unknown as { locateFile: () => string });
  module.setup();
  setManifoldModuleForTests(module);

  const imported = await importMeshFromStl(
    buildSTLBuffer(boxSoup(20, 10, 5), new Float32Array(boxSoup(20, 10, 5).length), 'tool'),
    'tool.stl',
    undefined,
    module
  );
  if (!isOk(imported)) throw new Error(`fixture import failed: ${imported.error.message}`);
  toolAsset = imported.value.asset;
}, 120_000);

function meshCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'mesh-1',
    shape: 'mesh',
    meshId: 'asset-1',
    x: 10,
    y: 10,
    width: toolAsset.sizeMm.x,
    depth: toolAsset.sizeMm.y,
    cutDepth: toolAsset.sizeMm.z,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function solidBinParams(cutouts: Cutout[], meshAssets?: Record<string, MeshAsset>): BinParams {
  return buildParams({
    width: 2,
    depth: 2,
    height: 5,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts,
    meshAssets: meshAssets ?? { 'asset-1': toolAsset },
  });
}

/**
 * Deepest Z among triangle CENTROIDS inside the given world-XY rectangle.
 * Centroids (not vertices) because a large flat face tessellates with
 * vertices only at its corners, which can all fall outside an inset region.
 */
function minZInRegion(
  mesh: { vertices: Float32Array; indices: Uint32Array },
  region: { minX: number; maxX: number; minY: number; maxY: number }
): number {
  const { vertices, indices } = mesh;
  let minZ = Infinity;
  for (let t = 0; t < indices.length; t += 3) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let k = 0; k < 3; k++) {
      const v = indices[t + k];
      cx += vertices[v * 3] / 3;
      cy += vertices[v * 3 + 1] / 3;
      cz += vertices[v * 3 + 2] / 3;
    }
    if (cx > region.minX && cx < region.maxX && cy > region.minY && cy < region.maxY) {
      minZ = Math.min(minZ, cz);
    }
  }
  return minZ;
}

describe('mesh imprint generation (occt + manifold)', () => {
  it('carves a contoured pocket into a solid bin end-to-end', async () => {
    const params = solidBinParams([meshCutout()]);
    expect(hasMeshImprints(params)).toBe(true);
    await prepareMeshImprints(params, module);

    const generate = getGenerateBin();
    const plain = generate(solidBinParams([]), undefined, true);
    const imprinted = generate(params, undefined, true);

    expect(imprinted.triangleCount).toBeGreaterThan(0);
    expect(Array.from(imprinted.vertices).every(Number.isFinite)).toBe(true);
    expect(Array.from(imprinted.normals).every(Number.isFinite)).toBe(true);
    expect(imprinted.indices.length % 3).toBe(0);
    // The pocket adds wall + floor geometry the plain bin doesn't have.
    expect(imprinted.triangleCount).not.toBe(plain.triangleCount);

    // Pocket floor: inside the footprint the surface drops by cutDepth from
    // the solid top. Solid bin: interior top = SOCKET_HEIGHT + wallHeight.
    const { innerW, innerD, wallHeight } = deriveDimensions(params, true);
    const solidTop = SOCKET_HEIGHT + wallHeight;
    const region = {
      minX: -innerW / 2 + 10 + 4,
      maxX: -innerW / 2 + 10 + toolAsset.sizeMm.x - 4,
      minY: -innerD / 2 + 10 + 3,
      maxY: -innerD / 2 + 10 + toolAsset.sizeMm.y - 3,
    };
    const pocketFloor = minZInRegion(imprinted, region);
    expect(pocketFloor).toBeLessThan(solidTop - toolAsset.sizeMm.z + 0.5);

    // The result is still a closed manifold (slicers accept it).
    const check = new module.Mesh({
      numProp: 3,
      vertProperties: imprinted.vertices,
      triVerts: imprinted.indices,
    });
    check.merge();
    const solidCheck = new module.Manifold(check);
    expect(solidCheck.numTri()).toBeGreaterThan(0);
    solidCheck.delete();
  }, 120_000);

  it('applies XY clearance to the pocket opening', async () => {
    const tight = solidBinParams([meshCutout()]);
    const loose = solidBinParams([meshCutout({ clearance: 1.5 })]);
    await prepareMeshImprints(tight, module);
    const generate = getGenerateBin();

    const tightMesh = generate(tight, undefined, true);
    const looseMesh = generate(loose, undefined, true);

    const { innerD, wallHeight } = deriveDimensions(tight, true);
    const solidTop = SOCKET_HEIGHT + wallHeight;
    // Compare pocket FLOOR extents (vertices sit on the floor plane at
    // zBottom; a box pocket has no intermediate-z wall vertices), along the
    // cutout's Y midline: the loose floor reaches `clearance` further out.
    const yMid = -innerD / 2 + 10 + toolAsset.sizeMm.y / 2;
    const zFloor = solidTop - toolAsset.sizeMm.z;
    const pocketMaxX = (mesh: { vertices: Float32Array }): number => {
      let maxX = -Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const z = mesh.vertices[i + 2];
        const y = mesh.vertices[i + 1];
        if (Math.abs(z - zFloor) < 0.3 && Math.abs(y - yMid) < toolAsset.sizeMm.y / 2 + 2) {
          maxX = Math.max(maxX, mesh.vertices[i]);
        }
      }
      return maxX;
    };
    const tightMax = pocketMaxX(tightMesh);
    const looseMax = pocketMaxX(looseMesh);
    expect(Number.isFinite(tightMax)).toBe(true);
    expect(looseMax).toBeGreaterThan(tightMax + 1.0);
    expect(looseMax).toBeLessThan(tightMax + 2.0);
  }, 120_000);

  it('skips hidden mesh cutouts', async () => {
    const params = solidBinParams([meshCutout({ hidden: true })]);
    expect(hasMeshImprints(params)).toBe(false);
    const generate = getGenerateBin();
    const withHidden = generate(params, undefined, true);
    const plain = generate(solidBinParams([]), undefined, true);
    expect(withHidden.triangleCount).toBe(plain.triangleCount);
  }, 120_000);

  it('falls back to a flat outline pocket when the asset is corrupt', async () => {
    clearMeshImprintCache();
    const corrupt: MeshAsset = { ...toolAsset, data: 'bm90IGEgbWVzaA==' };
    const params = solidBinParams([meshCutout()], { 'asset-1': corrupt });
    await prepareMeshImprints(params, module);
    const generate = getGenerateBin();

    const imprinted = generate(params, undefined, true);
    const plain = generate(solidBinParams([]), undefined, true);
    // Still cuts a (flat) pocket from the silhouette outline.
    expect(imprinted.triangleCount).not.toBe(plain.triangleCount);

    // Restore the good asset for any later tests.
    clearMeshImprintCache();
    await prepareMeshImprints(solidBinParams([meshCutout()]), module);
  }, 120_000);

  it('tags tool-carved faces with the cutout color tag', async () => {
    const params = solidBinParams([meshCutout({ color: '#ef4444', colorScope: 'floorAndWalls' })]);
    await prepareMeshImprints(params, module);
    const imprinted = getGenerateBin()(params, undefined, true);

    const tags = new Set((imprinted.faceGroups ?? []).map((g) => g.tag));
    // First colorable unit → ordinal 0 → CUTOUT_COLOR_TAG_BASE.
    expect(tags.has(CUTOUT_COLOR_TAG_BASE)).toBe(true);
    // Tagged ranges must stay within bounds and 3-aligned.
    for (const g of imprinted.faceGroups ?? []) {
      expect(g.start % 3).toBe(0);
      expect(g.count % 3).toBe(0);
      expect(g.start + g.count).toBeLessThanOrEqual(imprinted.indices.length);
    }
  }, 120_000);

  it('expands parametric arrays into one pocket per instance', async () => {
    const arrayCutout = meshCutout({
      x: 5,
      y: 5,
      array: {
        mode: 'grid',
        cols: 2,
        rows: 1,
        pitchX: 30,
        pitchY: 20,
        count: 1,
        radius: 10,
        startAngle: 0,
        rotateToCenter: false,
      },
    });
    const params = solidBinParams([arrayCutout]);
    await prepareMeshImprints(params, module);
    const generate = getGenerateBin();
    const imprinted = generate(params, undefined, true);

    const { innerW, innerD, wallHeight } = deriveDimensions(params, true);
    const solidTop = SOCKET_HEIGHT + wallHeight;
    for (const instanceX of [5, 35]) {
      const region = {
        minX: -innerW / 2 + instanceX + 4,
        maxX: -innerW / 2 + instanceX + toolAsset.sizeMm.x - 4,
        minY: -innerD / 2 + 5 + 3,
        maxY: -innerD / 2 + 5 + toolAsset.sizeMm.y - 3,
      };
      expect(minZInRegion(imprinted, region)).toBeLessThan(solidTop - toolAsset.sizeMm.z + 0.5);
    }
  }, 120_000);
});
