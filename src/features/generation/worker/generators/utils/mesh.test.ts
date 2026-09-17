import { describe, it, expect } from 'vitest';
import { mergeMeshData } from './mesh';
import type { MeshData } from '../../../bridge/types';

/** One triangle with `vc` vertices, tagged `tag`, with one edge segment. */
function tri(vc: number, tag: number, edgeValue: number): MeshData {
  return {
    vertices: new Float32Array(vc * 3).fill(1),
    normals: new Float32Array(vc * 3).fill(0),
    indices: new Uint32Array(Array.from({ length: vc }, (_, i) => i)),
    edgeVertices: new Float32Array(6).fill(edgeValue),
    triangleCount: vc / 3,
    faceGroups: [{ start: 0, count: vc, tag }],
  };
}

describe('mergeMeshData', () => {
  it('concatenates vertices/normals/edges and shifts socket indices', () => {
    const body = tri(3, 1, 0);
    const socket = tri(3, 3, 9);
    const merged = mergeMeshData(body, socket);

    expect(merged.vertices.length).toBe(18);
    expect(merged.normals.length).toBe(18);
    expect([...merged.indices]).toEqual([0, 1, 2, 3, 4, 5]);
    expect(merged.triangleCount).toBe(2);
    expect([...merged.edgeVertices]).toEqual([0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9]);
  });

  it('offsets socket face-group starts past the body index range and keeps tags', () => {
    const merged = mergeMeshData(tri(3, 1, 0), tri(3, 3, 0));

    expect(merged.faceGroups).toHaveLength(2);
    expect(merged.faceGroups?.[0]).toMatchObject({ start: 0, tag: 1 });
    expect(merged.faceGroups?.[1]).toMatchObject({ start: 3, tag: 3 });
  });

  it('leaves faceGroups undefined when neither side has any', () => {
    const { faceGroups: _b, ...body } = tri(3, 1, 0);
    const { faceGroups: _s, ...socket } = tri(3, 3, 0);
    expect(mergeMeshData(body, socket).faceGroups).toBeUndefined();
  });
});
