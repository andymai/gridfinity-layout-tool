import type { MeshData } from '../../../bridge/types';

/**
 * Convert brepjs indexed mesh to our MeshData format. Each face group's
 * `origin` is the FeatureTag stamped by `collectOrigins`/`setShapeOrigin` and
 * propagated through booleans. Origin `0` is brepjs's default for untagged
 * faces and must map to UNKNOWN — FeatureTag.BASE also equals 0, so we lose
 * the distinction between "tagged BASE" and "untagged" by design.
 *
 * `_originToTag` is unused; kept positionally so callers don't churn.
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
