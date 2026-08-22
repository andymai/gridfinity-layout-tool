/**
 * Pure geometry for the 3D measuring tool (#3696).
 *
 * Works directly on the worker's mesh arrays rather than on a Three.js object,
 * so the picking, the snapping and the thickness probe are all testable without
 * a renderer, and so the tool adds nothing to the preview scene. That second
 * point is not cosmetic: `exportPreviewGlb` merges every visible `Mesh` it
 * walks, so an off-scene copy of the bin kept purely for raycasting would end
 * up in published community models.
 *
 * Snapping targets CREASE EDGES, not tessellation edges. `generation.mesh
 * .edgeVertices` is the worker's dihedral crease set, which is exactly the
 * model's real edges, so a corner of a compartment divider is a snap target
 * while the arbitrary diagonal across a flat wall is not. It also means
 * divider snapping needs no separate model: dividers are part of the solid, so
 * their edges are already in there.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** What a snapped point landed on. Vertex beats edge beats bare surface. */
export type MeasureSnapKind = 'vertex' | 'edge' | 'surface';

export interface MeasurePoint extends Vec3 {
  readonly kind: MeasureSnapKind;
}

export interface MeasureResult {
  /** Straight-line distance in mm. */
  readonly distance: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

export interface TriangleHit {
  readonly point: Vec3;
  /** Distance along the ray from its origin. */
  readonly distance: number;
  /** Unit face normal, oriented by winding (not flipped toward the ray). */
  readonly normal: Vec3;
}

/** Rays that start exactly on a surface re-hit the triangle they left. */
const RAY_EPSILON_MM = 1e-4;

/** Denominator below which a ray is treated as parallel to the triangle. */
const PARALLEL_EPSILON = 1e-12;

export function measureBetween(a: Vec3, b: Vec3): MeasureResult {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return { distance: Math.sqrt(dx * dx + dy * dy + dz * dz), dx, dy, dz };
}

/** Nearest point on segment [a, b] to p, clamped to the segment's ends. */
export function nearestPointOnSegment3(p: Vec3, a: Vec3, b: Vec3): Vec3 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq === 0) return a;
  const t = Math.min(
    1,
    Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / lenSq)
  );
  return { x: a.x + t * dx, y: a.y + t * dy, z: a.z + t * dz };
}

