import { describe, it, expect } from 'vitest';
import { mergeShapeMeshes } from './mesh';

interface ShapeMesh {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  triangles: Uint32Array;
  faceGroups: { start: number; count: number; faceId: number; origin: number }[];
}

/** One triangle with `vc` vertices. */
function tri(vc: number, origin: number): ShapeMesh {
  return {
    vertices: new Float32Array(vc * 3).fill(1),
    normals: new Float32Array(vc * 3).fill(0),
    uvs: new Float32Array(vc * 2).fill(0.5),
    triangles: new Uint32Array(Array.from({ length: vc }, (_, i) => i)),
    faceGroups: [{ start: 0, count: vc, faceId: 0, origin }],
  };
}

describe('mergeShapeMeshes', () => {
  it('concatenates vertices/normals/uvs and shifts socket triangle indices', () => {
    const body = tri(3, 1); // 3 verts, indices [0,1,2]
    const socket = tri(3, 3); // 3 verts, indices [0,1,2]
    const merged = mergeShapeMeshes(body, socket);

    expect(merged.vertices.length).toBe(18); // (3+3) verts * 3
    expect(merged.uvs.length).toBe(12); // (3+3) verts * 2
    // socket indices shifted past the body's 3 vertices
    expect([...merged.triangles]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('offsets socket face-group starts past the body index range and preserves origins', () => {
    const body = tri(3, 1);
    const socket = tri(3, 3);
    const merged = mergeShapeMeshes(body, socket);

    expect(merged.faceGroups).toHaveLength(2);
    expect(merged.faceGroups[0]).toMatchObject({ start: 0, origin: 1 });
    // socket group starts after the body's 3 indices
    expect(merged.faceGroups[1]).toMatchObject({ start: 3, origin: 3 });
  });
});
