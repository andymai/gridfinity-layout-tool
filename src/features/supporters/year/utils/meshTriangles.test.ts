import { describe, expect, it } from 'vitest';
import type { MeshData } from '@/shared/types/generation';
import { meshTriangles } from './meshTriangles';

function mesh(triangleCount: number, extra: Partial<MeshData> = {}): MeshData {
  return {
    vertices: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    edgeVertices: new Float32Array(0),
    triangleCount,
    ...extra,
  };
}

describe('meshTriangles', () => {
  it('counts the body alone', () => {
    expect(meshTriangles(mesh(1200))).toBe(1200);
  });

  it('adds the separate parts but not the coarse copy', () => {
    const total = meshTriangles(
      mesh(1000, {
        detachableFeetMesh: mesh(200),
        knifeRestMesh: mesh(50),
        coarseLOD: {
          vertices: new Float32Array(0),
          indices: new Uint32Array(0),
          triangleCount: 999,
        } as unknown as MeshData['coarseLOD'],
      })
    );
    expect(total).toBe(1250);
  });
});
