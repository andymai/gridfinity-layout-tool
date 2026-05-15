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
 * The `origin` field on each face group is the FeatureTag set via
 * `setShapeOrigin` on the source shape (see `collectOrigins`). Origins
 * propagate through fuses/cuts/transforms, so faces in the final solid still
 * report the tag of whichever feature shape contributed them. A `0` origin
 * means brepjs returned the default — treat it as UNKNOWN to avoid silently
 * coloring untagged faces with FeatureTag.BASE (which also happens to be 0).
 *
 * @param meshResult brepjs mesh with indexed vertices/normals/triangles
 * @param originToTag unused; retained for call-site compatibility
 */
export function toIndexedMeshData(
  meshResult: {
    vertices: ArrayLike<number>;
    normals: ArrayLike<number>;
    triangles: ArrayLike<number>;
    faceGroups?: ReadonlyArray<{ start: number; count: number; faceId: number; origin?: number }>;
  },
  edgeVertices?: ArrayLike<number>,
  _originToTag?: ReadonlyMap<number, number>
): MeshData {
  const faceGroups = meshResult.faceGroups?.map((g) => ({
    start: g.start,
    count: g.count,
    tag: g.origin !== undefined && g.origin !== 0 ? g.origin : 255, // FeatureTag.UNKNOWN
  }));

  const toFloat32Array = (data: ArrayLike<number>): Float32Array =>
    data instanceof Float32Array ? data : new Float32Array(data);

  const toUint32Array = (data: ArrayLike<number>): Uint32Array =>
    data instanceof Uint32Array ? data : new Uint32Array(data);

  return {
    vertices: toFloat32Array(meshResult.vertices),
    normals: toFloat32Array(meshResult.normals),
    indices: toUint32Array(meshResult.triangles),
    edgeVertices: edgeVertices ? toFloat32Array(edgeVertices) : new Float32Array(0),
    triangleCount: meshResult.triangles.length / 3,
    faceGroups,
  };
}
