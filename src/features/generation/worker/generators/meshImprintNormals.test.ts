import { describe, it, expect } from 'vitest';
import { computeCreaseNormals } from './meshImprintNormals';

/** All output normals are finite unit vectors. */
function assertUnitNormals(normals: Float32Array): void {
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    expect(Number.isFinite(len)).toBe(true);
    expect(len).toBeCloseTo(1, 4);
  }
}

describe('computeCreaseNormals', () => {
  it('gives a flat quad one smooth up-normal', () => {
    // Two coplanar triangles (z=0 plane) sharing the diagonal edge.
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
    const out = computeCreaseNormals(positions, indices);
    // Coplanar → no vertex splitting: same vertex count.
    expect(out.positions.length).toBe(positions.length);
    assertUnitNormals(out.normals);
    for (let i = 0; i < out.normals.length; i += 3) {
      expect(out.normals[i + 2]).toBeCloseTo(1, 4); // all +Z
    }
  });

  it('splits vertices across a sharp crease so each face keeps its own normal', () => {
    // A 90° fold: one triangle in z=0, one standing up in y=0, sharing edge 0-1.
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1]);
    const indices = new Uint32Array([0, 1, 2, 0, 3, 1]);
    const out = computeCreaseNormals(positions, indices);
    // Shared vertices 0 and 1 belong to two crease-separated clusters → the
    // output has more vertices than the 4 inputs.
    expect(out.positions.length).toBeGreaterThan(positions.length);
    assertUnitNormals(out.normals);
    // The two faces point in clearly different directions (+Z vs -Y).
    const dirs = new Set<string>();
    for (let i = 0; i < out.normals.length; i += 3) {
      dirs.add(
        `${Math.round(out.normals[i])},${Math.round(out.normals[i + 1])},${Math.round(out.normals[i + 2])}`
      );
    }
    expect(dirs.size).toBeGreaterThanOrEqual(2);
  });
});
