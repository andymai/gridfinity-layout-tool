/**
 * Insert geometry generator.
 *
 * Creates pocket walls for insert cavities on the bin floor.
 * Each insert generates a set of thin walls forming the pocket perimeter.
 * The bin floor acts as the pocket bottom (no separate floor is generated).
 */

import type { MeshData } from '@/features/generation/bridge/types';
import type { Insert } from '@/features/bin-designer/types';
import { createBox, createCylinder, mergeMeshes } from './geometry';

/** Wall thickness for insert pocket perimeters (mm) */
const POCKET_WALL_THICKNESS = 1.2;

/** Segments for circular geometry (higher = smoother) */
const CIRCLE_SEGMENTS = 24;

/** Segments per side for hexagon */
const HEX_SEGMENTS = 6;

/**
 * Generate mesh geometry for all insert pockets placed on a bin floor.
 *
 * @param inserts - Array of placed inserts with shape, position, and cut depth
 * @param innerWidth - Bin interior width in millimeters
 * @param innerDepth - Bin interior depth in millimeters
 * @param wallThickness - Bin wall thickness in millimeters (used when converting insert positions to world coordinates)
 * @param baseHeight - Z height of the bin floor in millimeters
 * @param maxPocketHeight - Maximum pocket height to use (in millimeters); each insert's cut depth is clamped to this value
 * @param halfW - Half of the bin's outer width used for coordinate offset
 * @param halfD - Half of the bin's outer depth used for coordinate offset
 * @returns The merged MeshData containing geometry for all generated insert pockets; an empty mesh when no pockets are created
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

/**
 * Create the mesh for a single insert pocket placed at the given world coordinates.
 *
 * @param insert - Insert descriptor; used fields depend on `insert.shape` (e.g., `width`, `depth`, `rotation`, `cornerRadius`)
 * @param worldX - World-space X coordinate of the pocket origin
 * @param worldY - World-space Y coordinate of the pocket origin
 * @param baseZ - Z coordinate of the pocket bottom (base)
 * @param height - Height of the pocket walls
 * @returns MeshData for the generated pocket, or `null` if the insert shape is not supported
 */
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
      return generateCirclePocket(worldX, worldY, Math.min(insert.width, insert.depth) / 2, baseZ, height);
    case 'hexagon':
      return generateHexPocket(worldX, worldY, Math.min(insert.width, insert.depth) / 2, baseZ, height);
    case 'rounded-rect':
      return generateRoundedRectPocket(worldX, worldY, insert.width, insert.depth, insert.cornerRadius, baseZ, height, insert.rotation);
    default:
      return null;
  }
}

/**
 * Generate a rectangular pocket perimeter composed of four thin walls with no floor.
 *
 * @param x - X coordinate of the pocket's bottom-left outer corner
 * @param y - Y coordinate of the pocket's bottom-left outer corner
 * @param width - Outer width of the pocket along the X axis (before rotation)
 * @param depth - Outer depth of the pocket along the Y axis (before rotation)
 * @param z - Base Z coordinate for the pocket walls
 * @param height - Height of the pocket walls
 * @param rotation - Rotation of the pocket in degrees; valid values: `0`, `90`, `180`, `270`
 * @returns A merged MeshData containing four thin wall meshes forming the pocket perimeter;
 *          wall thickness equals `POCKET_WALL_THICKNESS`
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
 * Generate a circular pocket centered at (cx + outerRadius, cy + outerRadius).
 *
 * @param cx - X coordinate of the pocket's bounding square top-left corner
 * @param cy - Y coordinate of the pocket's bounding square top-left corner
 * @param outerRadius - Outer radius of the pocket
 * @param z - Z position (base) of the pocket
 * @param height - Vertical height of the pocket walls
 * @returns A MeshData representing a hollow ring with outer radius `outerRadius` and inner radius `outerRadius - POCKET_WALL_THICKNESS`; if the inner radius is less than or equal to zero, returns a solid cylinder with radius `outerRadius`
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
 * Create a hexagonal pocket (six thin walls) positioned at the specified coordinates.
 *
 * @returns MeshData containing the pocket geometry. If `outerRadius - POCKET_WALL_THICKNESS` is greater than zero the mesh is a hollow hexagonal ring; otherwise it is a solid hexagonal prism.
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
 * Generate geometry for a rounded-rectangle pocket composed of four thin walls and four quarter-ring corners.
 *
 * @param x - X coordinate of the pocket's minimum (left) edge
 * @param y - Y coordinate of the pocket's minimum (bottom) edge
 * @param width - Outer width of the pocket (before rotation)
 * @param depth - Outer depth of the pocket (before rotation)
 * @param cornerRadius - Requested corner radius; clamped to half the pocket dimensions
 * @param z - Base Z coordinate for the pocket walls
 * @param height - Vertical height of the pocket walls
 * @param rotation - Rotation of the pocket in degrees (0, 90, 180, or 270); width/depth are swapped for 90/270
 * @returns MeshData containing the merged wall and corner-ring geometry defining the pocket perimeter
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

  if (r <= POCKET_WALL_THICKNESS) {
    // Corner radius too small for pocket walls — fall back to rectangle
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
 * Generate a hollow cylindrical ring mesh (outer cylinder minus inner cylinder).
 *
 * @param cx - X coordinate of the ring center
 * @param cy - Y coordinate of the ring center
 * @param z - Z coordinate of the ring base (bottom)
 * @param outerR - Outer radius of the ring
 * @param innerR - Inner radius of the hollow section
 * @param height - Height of the ring measured upward from `z`
 * @param segments - Number of radial segments used to approximate the circular profile
 * @returns MeshData containing `vertices`, `normals`, and `triangleCount` for the generated ring
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
 * Generates geometry for a quarter of a hollow ring used as a rounded corner.
 *
 * Constructs vertex and normal arrays for the outer side, inner side, top annulus, and bottom annulus
 * for a 90-degree arc starting at `startAngle`.
 *
 * @param cx - X coordinate of the ring's center
 * @param cy - Y coordinate of the ring's center
 * @param z - Base Z coordinate (bottom) of the ring
 * @param outerR - Outer radius of the ring
 * @param innerR - Inner radius of the ring (must be < outerR for a hollow ring)
 * @param height - Vertical thickness of the ring (top Z = z + height)
 * @param segments - Number of segments to subdivide the quarter arc into
 * @param startAngle - Start angle in radians for the quarter arc
 * @returns MeshData containing `vertices`, `normals`, and `triangleCount` for the quarter-ring geometry
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