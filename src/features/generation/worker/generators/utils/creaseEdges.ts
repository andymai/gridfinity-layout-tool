/**
 * Dihedral crease-edge extractor for build-time (manifold) draft meshes.
 *
 * Manifold has no B-rep topology and its meshEdges() returns the full triangle
 * wireframe. This recovers OCCT-style feature edges from the mesh alone:
 * weld vertices by position (manifold may split them at face boundaries), then
 * emit a segment wherever two adjacent triangles' face normals diverge past the
 * crease threshold — plus any naked boundary edge. Sub-threshold folds (curve
 * facets) stay smooth, so curves render as clean rims, not wireframe.
 */

import { CREASE_ANGLE_DEG } from '@/shared/constants/tessellation';

export interface CreaseEdgeMesh {
  readonly vertices: ArrayLike<number>;
  readonly triangles: ArrayLike<number>;
}

/** Weld resolution: 1e-4 model units (sub-micron at mm scale). */
const WELD_SCALE = 1e4;

export function creaseEdges(
  mesh: CreaseEdgeMesh,
  thresholdDeg: number = CREASE_ANGLE_DEG
): Float32Array {
  const { vertices, triangles } = mesh;
  const triCount = Math.floor(triangles.length / 3);
  if (triCount === 0) return new Float32Array(0);

  const vertCount = Math.floor(vertices.length / 3);

  // 1. Weld vertices by quantized position → stable welded id per position.
  const weld = new Map<string, number>();
  const remap = new Int32Array(vertCount);
  const idToVert: number[] = [];
  const q = (n: number): number => Math.round(n * WELD_SCALE);
  for (let v = 0; v < vertCount; v++) {
    const key = `${q(vertices[v * 3])},${q(vertices[v * 3 + 1])},${q(vertices[v * 3 + 2])}`;
    let id = weld.get(key);
    if (id === undefined) {
      id = weld.size;
      weld.set(key, id);
      idToVert[id] = v;
    }
    remap[v] = id;
  }

  // 2. Per-triangle face normals from original positions.
  const faceNormals = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const a = triangles[t * 3];
    const b = triangles[t * 3 + 1];
    const c = triangles[t * 3 + 2];
    const ax = vertices[a * 3];
    const ay = vertices[a * 3 + 1];
    const az = vertices[a * 3 + 2];
    const ux = vertices[b * 3] - ax;
    const uy = vertices[b * 3 + 1] - ay;
    const uz = vertices[b * 3 + 2] - az;
    const vx = vertices[c * 3] - ax;
    const vy = vertices[c * 3 + 1] - ay;
    const vz = vertices[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    faceNormals[t * 3] = nx / len;
    faceNormals[t * 3 + 1] = ny / len;
    faceNormals[t * 3 + 2] = nz / len;
  }

  // 3. Edge (welded id pair) → adjacent triangle indices.
  const size = weld.size;
  const edgeMap = new Map<number, number[]>();
  const edgeKey = (i: number, j: number): number => {
    const lo = i < j ? i : j;
    const hi = i < j ? j : i;
    return lo * size + hi;
  };
  const addEdge = (i: number, j: number, t: number): void => {
    const key = edgeKey(i, j);
    const arr = edgeMap.get(key);
    if (arr) arr.push(t);
    else edgeMap.set(key, [t]);
  };
  for (let t = 0; t < triCount; t++) {
    const a = remap[triangles[t * 3]];
    const b = remap[triangles[t * 3 + 1]];
    const c = remap[triangles[t * 3 + 2]];
    addEdge(a, b, t);
    addEdge(b, c, t);
    addEdge(c, a, t);
  }

  // 4. Emit creases (dihedral past threshold) and naked boundary edges.
  const cosThreshold = Math.cos((thresholdDeg * Math.PI) / 180);
  const out: number[] = [];
  const pushVert = (id: number): void => {
    const v = idToVert[id];
    out.push(vertices[v * 3], vertices[v * 3 + 1], vertices[v * 3 + 2]);
  };
  for (const [key, tris] of edgeMap) {
    let emit = false;
    if (tris.length === 1) {
      emit = true; // naked boundary edge
    } else {
      for (let i = 0; i < tris.length && !emit; i++) {
        for (let j = i + 1; j < tris.length && !emit; j++) {
          const ti = tris[i] * 3;
          const tj = tris[j] * 3;
          const dot =
            faceNormals[ti] * faceNormals[tj] +
            faceNormals[ti + 1] * faceNormals[tj + 1] +
            faceNormals[ti + 2] * faceNormals[tj + 2];
          if (dot < cosThreshold) emit = true;
        }
      }
    }
    if (emit) {
      pushVert(Math.floor(key / size));
      pushVert(key % size);
    }
  }

  return new Float32Array(out);
}
