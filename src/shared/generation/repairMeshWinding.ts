/**
 * Mesh winding repair via BFS flood-fill.
 *
 * Some brepjs/OCCT BREP construction paths emit tessellated meshes whose face
 * orientations aren't consistent with each other — adjacent triangles sharing
 * an edge can both emit it as the same directed edge (u→v), instead of one
 * emitting u→v and the other v→u. Slicers (Bambu Studio, Cura) interpret this
 * as "non-manifold edges" and either reject the file or repair it as solid
 * infill. See issue #1490 for the user-visible symptom.
 *
 * The standard topological cleanup is a BFS:
 *   1. Pick a seed triangle whose orientation is known correct (here: the
 *      triangle with the strongest +z normal at the maximum z, i.e. on the
 *      top face of an upright slab).
 *   2. Walk edge-adjacent neighbors. For each neighbor sharing a directed
 *      edge u→v that already exists in the visited side, the neighbor is
 *      wound backwards — swap two of its vertex indices to flip it.
 *   3. After propagation, compute signed volume; if negative, the seed
 *      assumption was wrong and every triangle is inverted — flip the whole
 *      mesh as a global correction.
 *
 * Non-manifold edges (boundary, or shared by ≥3 triangles) are skipped with
 * a warning so genuinely defective input doesn't crash the export pipeline.
 *
 * Pure function: vertices are unchanged; the returned `Uint32Array` is a
 * fresh copy of the input with vertex order corrected per triangle.
 *
 * Reusable for any flat-indexed triangle mesh (vertex stride 3, tri stride 3).
 * Currently only wired into baseplate STL export; bins/dividers use the same
 * brepjs meshing path and can adopt this if the same symptom surfaces there.
 *
 * **Status (issue #1494):** as of brepjs 15.6.1 + OCCT kernel, this repair is
 * a no-op for every known piece config — the corner-3/corner-4/edge-x-1
 * scenario tests pass with the repair disabled, and the
 * `__dual-kernel__/diagnoseBaseplateWinding` step-walker shows
 * `triangles-flipped=0` even on the 13×9 magnet+lightweight reproducer that
 * originally motivated this code. Kept as a defensive net for any future
 * regression in brepjs/OCCT tessellation: if a downstream version reintroduces
 * the inconsistency, this pass will silently absorb it before the user sees
 * Bambu Studio errors.
 */

import { createLogger } from '@/core/logger';

const logger = createLogger('repairMeshWinding');

/**
 * Repair triangle winding so every directed edge appears at most once and
 * the (global) signed volume is positive.
 *
 * BFS-walks every triangle starting from the global "best" seed (top-face
 * triangle with strongest +z normal). Meshes whose connectivity graph is
 * disconnected — either truly multi-component or because brepjs emits
 * per-face vertex ranges with no index sharing across face boundaries —
 * are still fully walked: any unvisited triangle after the first BFS
 * spawns a new BFS pass, so no triangle is left unflipped if it needed to
 * be.
 *
 * The signed-volume safety net is applied **globally**, not per-component.
 * For brepjs's per-face-indexed output, individual face components have
 * meaningless or near-zero volume contributions (e.g., a flat z=0 face
 * contributes exactly 0); a per-component flip would mis-decide those
 * cases. The global integral aggregates contributions across all faces,
 * giving a reliable signal of whether the whole mesh is inverted.
 *
 * @param vertices Flat XYZ array (length = vertexCount * 3).
 * @param triangles Flat indexed-triangle array (length = triangleCount * 3).
 * @returns A new triangle array of the same length with corrected winding.
 */
