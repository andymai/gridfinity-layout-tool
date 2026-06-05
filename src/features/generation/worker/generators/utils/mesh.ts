import type { MeshData } from '../../../bridge/types';

interface FaceGroup {
  start: number;
  count: number;
  faceId: number;
  origin: number;
}
interface ShapeMesh {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  triangles: Uint32Array;
  faceGroups: FaceGroup[];
}

export function concatFloat32(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Concatenate two tessellations into one. Used to render the deferred base
 * socket alongside the bin body without a boolean fuse: the socket's triangle
 * indices are shifted past the body's vertices, and its face groups past the
 * body's index range, so the merged mesh draws (and colors) identically to a
 * fused shell. `faceGroups.start`/`count` index the triangle (index) array.
 */
export function mergeShapeMeshes(body: ShapeMesh, socket: ShapeMesh): ShapeMesh {
  const bodyVertexCount = body.vertices.length / 3;
  const bodyIndexCount = body.triangles.length;
  const triangles = new Uint32Array(bodyIndexCount + socket.triangles.length);
  triangles.set(body.triangles, 0);
  for (let i = 0; i < socket.triangles.length; i++) {
    triangles[bodyIndexCount + i] = socket.triangles[i] + bodyVertexCount;
  }
  return {
    vertices: concatFloat32(body.vertices, socket.vertices),
    normals: concatFloat32(body.normals, socket.normals),
    uvs: concatFloat32(body.uvs, socket.uvs),
    triangles,
    faceGroups: [
      ...body.faceGroups,
      ...socket.faceGroups.map((g) => ({ ...g, start: g.start + bodyIndexCount })),
    ],
  };
}

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
