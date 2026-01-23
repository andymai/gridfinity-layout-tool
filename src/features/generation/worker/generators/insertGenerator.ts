/**
 * Insert geometry generator.
 *
 * Creates pocket walls for insert cavities on the bin floor.
 * Each insert generates a set of thin walls forming the pocket perimeter.
 * The bin floor acts as the pocket bottom (no separate floor is generated).
 */

import type { MeshData } from '../../bridge/types';
import type { Insert } from '@/features/bin-designer/types';
import { createBox, createCylinder, mergeMeshes } from './geometry';

/** Wall thickness for insert pocket perimeters (mm) */
const POCKET_WALL_THICKNESS = 1.2;

/** Segments for circular geometry (higher = smoother) */
const CIRCLE_SEGMENTS = 24;

/** Segments per side for hexagon */
const HEX_SEGMENTS = 6;

/**
 * Generate all insert pocket geometries for the bin.
 *
 * @param inserts - Array of placed inserts
 * @param innerWidth - Bin interior width (mm)
 * @param innerDepth - Bin interior depth (mm)
 * @param wallThickness - Bin wall thickness (mm)
 * @param baseHeight - Z height of bin floor (mm)
 * @param maxPocketHeight - Maximum pocket height (bin cavity height, mm)
 * @param halfW - Half outer width (for coordinate offset)
 * @param halfD - Half outer depth (for coordinate offset)
 */
export function generateInserts(
  inserts: readonly Insert[],
  _innerWidth: number,
  _innerDepth: number,
  wallThickness: number,
  baseHeight: number,
  maxPocketHeight: number,
  halfW: number,
  halfD: number
): MeshData {
  if (inserts.length === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };
  }

  const meshes: MeshData[] = [];

  for (const insert of inserts) {
    const pocketHeight = Math.min(insert.cutDepth, maxPocketHeight);
    if (pocketHeight <= 0) continue;

    // Convert insert position (relative to interior) to world coordinates
    // Interior starts at (-halfW + wallThickness, -halfD + wallThickness)
    const worldX = -halfW + wallThickness + insert.x;
    const worldY = -halfD + wallThickness + insert.y;

    const mesh = generateSingleInsert(insert, worldX, worldY, baseHeight, pocketHeight);
    if (mesh) {
      meshes.push(mesh);
    }
  }

  return mergeMeshes(meshes);
}

function generateSingleInsert(
  insert: Insert,
  worldX: number,
  worldY: number,
  baseZ: number,
  height: number
): MeshData | null {
  switch (insert.shape) {
    case 'rectangle':
    case 'slot':
      return generateRectPocket(worldX, worldY, insert.width, insert.depth, baseZ, height, insert.rotation);
    case 'circle':
      return generateCirclePocket(worldX, worldY, insert.width / 2, baseZ, height);
    case 'hexagon':
      return generateHexPocket(worldX, worldY, insert.width / 2, baseZ, height);
    case 'rounded-rect':
      return generateRoundedRectPocket(worldX, worldY, insert.width, insert.depth, insert.cornerRadius, baseZ, height, insert.rotation);
    default:
      return null;
  }
}

/**
 * Generate a rectangular pocket (4 thin walls, no floor).
 * Position is the bottom-left corner of the pocket.
 */
function generateRectPocket(
  x: number,
  y: number,
  width: number,
  depth: number,
  z: number,
  height: number,
  rotation: 0 | 90 | 180 | 270
): MeshData {
  // Apply rotation by swapping width/depth
  const [w, d] = (rotation === 90 || rotation === 270) ? [depth, width] : [width, depth];
  const t = POCKET_WALL_THICKNESS;

  const meshes: MeshData[] = [];

  // Front wall (along X axis, at Y = y)
  meshes.push(createBox(x, y, z, w, t, height));
  // Back wall (at Y = y + d - t)
  meshes.push(createBox(x, y + d - t, z, w, t, height));
  // Left wall (along Y axis, at X = x, inner portion only)
  meshes.push(createBox(x, y + t, z, t, d - 2 * t, height));
  // Right wall (at X = x + w - t)
  meshes.push(createBox(x + w - t, y + t, z, t, d - 2 * t, height));

  return mergeMeshes(meshes);
}

/**
 * Generate a circular pocket (hollow cylinder ring).
 */
function generateCirclePocket(
  cx: number,
  cy: number,
  outerRadius: number,
  z: number,
  height: number
): MeshData {
  // Center the pocket at (cx + radius, cy + radius) since insert position is from corner
  const centerX = cx + outerRadius;
  const centerY = cy + outerRadius;
  const innerRadius = outerRadius - POCKET_WALL_THICKNESS;

  if (innerRadius <= 0) {
    // Too small for a pocket, just make a solid cylinder
    return createCylinder(centerX, centerY, z, outerRadius, height, CIRCLE_SEGMENTS);
  }

  return createRing(centerX, centerY, z, outerRadius, innerRadius, height, CIRCLE_SEGMENTS);
}