export function repairMeshWinding(
  vertices: ArrayLike<number>,
  triangles: ArrayLike<number>
): Uint32Array {
  if (triangles.length % 3 !== 0) {
    throw new Error(
      `repairMeshWinding: triangles.length=${triangles.length} is not a multiple of 3`
    );
  }

  const triCount = triangles.length / 3;
  const out = new Uint32Array(triangles.length);
  for (let i = 0; i < triangles.length; i++) {
    out[i] = triangles[i];
  }

  if (triCount === 0) return out;

  // Build undirected-edge → triangle-indices map.
  const edgeMap = new Map<number, number[]>();
  for (let t = 0; t < triCount; t++) {
    const a = out[t * 3];
    const b = out[t * 3 + 1];
    const c = out[t * 3 + 2];
    addEdge(edgeMap, a, b, t);
    addEdge(edgeMap, b, c, t);
    addEdge(edgeMap, c, a, t);
  }

  const visited = new Uint8Array(triCount);
  let nonManifoldEdges = 0;
  const recordNonManifold = (n: number): void => {
    nonManifoldEdges += n;
  };

  // First BFS uses the global best seed (top-face strongest +z). Subsequent
  // BFS passes pick up any triangles not reachable from the first seed
  // (multi-component meshes, or brepjs per-face-indexed output where faces
  // don't share vertex indices across their boundaries).
  const firstSeed = findSeedTriangle(vertices, out, triCount);
  bfsComponent(out, edgeMap, visited, firstSeed, recordNonManifold);
  for (let t = 0; t < triCount; t++) {
    if (visited[t]) continue;
    bfsComponent(out, edgeMap, visited, t, recordNonManifold);
  }

  // Global safety net: if the seed itself was wound backwards (e.g., the
  // entire top face was inverted, leading BFS to propagate the wrong
  // direction everywhere), the global signed volume is negative — flip all
  // triangles. Per-component flipping would mis-decide individual flat
  // faces whose volume contribution is near zero.
  if (signedVolume(vertices, out, triCount) < 0) {
    for (let t = 0; t < triCount; t++) {
      const tmp = out[t * 3 + 1];
      out[t * 3 + 1] = out[t * 3 + 2];
      out[t * 3 + 2] = tmp;
    }
  }

  if (nonManifoldEdges > 0) {
    logger.warn('Skipped non-manifold edges during winding repair', {
      nonManifoldEdges,
      triangleCount: triCount,
    });
  }

  return out;
}

/**
 * BFS-walk one connected component starting from `seed`. Uses a head-pointer
 * queue (O(n) total dequeues) instead of Array.shift (which is O(n) each).
 * Flips any neighbor whose shared-edge direction matches the visited side's.
 *
 * @returns The list of triangle indices visited in this component.
 */
function bfsComponent(
  out: Uint32Array,
  edgeMap: Map<number, number[]>,
  visited: Uint8Array,
  seed: number,
  recordNonManifold: (n: number) => void
): void {
  const queue: number[] = [seed];
  visited[seed] = 1;
  let head = 0;
  let nonManifold = 0;

  while (head < queue.length) {
    const t = queue[head++];
    const a = out[t * 3];
    const b = out[t * 3 + 1];
    const c = out[t * 3 + 2];

    nonManifold += processEdge(out, edgeMap, visited, queue, t, a, b);
    nonManifold += processEdge(out, edgeMap, visited, queue, t, b, c);
    nonManifold += processEdge(out, edgeMap, visited, queue, t, c, a);
  }

  recordNonManifold(nonManifold);
}

function edgeKey(u: number, v: number): number {
  // Pack (min, max) into a single 53-bit safe integer key.
  // Vertex counts in this codebase are well under 2^26, so this fits.
  const lo = u < v ? u : v;
  const hi = u < v ? v : u;
  return lo * 0x4000000 + hi;
}

function addEdge(map: Map<number, number[]>, u: number, v: number, t: number): void {
  const key = edgeKey(u, v);
  const list = map.get(key);
  if (list === undefined) {
    map.set(key, [t]);
  } else {
    list.push(t);
  }
}

