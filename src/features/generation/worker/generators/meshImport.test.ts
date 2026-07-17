/**
 * Real-WASM tests for the STL → MeshAsset import pipeline. Instantiates the
 * raw manifold-3d module from node_modules (the worker's fetch-based loader
 * can't run in node) and injects it via the moduleOverride parameter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { importMeshFromStl } from './meshImport';
import {
  decodeMeshData,
  MAX_MESH_ASSET_TRIANGLES,
  MAX_MESH_FILE_BYTES,
} from '@/shared/generation/meshAsset';
import type { MeshOutlinePoint } from '@/shared/generation/meshAsset';
import { buildSTLBuffer } from '@/shared/generation/export';
import { isOk, isErr, unwrap } from '@/core/result';

let module: ManifoldToplevel;

beforeAll(async () => {
  const ManifoldModule = (await import('manifold-3d')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmBinary = readFileSync(join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
  module = await ManifoldModule({ wasmBinary } as unknown as { locateFile: () => string });
  module.setup();
});

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
    [0, 3, 2], // bottom (-z)
    [4, 5, 6],
    [4, 6, 7], // top (+z)
    [0, 1, 5],
    [0, 5, 4], // front (-y)
    [2, 3, 7],
    [2, 7, 6], // back (+y)
    [0, 4, 7],
    [0, 7, 3], // left (-x)
    [1, 2, 6],
    [1, 6, 5], // right (+x)
  ];
  const soup = new Float32Array(faces.length * 9);
  faces.forEach((face, f) => {
    face.forEach((vi, v) => soup.set(c[vi], f * 9 + v * 3));
  });
  return soup;
}

function soupToBinarySTL(soup: Float32Array): ArrayBuffer {
  return buildSTLBuffer(soup, new Float32Array(soup.length), 'fixture');
}

function soupToAsciiSTL(soup: Float32Array): ArrayBuffer {
  let text = 'solid fixture\n';
  for (let t = 0; t < soup.length / 9; t++) {
    text += 'facet normal 0 0 0\n outer loop\n';
    for (let v = 0; v < 3; v++) {
      const i = t * 9 + v * 3;
      text += `  vertex ${soup[i]} ${soup[i + 1]} ${soup[i + 2]}\n`;
    }
    text += ' endloop\nendfacet\n';
  }
  text += 'endsolid fixture\n';
  const encoded = new TextEncoder().encode(text);
  return encoded.buffer.slice(0, encoded.byteLength);
}

function ringArea(ring: ReadonlyArray<MeshOutlinePoint>): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2);
}

describe('importMeshFromStl', () => {
  it('imports a watertight binary box end-to-end', async () => {
    const result = await importMeshFromStl(
      soupToBinarySTL(boxSoup(20, 10, 5)),
      'Wrench Holder.stl',
      undefined,
      module
    );
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const { asset, positions, indices, suggestedCutDepth } = result.value;

    expect(asset.name).toBe('Wrench Holder');
    expect(asset.triangleCount).toBe(12);
    expect(asset.sizeMm.x).toBeCloseTo(20, 3);
    expect(asset.sizeMm.y).toBeCloseTo(10, 3);
    expect(asset.sizeMm.z).toBeCloseTo(5, 3);
    expect(suggestedCutDepth).toBeCloseTo(5, 3);

    expect(asset.outlines).toHaveLength(1);
    expect(ringArea(asset.outlines[0])).toBeCloseTo(200, 0);

    expect(positions.length).toBeGreaterThan(0);
    expect(indices.length).toBe(36);
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
    // Origin-normalized: bbox min at (0,0,0)
    let minX = Infinity;
    let minZ = Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      minZ = Math.min(minZ, positions[i + 2]);
    }
    expect(minX).toBeCloseTo(0, 4);
    expect(minZ).toBeCloseTo(0, 4);
  });

  it('lays a standing box flat (min height orientation)', async () => {
    const result = await importMeshFromStl(
      soupToBinarySTL(boxSoup(5, 10, 20)),
      'standing.stl',
      undefined,
      module
    );
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const { sizeMm } = result.value.asset;
    expect(sizeMm.z).toBeCloseTo(5, 3);
    const footprint = [sizeMm.x, sizeMm.y].sort((a, b) => a - b);
    expect(footprint[0]).toBeCloseTo(10, 3);
    expect(footprint[1]).toBeCloseTo(20, 3);
  });

  it('applies quarter-turn flips after lay-flat', async () => {
    const result = await importMeshFromStl(
      soupToBinarySTL(boxSoup(20, 10, 5)),
      'flipped.stl',
      { x: 1, y: 0, z: 0 },
      module
    );
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    // 90° about X swaps the lay-flat Y (10) into Z
    expect(result.value.asset.sizeMm.z).toBeCloseTo(10, 3);
    expect(result.value.suggestedCutDepth).toBeCloseTo(10, 3);
  });

  it('imports ASCII STL through the same pipeline', async () => {
    const result = await importMeshFromStl(
      soupToAsciiSTL(boxSoup(20, 10, 5)),
      'ascii.stl',
      undefined,
      module
    );
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.asset.triangleCount).toBe(12);
    expect(result.value.asset.sizeMm.z).toBeCloseTo(5, 3);
  });

  it('decodes the stored asset back to the preview geometry', async () => {
    const result = await importMeshFromStl(
      soupToBinarySTL(boxSoup(20, 10, 5)),
      'roundtrip.stl',
      undefined,
      module
    );
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const decoded = unwrap(await decodeMeshData(result.value.asset.data));
    expect(decoded.indices).toEqual(result.value.indices);
    expect(decoded.positions).toHaveLength(result.value.positions.length);
    for (let i = 0; i < decoded.positions.length; i++) {
      expect(Math.abs(decoded.positions[i] - result.value.positions[i])).toBeLessThan(0.01);
    }
  });

  it('decimates a high-resolution mesh to the triangle budget', async () => {
    // Generate a ~65k-triangle sphere with manifold itself, then round-trip
    // it through STL as the "user upload"
    const sphere = module.Manifold.sphere(20, 360);
    try {
      const mesh = sphere.getMesh();
      const soup = new Float32Array(mesh.triVerts.length * 3);
      for (let i = 0; i < mesh.triVerts.length; i++) {
        const vi = mesh.triVerts[i];
        soup[i * 3] = mesh.vertProperties[vi * mesh.numProp];
        soup[i * 3 + 1] = mesh.vertProperties[vi * mesh.numProp + 1];
        soup[i * 3 + 2] = mesh.vertProperties[vi * mesh.numProp + 2];
      }
      expect(mesh.triVerts.length / 3).toBeGreaterThan(MAX_MESH_ASSET_TRIANGLES);

      const result = await importMeshFromStl(
        soupToBinarySTL(soup),
        'sphere.stl',
        undefined,
        module
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.asset.triangleCount).toBeLessThanOrEqual(MAX_MESH_ASSET_TRIANGLES);
      expect(result.value.asset.triangleCount).toBeGreaterThan(0);
      expect(result.value.asset.sizeMm.x).toBeCloseTo(40, 0);
      expect(result.value.asset.sizeMm.z).toBeCloseTo(40, 0);
    } finally {
      sphere.delete();
    }
  }, 60_000);

  it('rejects a non-watertight mesh with a repair hint', async () => {
    // Box soup missing one triangle: an open hole merge() cannot fix
    const soup = boxSoup(20, 10, 5).slice(0, 11 * 9);
    const result = await importMeshFromStl(
      soupToBinarySTL(new Float32Array(soup)),
      'holey.stl',
      undefined,
      module
    );
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.reason).toBe('not_manifold');
    expect(result.error.message).toMatch(/repair/i);
  });

  it('rejects garbage buffers as parse failures', async () => {
    const junk = new TextEncoder().encode('this is not an stl file').buffer;
    const result = await importMeshFromStl(junk, 'junk.stl', undefined, module);
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.reason).toBe('parse_failed');
  });

  it('rejects oversized files before parsing', async () => {
    const oversized = new ArrayBuffer(MAX_MESH_FILE_BYTES + 1);
    const result = await importMeshFromStl(oversized, 'huge.stl', undefined, module);
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.reason).toBe('too_large');
  });
});
