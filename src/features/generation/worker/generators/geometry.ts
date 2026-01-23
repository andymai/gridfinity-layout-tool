/**
 * Low-level geometry utilities for mesh generation.
 *
 * Produces triangle meshes as flat Float32Array buffers (vertices + normals).
 * All geometry is in mm, origin at center-bottom of bin.
 */

import type { MeshData } from '../../bridge/types';

/**
 * Creates a box mesh (12 triangles = 6 faces * 2 tris each).
 * Origin at min corner (x, y, z).
 */
export function createBox(
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number
): MeshData {
  const x2 = x + width;
  const y2 = y + depth;
  const z2 = z + height;

  // 6 faces * 2 triangles * 3 vertices * 3 components = 108 floats
  const vertices = new Float32Array(108);
  const normals = new Float32Array(108);

  let vi = 0;

  // Helper to add a triangle with a given normal
  const tri = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    nx: number, ny: number, nz: number
  ) => {
    vertices[vi] = ax; vertices[vi + 1] = ay; vertices[vi + 2] = az;
    vertices[vi + 3] = bx; vertices[vi + 4] = by; vertices[vi + 5] = bz;
    vertices[vi + 6] = cx; vertices[vi + 7] = cy; vertices[vi + 8] = cz;
    normals[vi] = nx; normals[vi + 1] = ny; normals[vi + 2] = nz;
    normals[vi + 3] = nx; normals[vi + 4] = ny; normals[vi + 5] = nz;
    normals[vi + 6] = nx; normals[vi + 7] = ny; normals[vi + 8] = nz;
    vi += 9;
  };

  // Front face (y = y, normal -Y)
  tri(x, y, z, x2, y, z, x2, y, z2, 0, -1, 0);
  tri(x, y, z, x2, y, z2, x, y, z2, 0, -1, 0);

  // Back face (y = y2, normal +Y)
  tri(x2, y2, z, x, y2, z, x, y2, z2, 0, 1, 0);
  tri(x2, y2, z, x, y2, z2, x2, y2, z2, 0, 1, 0);

  // Left face (x = x, normal -X)
  tri(x, y2, z, x, y, z, x, y, z2, -1, 0, 0);
  tri(x, y2, z, x, y, z2, x, y2, z2, -1, 0, 0);

  // Right face (x = x2, normal +X)
  tri(x2, y, z, x2, y2, z, x2, y2, z2, 1, 0, 0);
  tri(x2, y, z, x2, y2, z2, x2, y, z2, 1, 0, 0);

  // Bottom face (z = z, normal -Z)
  tri(x, y2, z, x2, y2, z, x2, y, z, 0, 0, -1);
  tri(x, y2, z, x2, y, z, x, y, z, 0, 0, -1);

  // Top face (z = z2, normal +Z)
  tri(x, y, z2, x2, y, z2, x2, y2, z2, 0, 0, 1);
  tri(x, y, z2, x2, y2, z2, x, y2, z2, 0, 0, 1);

  return { vertices, normals, triangleCount: 12 };
}

/**
 * Creates a hollow box (outer shell with inner cavity removed).
 * This produces 5 outer faces (no bottom) + 5 inner faces + bottom ring.
 *
 * For simplicity in Alpha, we construct this as separate boxes for
 * the 4 walls + bottom plate, rather than a single manifold mesh.
 */
export function createHollowBox(
  outerWidth: number,
  outerDepth: number,
  outerHeight: number,
  wallThickness: number,
  bottomThickness: number
): MeshData {
  const meshes: MeshData[] = [];

  // Center the bin on X/Y, bottom at Z=0
  const halfW = outerWidth / 2;
  const halfD = outerDepth / 2;

  // Bottom plate (full width/depth, bottomThickness tall)
  meshes.push(createBox(-halfW, -halfD, 0, outerWidth, outerDepth, bottomThickness));

  // Inner cavity dimensions
  const innerW = outerWidth - 2 * wallThickness;
  const innerD = outerDepth - 2 * wallThickness;
  const wallHeight = outerHeight - bottomThickness;

  if (innerW <= 0 || innerD <= 0 || wallHeight <= 0) {
    // Solid block - no cavity fits
    return createBox(-halfW, -halfD, 0, outerWidth, outerDepth, outerHeight);
  }

  const innerHalfD = innerD / 2;

  // Front wall (Y = -halfD to -halfD + wallThickness, full width)
  meshes.push(createBox(-halfW, -halfD, bottomThickness, outerWidth, wallThickness, wallHeight));

  // Back wall (Y = halfD - wallThickness to halfD, full width)
  meshes.push(createBox(-halfW, halfD - wallThickness, bottomThickness, outerWidth, wallThickness, wallHeight));

  // Left wall (X = -halfW to -halfW + wallThickness, inner depth only to avoid overlap with front/back)
  meshes.push(createBox(-halfW, -innerHalfD, bottomThickness, wallThickness, innerD, wallHeight));

  // Right wall (X = halfW - wallThickness to halfW, inner depth only)
  meshes.push(createBox(halfW - wallThickness, -innerHalfD, bottomThickness, wallThickness, innerD, wallHeight));

  return mergeMeshes(meshes);
}

