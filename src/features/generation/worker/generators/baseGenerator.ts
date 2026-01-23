/**
 * Base plate geometry generator.
 *
 * Creates the Gridfinity base profile with optional magnet or screw holes.
 * Alpha implementation uses simplified geometry (no filleted profiles).
 *
 * The base is modeled as an extension below the main bin shell:
 * - Standard: solid base plate
 * - Magnet: cylindrical holes at corners for 6x2mm magnets
 * - Screw: cylindrical holes at corners for M3 screws
 * - Weighted: thicker solid base (for stability without magnets)
 */

import type { BinParams } from '@/features/bin-designer/types';
import type { MeshData } from '../../bridge/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { createBox, createCylinder, mergeMeshes } from './geometry';

/**
 * Generates the stacking lip geometry at the top of the bin.
 * This is a small raised rim that allows bins to stack.
 */
export function generateStackingLip(
  outerWidth: number,
  outerDepth: number,
  totalHeight: number
): MeshData {
  const lipHeight = GRIDFINITY.LIP_HEIGHT;
  const lipInset = 0.5; // mm inset from outer wall

  const halfW = outerWidth / 2;
  const halfD = outerDepth / 2;
  const innerHalfD = halfD - lipInset;

  const meshes: MeshData[] = [];
  const z = totalHeight;

  // Front lip
  meshes.push(createBox(-halfW, -halfD, z, outerWidth, lipInset, lipHeight));
  // Back lip
  meshes.push(createBox(-halfW, halfD - lipInset, z, outerWidth, lipInset, lipHeight));
  // Left lip (between front and back)
  meshes.push(createBox(-halfW, -innerHalfD, z, lipInset, outerDepth - 2 * lipInset, lipHeight));
  // Right lip
  meshes.push(createBox(halfW - lipInset, -innerHalfD, z, lipInset, outerDepth - 2 * lipInset, lipHeight));

  return mergeMeshes(meshes);
}

/**
 * Generates base geometry including optional attachment features.
 * The base occupies Z = 0 to BASE_HEIGHT (5mm).
 *
 * For magnet/screw styles, holes are subtracted from corners.
 * In Alpha (no boolean ops), we represent holes as separate cylinders
 * that the 3D preview can render differently.
 */
export function generateBaseGeometry(params: BinParams): MeshData {
  const outerWidth = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerDepth = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT + GRIDFINITY.BASE_HEIGHT;

  const meshes: MeshData[] = [];

  // Magnet/screw hole features (one at each grid corner)
  if (params.base.style === 'magnet' || params.base.style === 'screw') {
    const holes = generateCornerHoles(params);
    meshes.push(holes);
  }

  // Stacking lip (if enabled)
  if (params.base.stackingLip) {
    meshes.push(generateStackingLip(outerWidth, outerDepth, totalHeight));
  }

  if (meshes.length === 0) {
    // No additional base geometry needed
    return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };
  }

  return mergeMeshes(meshes);
}

/**
 * Generates cylindrical hole geometry at each grid unit corner.
 * These represent magnet or screw holes in the base.
 *
 * In the Gridfinity spec, holes are placed MAGNET_INSET mm from each corner.
 * For multi-unit bins, holes appear at every grid intersection.
 */
function generateCornerHoles(params: BinParams): MeshData {
  const isMagnet = params.base.style === 'magnet';
  const radius = isMagnet
    ? GRIDFINITY.MAGNET_DIAMETER / 2
    : GRIDFINITY.SCREW_DIAMETER / 2;
  const depth = isMagnet ? params.base.magnetDepth : GRIDFINITY.SCREW_DEPTH;

  return generateAllCornerHoles(params, radius, depth);
}

/**
 * Simplified corner hole generation: 4 holes at each grid unit's corners.
 * Duplicates at shared corners are acceptable for Alpha (visual-only geometry).
 */
function generateAllCornerHoles(params: BinParams, radius: number, depth: number): MeshData {
  const meshes: MeshData[] = [];
  const inset = GRIDFINITY.MAGNET_INSET;
  const halfW = (params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE) / 2;
  const halfD = (params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE) / 2;

  // For each integer grid unit, place holes at the 4 corners
  for (let gx = 0; gx < params.width; gx++) {
    for (let gy = 0; gy < params.depth; gy++) {
      const cellMinX = -halfW + gx * GRIDFINITY.GRID_SIZE;
      const cellMinY = -halfD + gy * GRIDFINITY.GRID_SIZE;
      const cellMaxX = cellMinX + GRIDFINITY.GRID_SIZE;
      const cellMaxY = cellMinY + GRIDFINITY.GRID_SIZE;

      // Only generate holes for the outermost corners of each cell
      // to avoid excessive duplicates at internal grid intersections
      const isLeftEdge = gx === 0;
      const isRightEdge = gx === Math.ceil(params.width) - 1;
      const isFrontEdge = gy === 0;
      const isBackEdge = gy === Math.ceil(params.depth) - 1;

      // Bottom-left corner
      if (isLeftEdge || isFrontEdge) {
        meshes.push(createCylinder(cellMinX + inset, cellMinY + inset, 0, radius, depth, 12));
      }
      // Bottom-right corner
      if (isRightEdge || isFrontEdge) {
        meshes.push(createCylinder(cellMaxX - inset, cellMinY + inset, 0, radius, depth, 12));
      }
      // Top-left corner
      if (isLeftEdge || isBackEdge) {
        meshes.push(createCylinder(cellMinX + inset, cellMaxY - inset, 0, radius, depth, 12));
      }
      // Top-right corner
      if (isRightEdge || isBackEdge) {
        meshes.push(createCylinder(cellMaxX - inset, cellMaxY - inset, 0, radius, depth, 12));
      }
    }
  }

  return mergeMeshes(meshes);
}