/**
 * Process one directed edge of triangle `t`. If the neighbor across this edge
 * hasn't been visited, mark it visited, flip it if its shared-edge direction
 * matches `t`'s (same direction = inconsistent), and enqueue.
 *
 * @returns 1 if the edge is non-manifold (boundary or ≥3 triangles), else 0.
 */
function processEdge(
  out: Uint32Array,
  edgeMap: Map<number, number[]>,
  visited: Uint8Array,
  queue: number[],
  t: number,
  u: number,
  v: number
): number {
  const neighbors = edgeMap.get(edgeKey(u, v));
  if (neighbors === undefined || neighbors.length !== 2) {
    return 1;
  }
  const other = neighbors[0] === t ? neighbors[1] : neighbors[0];
  if (visited[other]) return 0;
  visited[other] = 1;

  // If `other` also emits the directed edge u→v, its winding is inconsistent
  // with `t`'s — flip it by swapping two indices.
  const oa = out[other * 3];
  const ob = out[other * 3 + 1];
  const oc = out[other * 3 + 2];
  const sameDirection = (oa === u && ob === v) || (ob === u && oc === v) || (oc === u && oa === v);
  if (sameDirection) {
    out[other * 3 + 1] = oc;
    out[other * 3 + 2] = ob;
  }

  queue.push(other);
  return 0;
}

/**
 * Pick a seed triangle whose outward direction we can guess: the triangle
 * with the strongest +z component of its (current-winding) face normal among
 * triangles whose vertices all sit at the maximum-z plane.
 *
 * Falls back to triangle 0 if no such candidate exists.
 */
function findSeedTriangle(
  vertices: ArrayLike<number>,
  triangles: Uint32Array,
  triCount: number
): number {
  // First pass: find max z across all vertices.
  let maxZ = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > maxZ) maxZ = vertices[i];
  }

  let bestIdx = 0;
  let bestNz = -Infinity;
  const eps = 1e-6;
  for (let t = 0; t < triCount; t++) {
    const a = triangles[t * 3];
    const b = triangles[t * 3 + 1];
    const c = triangles[t * 3 + 2];
    const az = vertices[a * 3 + 2];
    const bz = vertices[b * 3 + 2];
    const cz = vertices[c * 3 + 2];
    if (Math.abs(az - maxZ) > eps || Math.abs(bz - maxZ) > eps || Math.abs(cz - maxZ) > eps) {
      continue;
    }
    const nz = triangleNormalZ(vertices, a, b, c);
    if (nz > bestNz) {
      bestNz = nz;
      bestIdx = t;
    }
  }
  return bestIdx;
}

function triangleNormalZ(vertices: ArrayLike<number>, a: number, b: number, c: number): number {
  const ax = vertices[a * 3];
  const ay = vertices[a * 3 + 1];
  const bx = vertices[b * 3];
  const by = vertices[b * 3 + 1];
  const cx = vertices[c * 3];
  const cy = vertices[c * 3 + 1];
  const ex = bx - ax;
  const ey = by - ay;
  const fx = cx - ax;
  const fy = cy - ay;
  return ex * fy - ey * fx;
}

function signedVolume(
  vertices: ArrayLike<number>,
  triangles: Uint32Array,
  triCount: number
): number {
  let vol = 0;
  for (let t = 0; t < triCount; t++) {
    const a = triangles[t * 3];
    const b = triangles[t * 3 + 1];
    const c = triangles[t * 3 + 2];
    const ax = vertices[a * 3];
    const ay = vertices[a * 3 + 1];
    const az = vertices[a * 3 + 2];
    const bx = vertices[b * 3];
    const by = vertices[b * 3 + 1];
    const bz = vertices[b * 3 + 2];
    const cx = vertices[c * 3];
    const cy = vertices[c * 3 + 1];
    const cz = vertices[c * 3 + 2];
    vol += ax * (by * cz - bz * cy) + bx * (cy * az - cz * ay) + cx * (ay * bz - az * by);
  }
  return vol / 6;
}
