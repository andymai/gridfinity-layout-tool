import { describe, it, expect, vi } from 'vitest';
import { repairMeshWinding } from './repairMeshWinding';

/**
 * Unit cube vertices and a correctly-wound triangulation. Each face is split
 * into two triangles whose vertex order produces an outward-facing normal
 * (right-hand rule). Signed volume of this mesh equals the cube volume = 1.
 */
const CUBE_VERTS = new Float32Array([
  0,
  0,
  0, // 0
  1,
  0,
  0, // 1
  1,
  1,
  0, // 2
  0,
  1,
  0, // 3
  0,
  0,
  1, // 4
  1,
  0,
  1, // 5
  1,
  1,
  1, // 6
  0,
  1,
  1, // 7
]);

const CUBE_TRIS_CORRECT = new Uint32Array([
  // bottom (z=0, normal -z)
  0, 2, 1, 0, 3, 2,
  // top (z=1, normal +z)
  4, 5, 6, 4, 6, 7,
  // front (y=0, normal -y)
  0, 1, 5, 0, 5, 4,
  // right (x=1, normal +x)
  1, 2, 6, 1, 6, 5,
  // back (y=1, normal +y)
  2, 3, 7, 2, 7, 6,
  // left (x=0, normal -x)
  3, 0, 4, 3, 4, 7,
]);

function signedVolume(verts: ArrayLike<number>, tris: ArrayLike<number>): number {
  let vol = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const ai = tris[t] * 3;
    const bi = tris[t + 1] * 3;
    const ci = tris[t + 2] * 3;
    const ax = verts[ai];
    const ay = verts[ai + 1];
    const az = verts[ai + 2];
    const bx = verts[bi];
    const by = verts[bi + 1];
    const bz = verts[bi + 2];
    const cx = verts[ci];
    const cy = verts[ci + 1];
    const cz = verts[ci + 2];
    vol += ax * (by * cz - bz * cy) + bx * (cy * az - cz * ay) + cx * (ay * bz - az * by);
  }
  return vol / 6;
}

function countDirectedEdgeCollisions(tris: ArrayLike<number>): number {
  const seen = new Set<number>();
  let collisions = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t];
    const b = tris[t + 1];
    const c = tris[t + 2];
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const key = u * 0x4000000 + v;
      if (seen.has(key)) collisions++;
      else seen.add(key);
    }
  }
  return collisions;
}

function flipTriangle(tris: Uint32Array, t: number): Uint32Array {
  const out = new Uint32Array(tris);
  const tmp = out[t * 3 + 1];
  out[t * 3 + 1] = out[t * 3 + 2];
  out[t * 3 + 2] = tmp;
  return out;
}

