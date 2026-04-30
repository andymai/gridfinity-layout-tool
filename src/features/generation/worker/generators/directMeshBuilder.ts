/**
 * MeshBuilder for direct procedural mesh generation.
 *
 * Accumulates positions, normals, and triangle indices that the various add*
 * helpers append to. The final `build()` materializes typed arrays for
 * `MeshData`.
 */

import type { MeshData } from '../../bridge/types';

/** Line segments per rounded-corner quarter-arc. */
export const CORNER_SEGMENTS = 8;

/** Segments per magnet hole circle. */
export const CIRCLE_SEGMENTS = 16;

/** Z offset for cancel-faces to avoid z-fighting. */
export const CANCEL_EPSILON = 0.05;

export class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly norms: number[] = [];
  private readonly idx: number[] = [];

  /** Add a vertex with position and normal. Returns the vertex index. */
  pushVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    const index = this.positions.length / 3;
    this.positions.push(x, y, z);
    this.norms.push(nx, ny, nz);
    return index;
  }

  /** Add a triangle by 3 vertex indices (CCW winding from outside). */
  pushTriangle(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /**
   * Add a quad by 4 vertex indices (CCW winding from outside).
   * Vertices must be in order: a-b-c-d forming a planar quad.
   * Splits into triangles (a,b,c) and (a,c,d).
   */
  pushQuad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c, a, c, d);
  }

  /**
   * Add a flat-shaded triangle with computed face normal.
   * Duplicates vertices so each triangle has its own normal.
   */
  pushFlatTriangle(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
  ): void {
    const [nx, ny, nz] = faceNormal(x0, y0, z0, x1, y1, z1, x2, y2, z2);
    const a = this.pushVertex(x0, y0, z0, nx, ny, nz);
    const b = this.pushVertex(x1, y1, z1, nx, ny, nz);
    const c = this.pushVertex(x2, y2, z2, nx, ny, nz);
    this.pushTriangle(a, b, c);
  }

  /**
   * Add a flat-shaded quad (4 corners, CCW winding from outside).
   * Duplicates vertices for flat shading.
   */
  pushFlatQuad(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    x3: number,
    y3: number,
    z3: number
  ): void {
    const [nx, ny, nz] = faceNormal(x0, y0, z0, x1, y1, z1, x2, y2, z2);
    const a = this.pushVertex(x0, y0, z0, nx, ny, nz);
    const b = this.pushVertex(x1, y1, z1, nx, ny, nz);
    const c = this.pushVertex(x2, y2, z2, nx, ny, nz);
    const d = this.pushVertex(x3, y3, z3, nx, ny, nz);
    this.pushQuad(a, b, c, d);
  }

  /** Build the final MeshData. */
  build(): MeshData {
    return {
      vertices: new Float32Array(this.positions),
      normals: new Float32Array(this.norms),
      indices: new Uint32Array(this.idx),
      edgeVertices: new Float32Array(0),
      triangleCount: this.idx.length / 3,
    };
  }
}

/** Compute face normal for a CCW triangle. */
export function faceNormal(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
): [number, number, number] {
  const ex = x1 - x0,
    ey = y1 - y0,
    ez = z1 - z0;
  const fx = x2 - x0,
    fy = y2 - y0,
    fz = z2 - z0;
  const nx = ey * fz - ez * fy;
  const ny = ez * fx - ex * fz;
  const nz = ex * fy - ey * fx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Compute two orthogonal tangent vectors for an axis-aligned normal.
 * Returns [ux,uy,uz, vx,vy,vz] such that u × v = (nx, ny, 0),
 * ensuring correct cylinder winding for both positive and negative normals.
 */
export function tangentVectors(
  nx: number,
  ny: number
): [number, number, number, number, number, number] {
  if (Math.abs(nx) > 0.9) {
    const s = Math.sign(nx);
    return [0, s, 0, 0, 0, 1]; // u=±Y, v=Z → u×v aligns with nx
  }
  if (Math.abs(ny) > 0.9) {
    const s = Math.sign(ny);
    return [-s, 0, 0, 0, 0, 1]; // u=∓X, v=Z → u×v = (0, s, 0) aligns with ny
  }
  return [1, 0, 0, 0, 1, 0]; // Normal along Z (fallback)
}