/**
 * Generate a hexagonal pocket (6 thin walls).
 */
function generateHexPocket(
  cx: number,
  cy: number,
  outerRadius: number,
  z: number,
  height: number
): MeshData {
  const centerX = cx + outerRadius;
  const centerY = cy + outerRadius;
  const innerRadius = outerRadius - POCKET_WALL_THICKNESS;

  if (innerRadius <= 0) {
    return createCylinder(centerX, centerY, z, outerRadius, height, HEX_SEGMENTS);
  }

  return createRing(centerX, centerY, z, outerRadius, innerRadius, height, HEX_SEGMENTS);
}

/**
 * Generate a rounded-rectangle pocket (4 walls + 4 quarter-cylinder corners).
 */
function generateRoundedRectPocket(
  x: number,
  y: number,
  width: number,
  depth: number,
  cornerRadius: number,
  z: number,
  height: number,
  rotation: 0 | 90 | 180 | 270
): MeshData {
  const [w, d] = (rotation === 90 || rotation === 270) ? [depth, width] : [width, depth];
  const t = POCKET_WALL_THICKNESS;
  const r = Math.min(cornerRadius, w / 2, d / 2);

  if (r <= 0) {
    // No corner radius, fall back to rectangle
    return generateRectPocket(x, y, w, d, z, height, 0);
  }

  const meshes: MeshData[] = [];

  // Straight wall segments (between corner arcs)
  const flatW = w - 2 * r;
  const flatD = d - 2 * r;

  // Front wall (between corners)
  if (flatW > 0) {
    meshes.push(createBox(x + r, y, z, flatW, t, height));
  }
  // Back wall
  if (flatW > 0) {
    meshes.push(createBox(x + r, y + d - t, z, flatW, t, height));
  }
  // Left wall
  if (flatD > 0) {
    meshes.push(createBox(x, y + r, z, t, flatD, height));
  }
  // Right wall
  if (flatD > 0) {
    meshes.push(createBox(x + w - t, y + r, z, t, flatD, height));
  }

  // Corner arcs (quarter rings)
  const innerR = r - t;
  if (innerR > 0) {
    const cornerSegs = 6; // Segments per quarter arc
    // Bottom-left corner
    meshes.push(createQuarterRing(x + r, y + r, z, r, innerR, height, cornerSegs, Math.PI));
    // Bottom-right corner
    meshes.push(createQuarterRing(x + w - r, y + r, z, r, innerR, height, cornerSegs, 3 * Math.PI / 2));
    // Top-left corner
    meshes.push(createQuarterRing(x + r, y + d - r, z, r, innerR, height, cornerSegs, Math.PI / 2));
    // Top-right corner
    meshes.push(createQuarterRing(x + w - r, y + d - r, z, r, innerR, height, cornerSegs, 0));
  }

  return mergeMeshes(meshes);
}

/**
 * Create a ring (hollow cylinder) - outer minus inner cylinder.
 * Generates side faces for both inner and outer surfaces, plus top and bottom annulus caps.
 */
