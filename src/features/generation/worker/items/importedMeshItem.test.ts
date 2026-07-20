import { beforeEach, describe, expect, it } from 'vitest';
import { unwrap } from '@/core/result';
import { encodeMeshData, MAX_MESH_ASSET_TRIANGLES } from '@/shared/generation/meshAsset';
import { parseSTL } from '@/shared/generation/stlParser';
import type { GridfinityItem, ImportedMeshStructure, ItemEnvelope } from '@/shared/types/item';

import { clearImportedMeshCache, importedMeshGeneratorModule } from './importedMeshItem';

/** 40×20×10mm tetrahedron-ish solid: 4 triangles, bbox min at origin. */
function fixtureMesh(): { positions: Float32Array; indices: Uint32Array } {
  const positions = new Float32Array([0, 0, 0, 40, 0, 0, 0, 20, 0, 0, 0, 10]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return { positions, indices };
}

async function fixtureItem(): Promise<GridfinityItem> {
  const { positions, indices } = fixtureMesh();
  const data = unwrap(await encodeMeshData(positions, indices));
  const structure: ImportedMeshStructure = {
    kind: 'importedMesh',
    heightUnits: 2,
    asset: {
      name: 'fixture_bin',
      data,
      triangleCount: indices.length / 3,
      sizeMm: { x: 40, y: 20, z: 10 },
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 0, y: 20 },
        ],
      ],
    },
  };
  const envelope = { width: 1, depth: 1, gridUnitMm: 42, heightUnitMm: 7 } as ItemEnvelope;
  return { envelope, structure };
}

describe('importedMeshGeneratorModule', () => {
  beforeEach(() => {
    clearImportedMeshCache();
  });

  it('generate() throws when prepare() has not run', async () => {
    const item = await fixtureItem();
    expect(() => importedMeshGeneratorModule.generate(item, () => {}, false)).toThrow(
      /not prepared/
    );
  });

  it('prepare() + generate() emits a centered, finite mesh', async () => {
    const item = await fixtureItem();
    await importedMeshGeneratorModule.prepare?.(item);
    const mesh = importedMeshGeneratorModule.generate(item, () => {}, false);

    expect(mesh.triangleCount).toBe(4);
    expect(mesh.triangleCount).toBeLessThanOrEqual(MAX_MESH_ASSET_TRIANGLES);
    expect(mesh.indices).toHaveLength(12);
    expect(mesh.vertices).toHaveLength(12);
    for (const v of mesh.vertices) expect(Number.isFinite(v)).toBe(true);

    // Stored frame has bbox min at (0,0,0); preview frame is XY-centered
    // with Z untouched: X spans [-20, 20], Y spans [-10, 10], Z from 0.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      minX = Math.min(minX, mesh.vertices[i]);
      maxX = Math.max(maxX, mesh.vertices[i]);
      minY = Math.min(minY, mesh.vertices[i + 1]);
      maxY = Math.max(maxY, mesh.vertices[i + 1]);
      minZ = Math.min(minZ, mesh.vertices[i + 2]);
    }
    expect(minX).toBeCloseTo(-20, 1);
    expect(maxX).toBeCloseTo(20, 1);
    expect(minY).toBeCloseTo(-10, 1);
    expect(maxY).toBeCloseTo(10, 1);
    expect(minZ).toBeCloseTo(0, 1);
  });

  it('generate() does not mutate the cached decode across calls', async () => {
    const item = await fixtureItem();
    await importedMeshGeneratorModule.prepare?.(item);
    const first = importedMeshGeneratorModule.generate(item, () => {}, false);
    const second = importedMeshGeneratorModule.generate(item, () => {}, false);
    expect(second.vertices).toEqual(first.vertices);
    expect(second.vertices).not.toBe(first.vertices);
  });

  it('export() rejects STEP with an actionable message', async () => {
    const item = await fixtureItem();
    await expect(importedMeshGeneratorModule.export(item, 'step')).rejects.toThrow(/STL or 3MF/);
  });

  it('export() produces a parseable binary STL in the stored (plate) frame', async () => {
    const item = await fixtureItem();
    const result = await importedMeshGeneratorModule.export(item, 'stl');
    expect(result.fileName).toBe('fixture_bin.stl');

    const parsed = unwrap(parseSTL(result.data));
    expect(parsed.vertices.length / 9).toBe(4);
    // Exported STL keeps bbox min at the origin (bottom on the build plate).
    let minZ = Infinity;
    for (let i = 2; i < parsed.vertices.length; i += 3) {
      minZ = Math.min(minZ, parsed.vertices[i]);
    }
    expect(minZ).toBeCloseTo(0, 2);
  });

  it('prepare() surfaces a decode failure as a thrown error', async () => {
    const item = await fixtureItem();
    const broken: GridfinityItem = {
      envelope: item.envelope,
      structure: {
        ...(item.structure as ImportedMeshStructure),
        asset: { ...(item.structure as ImportedMeshStructure).asset, data: 'not-gma1' },
      },
    };
    await expect(importedMeshGeneratorModule.prepare?.(broken)).rejects.toThrow(/decode/i);
  });
});
