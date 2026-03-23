/**
 * Mesh conversion utilities for the generation pipeline.
 *
 * Converts brepjs mesh data to the indexed MeshData format
 * used by the Three.js renderer.
 */

import type { MeshData } from '../../../bridge/types';

/**
 * Convert brepjs indexed mesh to our MeshData format, keeping indexed representation.
 *
 * @param meshResult brepjs mesh with indexed vertices/normals/triangles
 * @param skipNormals If true, returns empty normals array (GPU will compute flat shading)
 */
export function toIndexedMeshData(
  meshResult: {
    vertices: ArrayLike<number>;
    normals: ArrayLike<number>;
    triangles: ArrayLike<number>;
    faceGroups?: ReadonlyArray<{ start: number; count: number; faceId: number; origin?: number }>;
  },
  skipNormals = false,
  edgeVertices?: ArrayLike<number>,
  originToTag?: ReadonlyMap<number, number>
): MeshData {
  const faceGroups = meshResult.faceGroups?.map((g) => ({
    start: g.start,
    count: g.count,
    tag: (g.origin !== undefined ? originToTag?.get(g.origin) : undefined) ?? 255, // FeatureTag.UNKNOWN
  }));

  const toFloat32Array = (data: ArrayLike<number>): Float32Array =>
    data instanceof Float32Array ? data : new Float32Array(data);

  const toUint32Array = (data: ArrayLike<number>): Uint32Array =>
    data instanceof Uint32Array ? data : new Uint32Array(data);

  return {
    vertices: toFloat32Array(meshResult.vertices),
    normals: skipNormals ? new Float32Array(0) : toFloat32Array(meshResult.normals),
    indices: toUint32Array(meshResult.triangles),
    edgeVertices: edgeVertices ? toFloat32Array(edgeVertices) : new Float32Array(0),
    triangleCount: meshResult.triangles.length / 3,
    faceGroups,
  };
}