function createRing(
  cx: number,
  cy: number,
  z: number,
  outerR: number,
  innerR: number,
  height: number,
  segments: number
): MeshData {
  // Per segment: 2 tris outer side + 2 tris inner side + 2 tris top cap + 2 tris bottom cap = 8 tris
  const triangleCount = segments * 8;
  const vertices = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  let vi = 0;

  const z2 = z + height;

  const sv = (vx: number, vy: number, vz: number, nx: number, ny: number, nz: number) => {
    vertices[vi] = vx; vertices[vi + 1] = vy; vertices[vi + 2] = vz;
    normals[vi] = nx; normals[vi + 1] = ny; normals[vi + 2] = nz;
    vi += 3;
  };

  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;

    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2);

    // Outer vertices
    const ox1 = cx + cos1 * outerR, oy1 = cy + sin1 * outerR;
    const ox2 = cx + cos2 * outerR, oy2 = cy + sin2 * outerR;
    // Inner vertices
    const ix1 = cx + cos1 * innerR, iy1 = cy + sin1 * innerR;
    const ix2 = cx + cos2 * innerR, iy2 = cy + sin2 * innerR;

    // Outer side (normals pointing outward)
    sv(ox1, oy1, z, cos1, sin1, 0);
    sv(ox2, oy2, z, cos2, sin2, 0);
    sv(ox2, oy2, z2, cos2, sin2, 0);

    sv(ox1, oy1, z, cos1, sin1, 0);
    sv(ox2, oy2, z2, cos2, sin2, 0);
    sv(ox1, oy1, z2, cos1, sin1, 0);

    // Inner side (normals pointing inward)
    sv(ix2, iy2, z, -cos2, -sin2, 0);
    sv(ix1, iy1, z, -cos1, -sin1, 0);
    sv(ix1, iy1, z2, -cos1, -sin1, 0);

    sv(ix2, iy2, z, -cos2, -sin2, 0);
    sv(ix1, iy1, z2, -cos1, -sin1, 0);
    sv(ix2, iy2, z2, -cos2, -sin2, 0);

    // Top annulus (normal up)
    sv(ox1, oy1, z2, 0, 0, 1);
    sv(ox2, oy2, z2, 0, 0, 1);
    sv(ix2, iy2, z2, 0, 0, 1);

    sv(ox1, oy1, z2, 0, 0, 1);
    sv(ix2, iy2, z2, 0, 0, 1);
    sv(ix1, iy1, z2, 0, 0, 1);

    // Bottom annulus (normal down)
    sv(ox2, oy2, z, 0, 0, -1);
    sv(ox1, oy1, z, 0, 0, -1);
    sv(ix1, iy1, z, 0, 0, -1);

    sv(ox2, oy2, z, 0, 0, -1);
    sv(ix1, iy1, z, 0, 0, -1);
    sv(ix2, iy2, z, 0, 0, -1);
  }

  return { vertices, normals, triangleCount };
}

/**
 * Create a quarter of a ring (for rounded-rect corners).
 */
function createQuarterRing(
  cx: number,
  cy: number,
  z: number,
  outerR: number,
  innerR: number,
  height: number,
  segments: number,
  startAngle: number
): MeshData {
  const triangleCount = segments * 8;
  const vertices = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  let vi = 0;

  const z2 = z + height;
  const quarterArc = Math.PI / 2;

  const sv = (vx: number, vy: number, vz: number, nx: number, ny: number, nz: number) => {
    vertices[vi] = vx; vertices[vi + 1] = vy; vertices[vi + 2] = vz;
    normals[vi] = nx; normals[vi + 1] = ny; normals[vi + 2] = nz;
    vi += 3;
  };

  for (let i = 0; i < segments; i++) {
    const a1 = startAngle + (i / segments) * quarterArc;
    const a2 = startAngle + ((i + 1) / segments) * quarterArc;

    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2);

    const ox1 = cx + cos1 * outerR, oy1 = cy + sin1 * outerR;
    const ox2 = cx + cos2 * outerR, oy2 = cy + sin2 * outerR;
    const ix1 = cx + cos1 * innerR, iy1 = cy + sin1 * innerR;
    const ix2 = cx + cos2 * innerR, iy2 = cy + sin2 * innerR;

    // Outer side
    sv(ox1, oy1, z, cos1, sin1, 0);
    sv(ox2, oy2, z, cos2, sin2, 0);
    sv(ox2, oy2, z2, cos2, sin2, 0);
    sv(ox1, oy1, z, cos1, sin1, 0);
    sv(ox2, oy2, z2, cos2, sin2, 0);
    sv(ox1, oy1, z2, cos1, sin1, 0);

    // Inner side
    sv(ix2, iy2, z, -cos2, -sin2, 0);
    sv(ix1, iy1, z, -cos1, -sin1, 0);
    sv(ix1, iy1, z2, -cos1, -sin1, 0);
    sv(ix2, iy2, z, -cos2, -sin2, 0);
    sv(ix1, iy1, z2, -cos1, -sin1, 0);
    sv(ix2, iy2, z2, -cos2, -sin2, 0);

    // Top annulus
    sv(ox1, oy1, z2, 0, 0, 1);
    sv(ox2, oy2, z2, 0, 0, 1);
    sv(ix2, iy2, z2, 0, 0, 1);
    sv(ox1, oy1, z2, 0, 0, 1);
    sv(ix2, iy2, z2, 0, 0, 1);
    sv(ix1, iy1, z2, 0, 0, 1);

    // Bottom annulus
    sv(ox2, oy2, z, 0, 0, -1);
    sv(ox1, oy1, z, 0, 0, -1);
    sv(ix1, iy1, z, 0, 0, -1);
    sv(ox2, oy2, z, 0, 0, -1);
    sv(ix1, iy1, z, 0, 0, -1);
    sv(ix2, iy2, z, 0, 0, -1);
  }

  return { vertices, normals, triangleCount };
}
