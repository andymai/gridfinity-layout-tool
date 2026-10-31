import type { StackMeshArrays } from './stackPrint';

/** Turn about the grid origin; preserve triangle winding and rotate normals/edges. */
export function rotateMeshInPlane(
  mesh: StackMeshArrays,
  rotationDeg: 90 | 180 | 270
): StackMeshArrays {
  const turn = (array: Float32Array): Float32Array => {
    const out = new Float32Array(array);
    for (let i = 0; i < out.length; i += 3) {
      const x = array[i];
      const y = array[i + 1];
      out[i] = rotationDeg === 90 ? -y : rotationDeg === 180 ? -x : y;
      out[i + 1] = rotationDeg === 90 ? x : rotationDeg === 180 ? -y : -x;
    }
    return out;
  };
  return {
    vertices: turn(mesh.vertices),
    normals: turn(mesh.normals),
    indices: new Uint32Array(mesh.indices),
    edgeVertices: turn(mesh.edgeVertices),
  };
}