function distanceSq(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Snap a raw surface hit onto the model's crease edges.
 *
 * Resolved by KIND first and distance second: an endpoint inside the tolerance
 * always wins over a nearer spot along an edge. Without that a corner would be
 * unreachable, since every point of an edge is zero distance from that edge and
 * the two edges meeting at a corner would each swallow it.
 *
 * `edgeVertices` is the flat `[ax,ay,az, bx,by,bz, ...]` segment list the
 * worker ships. A null or short array leaves the hit unsnapped rather than
 * failing, which is what a draft mesh mid-generation looks like.
 */
export function snapToCreaseEdges(
  hit: Vec3,
  edgeVertices: Float32Array | null,
  toleranceMm: number
): MeasurePoint {
  const free: MeasurePoint = { ...hit, kind: 'surface' };
  if (!edgeVertices || edgeVertices.length < 6 || toleranceMm <= 0) return free;

  const tolSq = toleranceMm * toleranceMm;
  let bestVertex: Vec3 | null = null;
  let bestVertexSq = tolSq;
  let bestEdge: Vec3 | null = null;
  let bestEdgeSq = tolSq;

  for (let i = 0; i + 5 < edgeVertices.length; i += 6) {
    const a: Vec3 = { x: edgeVertices[i], y: edgeVertices[i + 1], z: edgeVertices[i + 2] };
    const b: Vec3 = { x: edgeVertices[i + 3], y: edgeVertices[i + 4], z: edgeVertices[i + 5] };

    const da = distanceSq(hit, a);
    if (da < bestVertexSq) {
      bestVertexSq = da;
      bestVertex = a;
    }
    const db = distanceSq(hit, b);
    if (db < bestVertexSq) {
      bestVertexSq = db;
      bestVertex = b;
    }

    // Skip the projection once a vertex is already in range: the loop still has
    // to run for the remaining endpoints, but the segment work is the
    // expensive half and it cannot change the answer.
    if (bestVertex === null) {
      const p = nearestPointOnSegment3(hit, a, b);
      const dp = distanceSq(hit, p);
      if (dp < bestEdgeSq) {
        bestEdgeSq = dp;
        bestEdge = p;
      }
    }
  }

  if (bestVertex) return { ...bestVertex, kind: 'vertex' };
  if (bestEdge) return { ...bestEdge, kind: 'edge' };
  return free;
}

/**
 * Nearest ray/triangle intersection over a whole mesh, Möller-Trumbore.
 *
 * Two-sided deliberately: the thickness probe fires from inside the material
 * and has to register the far wall, which a front-facing test would cull. That
 * also means the primary pick can hit an interior face through an opening,
 * which is correct for measuring a cavity.
 *
 * `minDistance` skips the surface a ray was launched from. Pass
 * {@link RAY_EPSILON_MM} or more whenever the origin sits on the mesh.
 */
export function raycastTriangles(
  origin: Vec3,
  direction: Vec3,
  vertices: Float32Array | null,
  indices: Uint32Array | Uint16Array | null,
  minDistance = 0
): TriangleHit | null {
  if (!vertices || vertices.length < 9) return null;

  const triangleCount = indices ? indices.length / 3 : vertices.length / 9;
  let best: TriangleHit | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let t = 0; t < triangleCount; t++) {
    const i0 = (indices ? indices[t * 3] : t * 3) * 3;
    const i1 = (indices ? indices[t * 3 + 1] : t * 3 + 1) * 3;
    const i2 = (indices ? indices[t * 3 + 2] : t * 3 + 2) * 3;

    const e1x = vertices[i1] - vertices[i0];
    const e1y = vertices[i1 + 1] - vertices[i0 + 1];
    const e1z = vertices[i1 + 2] - vertices[i0 + 2];
    const e2x = vertices[i2] - vertices[i0];
    const e2y = vertices[i2 + 1] - vertices[i0 + 1];
    const e2z = vertices[i2 + 2] - vertices[i0 + 2];

    const px = direction.y * e2z - direction.z * e2y;
    const py = direction.z * e2x - direction.x * e2z;
    const pz = direction.x * e2y - direction.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -PARALLEL_EPSILON && det < PARALLEL_EPSILON) continue;

    const invDet = 1 / det;
    const tx = origin.x - vertices[i0];
    const ty = origin.y - vertices[i0 + 1];
    const tz = origin.z - vertices[i0 + 2];

    const u = (tx * px + ty * py + tz * pz) * invDet;
    if (u < 0 || u > 1) continue;

    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;

    const v = (direction.x * qx + direction.y * qy + direction.z * qz) * invDet;
    if (v < 0 || u + v > 1) continue;

    const distance = (e2x * qx + e2y * qy + e2z * qz) * invDet;
    if (distance <= minDistance || distance >= bestDistance) continue;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const nLen = Math.hypot(nx, ny, nz) || 1;

    bestDistance = distance;
    best = {
      point: {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
        z: origin.z + direction.z * distance,
      },
      distance,
      normal: { x: nx / nLen, y: ny / nLen, z: nz / nLen },
    };
  }

  return best;
}

/**
 * Wall thickness at a surface hit: fire into the material along the inward
 * normal and take the far surface.
 *
 * Returns `null` when the ray leaves without hitting anything, which is a real
 * answer rather than a failure: it means the pick was on a face with nothing
 * behind it along its own normal, so there is no thickness to report.
 */
export function probeThickness(
  hit: Vec3,
  faceNormal: Vec3,
  viewDirection: Vec3,
  vertices: Float32Array | null,
  indices: Uint32Array | Uint16Array | null
): { readonly from: MeasurePoint; readonly to: MeasurePoint; readonly thickness: number } | null {
  // Winding does not tell us which side the camera is on, so orient the normal
  // against the view ray: the surface we clicked faces the camera by
  // definition, and "into the material" is the other way.
  const facing =
    faceNormal.x * viewDirection.x +
    faceNormal.y * viewDirection.y +
    faceNormal.z * viewDirection.z;
  const sign = facing > 0 ? 1 : -1;
  const inward: Vec3 = { x: faceNormal.x * sign, y: faceNormal.y * sign, z: faceNormal.z * sign };

  const far = raycastTriangles(hit, inward, vertices, indices, RAY_EPSILON_MM);
  if (!far) return null;

  return {
    from: { ...hit, kind: 'surface' },
    to: { ...far.point, kind: 'surface' },
    thickness: far.distance,
  };
}