/**
 * Creates a vertical wall divider (thin box) for compartment separation.
 */
export function createDividerWall(
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number
): MeshData {
  return createBox(x, y, z, width, depth, height);
}

/**
 * Creates a simple cylinder approximation using N-sided prism.
 * Used for magnet holes and screw holes.
 * Cylinder aligned along Z axis, centered at (cx, cy), from z to z+height.
 */
export function createCylinder(
  cx: number,
  cy: number,
  z: number,
  radius: number,
  height: number,
  segments: number = 16
): MeshData {
  // Each segment: 2 triangles for side, 1 triangle for top cap, 1 for bottom cap
  const triangleCount = segments * 4;
  const vertices = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  let vi = 0;

  const z2 = z + height;

  const setVertex = (vx: number, vy: number, vz: number, nx: number, ny: number, nz: number) => {
    vertices[vi] = vx;
    vertices[vi + 1] = vy;
    vertices[vi + 2] = vz;
    normals[vi] = nx;
    normals[vi + 1] = ny;
    normals[vi + 2] = nz;
    vi += 3;
  };

  for (let i = 0; i < segments; i++) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;

    const x1 = cx + Math.cos(angle1) * radius;
    const y1 = cy + Math.sin(angle1) * radius;
    const x2 = cx + Math.cos(angle2) * radius;
    const y2 = cy + Math.sin(angle2) * radius;

    const nx1 = Math.cos(angle1);
    const ny1 = Math.sin(angle1);
    const nx2 = Math.cos(angle2);
    const ny2 = Math.sin(angle2);

    // Side face - two triangles
    // Triangle 1: bottom-left, bottom-right, top-right
    setVertex(x1, y1, z, nx1, ny1, 0);
    setVertex(x2, y2, z, nx2, ny2, 0);
    setVertex(x2, y2, z2, nx2, ny2, 0);

    // Triangle 2: bottom-left, top-right, top-left
    setVertex(x1, y1, z, nx1, ny1, 0);
    setVertex(x2, y2, z2, nx2, ny2, 0);
    setVertex(x1, y1, z2, nx1, ny1, 0);

    // Top cap triangle (fan from center)
    setVertex(cx, cy, z2, 0, 0, 1);
    setVertex(x1, y1, z2, 0, 0, 1);
    setVertex(x2, y2, z2, 0, 0, 1);

    // Bottom cap triangle (fan from center, reversed winding)
    setVertex(cx, cy, z, 0, 0, -1);
    setVertex(x2, y2, z, 0, 0, -1);
    setVertex(x1, y1, z, 0, 0, -1);
  }

  return { vertices, normals, triangleCount };
}

/**
 * Merges multiple meshes into a single buffer.
 * Simple concatenation of vertex/normal arrays.
 */
export function mergeMeshes(meshes: MeshData[]): MeshData {
  if (meshes.length === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };
  }
  if (meshes.length === 1) {
    return meshes[0];
  }

  let totalFloats = 0;
  let totalTriangles = 0;
  for (const mesh of meshes) {
    totalFloats += mesh.vertices.length;
    totalTriangles += mesh.triangleCount;
  }

  const vertices = new Float32Array(totalFloats);
  const normals = new Float32Array(totalFloats);

  let offset = 0;
  for (const mesh of meshes) {
    vertices.set(mesh.vertices, offset);
    normals.set(mesh.normals, offset);
    offset += mesh.vertices.length;
  }

  return { vertices, normals, triangleCount: totalTriangles };
}