describe('repairMeshWinding', () => {
  it('returns empty array for empty input', () => {
    const result = repairMeshWinding(new Float32Array(), new Uint32Array());
    expect(result.length).toBe(0);
  });

  it('leaves a correctly-wound cube unchanged', () => {
    const result = repairMeshWinding(CUBE_VERTS, CUBE_TRIS_CORRECT);
    expect(Array.from(result)).toEqual(Array.from(CUBE_TRIS_CORRECT));
    expect(signedVolume(CUBE_VERTS, result)).toBeCloseTo(1, 5);
    expect(countDirectedEdgeCollisions(result)).toBe(0);
  });

  it('repairs a single flipped triangle', () => {
    // Flip triangle at index 4 (a top-face triangle) — its directed edges now
    // collide with the adjacent top triangle's edge.
    const broken = flipTriangle(CUBE_TRIS_CORRECT, 4);
    expect(countDirectedEdgeCollisions(broken)).toBeGreaterThan(0);

    const result = repairMeshWinding(CUBE_VERTS, broken);
    expect(countDirectedEdgeCollisions(result)).toBe(0);
    expect(signedVolume(CUBE_VERTS, result)).toBeCloseTo(1, 5);
  });

  it('repairs both triangles of a flipped face via BFS propagation', () => {
    // Flip both triangles on the bottom face (indices 0 and 1).
    let broken = flipTriangle(CUBE_TRIS_CORRECT, 0);
    broken = flipTriangle(broken, 1);
    expect(countDirectedEdgeCollisions(broken)).toBeGreaterThan(0);

    const result = repairMeshWinding(CUBE_VERTS, broken);
    expect(countDirectedEdgeCollisions(result)).toBe(0);
    expect(signedVolume(CUBE_VERTS, result)).toBeCloseTo(1, 5);
  });

  it('uses signed-volume safety net when every triangle is inverted', () => {
    // Globally flip every triangle. BFS alone won't fix this — the seed's
    // own winding is wrong, so BFS propagates the wrong direction. The
    // safety net detects negative signed volume and flips the whole mesh.
    const inverted = new Uint32Array(CUBE_TRIS_CORRECT);
    for (let t = 0; t < inverted.length; t += 3) {
      const tmp = inverted[t + 1];
      inverted[t + 1] = inverted[t + 2];
      inverted[t + 2] = tmp;
    }
    expect(signedVolume(CUBE_VERTS, inverted)).toBeCloseTo(-1, 5);

    const result = repairMeshWinding(CUBE_VERTS, inverted);
    expect(signedVolume(CUBE_VERTS, result)).toBeCloseTo(1, 5);
    expect(countDirectedEdgeCollisions(result)).toBe(0);
  });

  it('does not mutate the input triangle array', () => {
    const broken = flipTriangle(CUBE_TRIS_CORRECT, 4);
    const snapshot = Array.from(broken);
    repairMeshWinding(CUBE_VERTS, broken);
    expect(Array.from(broken)).toEqual(snapshot);
  });

  it('logs a warning and returns a result when input has a boundary edge', () => {
    // Drop the last triangle to create open boundary edges. The function
    // should still return a triangle array and warn — not throw.
    const truncated = CUBE_TRIS_CORRECT.slice(0, CUBE_TRIS_CORRECT.length - 3);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => repairMeshWinding(CUBE_VERTS, truncated)).not.toThrow();
    const result = repairMeshWinding(CUBE_VERTS, truncated);
    expect(result.length).toBe(truncated.length);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('throws when triangles.length is not a multiple of 3', () => {
    const malformed = new Uint32Array([0, 1, 2, 3, 4]); // length 5
    expect(() => repairMeshWinding(CUBE_VERTS, malformed)).toThrow(/multiple of 3/);
  });

  it('walks every component so each one is internally consistent', () => {
    // Build two cubes side-by-side using disjoint vertex index ranges. The
    // mesh's edge-adjacency graph is disconnected — without per-component
    // BFS, the second cube's triangles would never be visited. With it,
    // every triangle is walked and each component is internally consistent.
    const verts2 = new Float32Array([
      // cube A (indices 0..7, x range [0,1])
      0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
      // cube B (indices 8..15, x range [2,3])
      2, 0, 0, 3, 0, 0, 3, 1, 0, 2, 1, 0, 2, 0, 1, 3, 0, 1, 3, 1, 1, 2, 1, 1,
    ]);
    const cubeATris = new Uint32Array(CUBE_TRIS_CORRECT);
    const cubeBTris = new Uint32Array(CUBE_TRIS_CORRECT.length);
    // Cube B: same topology, indices offset by 8, but with one triangle
    // flipped so this component requires repair to be internally consistent.
    for (let i = 0; i < CUBE_TRIS_CORRECT.length; i++) {
      cubeBTris[i] = CUBE_TRIS_CORRECT[i] + 8;
    }
    // Flip one cube-B triangle to introduce a within-component winding error.
    const tmp = cubeBTris[1];
    cubeBTris[1] = cubeBTris[2];
    cubeBTris[2] = tmp;

    const combined = new Uint32Array(cubeATris.length + cubeBTris.length);
    combined.set(cubeATris, 0);
    combined.set(cubeBTris, cubeATris.length);
    expect(countDirectedEdgeCollisions(combined)).toBeGreaterThan(0);

    const result = repairMeshWinding(verts2, combined);
    // BFS reaches both components; each is now internally consistent.
    expect(countDirectedEdgeCollisions(result)).toBe(0);
  });
});
