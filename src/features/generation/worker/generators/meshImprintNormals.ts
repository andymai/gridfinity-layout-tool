/**
 * Post-boolean shading normals for imprinted meshes.
 *
 * The mesh boolean (manifold-3d) returns positions and indices but no vertex
 * normals, so this rebuilds them crease-aware to match the occt tessellation's
 * visual contract (smooth curves, crisp feature edges) without relying on
 * property propagation through the boolean.
 */

import { CREASE_ANGLE_RAD } from '@/shared/constants/tessellation';

export interface NormalizedMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
}

/**
 * Area-weighted vertex normals with crease splitting: triangles around a
 * vertex are clustered by walking shared edges whose dihedral angle stays
 * under the crease threshold; each cluster gets its own smoothed normal (the
 * vertex is duplicated per extra cluster).
 */
export function computeCreaseNormals(
  positions: Float32Array,
  indices: Uint32Array
): NormalizedMesh {
  const triCount = indices.length / 3;
  const vertCount = positions.length / 3;
  const cosThreshold = Math.cos(CREASE_ANGLE_RAD);

  const faceNormals = new Float32Array(triCount * 3);
  const faceAreas = new Float32Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3];
    const b = indices[t * 3 + 1];
    const c = indices[t * 3 + 2];
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    const ux = positions[b * 3] - ax;
    const uy = positions[b * 3 + 1] - ay;
    const uz = positions[b * 3 + 2] - az;
    const vx = positions[c * 3] - ax;
    const vy = positions[c * 3 + 1] - ay;
    const vz = positions[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    faceAreas[t] = len / 2;
    if (len > 0) {
      faceNormals[t * 3] = nx / len;
      faceNormals[t * 3 + 1] = ny / len;
      faceNormals[t * 3 + 2] = nz / len;
    }
  }

  // Incident triangle corners per vertex: (tri, corner) pairs.
  const incidentCount = new Uint32Array(vertCount);
  for (let i = 0; i < indices.length; i++) incidentCount[indices[i]]++;
  const incidentStart = new Uint32Array(vertCount + 1);
  for (let v = 0; v < vertCount; v++) incidentStart[v + 1] = incidentStart[v] + incidentCount[v];
  const incident = new Uint32Array(indices.length);
  const fill = incidentStart.slice(0, vertCount);
  for (let i = 0; i < indices.length; i++) {
    incident[fill[indices[i]]++] = i;
  }

  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outIndices = new Uint32Array(indices.length);

  const smoothDot = (t1: number, t2: number): boolean =>
    faceNormals[t1 * 3] * faceNormals[t2 * 3] +
      faceNormals[t1 * 3 + 1] * faceNormals[t2 * 3 + 1] +
      faceNormals[t1 * 3 + 2] * faceNormals[t2 * 3 + 2] >=
    cosThreshold;

  for (let v = 0; v < vertCount; v++) {
    const start = incidentStart[v];
    const end = incidentStart[v + 1];
    const cornerCount = end - start;
    if (cornerCount === 0) continue;

    // Cluster incident triangles: same cluster when connected through an
    // edge at this vertex with a sub-threshold dihedral.
    const tris: number[] = [];
    for (let k = start; k < end; k++) tris.push(Math.floor(incident[k] / 3));
    const cluster = new Int32Array(cornerCount).fill(-1);
    let clusterCount = 0;
    for (let seed = 0; seed < cornerCount; seed++) {
      if (cluster[seed] !== -1) continue;
      const id = clusterCount++;
      const queue = [seed];
      cluster[seed] = id;
      while (queue.length > 0) {
        const current = queue.pop();
        if (current === undefined) break;
        const tCur = tris[current];
        for (let other = 0; other < cornerCount; other++) {
          if (cluster[other] !== -1) continue;
          const tOther = tris[other];
          if (sharesEdgeAt(indices, tCur, tOther, v) && smoothDot(tCur, tOther)) {
            cluster[other] = id;
            queue.push(other);
          }
        }
      }
    }

    // Emit one output vertex per cluster with its accumulated normal.
    const clusterVertex: number[] = new Array<number>(clusterCount);
    for (let cl = 0; cl < clusterCount; cl++) {
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (let k = 0; k < cornerCount; k++) {
        if (cluster[k] !== cl) continue;
        const t = tris[k];
        nx += faceNormals[t * 3] * faceAreas[t];
        ny += faceNormals[t * 3 + 1] * faceAreas[t];
        nz += faceNormals[t * 3 + 2] * faceAreas[t];
      }
      const len = Math.hypot(nx, ny, nz) || 1;
      const outIdx = outPositions.length / 3;
      outPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      outNormals.push(nx / len, ny / len, nz / len);
      clusterVertex[cl] = outIdx;
    }
    for (let k = 0; k < cornerCount; k++) {
      outIndices[incident[start + k]] = clusterVertex[cluster[k]];
    }
  }

  return {
    positions: Float32Array.from(outPositions),
    normals: Float32Array.from(outNormals),
    indices: outIndices,
  };
}

/** True when triangles `t1` and `t2` share an edge incident to vertex `v`. */
function sharesEdgeAt(indices: Uint32Array, t1: number, t2: number, v: number): boolean {
  if (t1 === t2) return false;
  for (let i = 0; i < 3; i++) {
    const a = indices[t1 * 3 + i];
    if (a === v) continue;
    for (let j = 0; j < 3; j++) {
      if (indices[t2 * 3 + j] === a) return true;
    }
  }
  return false;
}
