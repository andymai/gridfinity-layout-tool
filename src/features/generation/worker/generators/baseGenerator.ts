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
import { createBox, createCylinder, createQuarterCylinderShell, mergeMeshes } from './geometry';

/**
 * Generates the stacking lip geometry at the top of the bin.
 *
 * The lip is a raised rim that allows bins to stack. It uses the same
 * rounded corner profile as the bin body (quarter-cylinder shells at
 * OUTER_FILLET radius) for proper geometric continuity and stacking fit.
 *
 * The lip wall thickness matches the bin wall thickness (0.95mm per spec).
 */
export function generateStackingLip(
  outerWidth: number,
  outerDepth: number,
  totalHeight: number
): MeshData {
  const lipHeight = GRIDFINITY.LIP_HEIGHT;
  const lipInset = GRIDFINITY.WALL_THICKNESS;
  const outerR = GRIDFINITY.OUTER_FILLET; // 3.75mm - matches bin body corners
  const innerR = outerR - lipInset;

  const halfW = outerWidth / 2;
  const halfD = outerDepth / 2;

  const meshes: MeshData[] = [];
  const z = totalHeight;

  // Flat wall segments (between corners)
  const flatFB = outerWidth - 2 * outerR; // Front/back flat length
  const flatLR = outerDepth - 2 * outerR; // Left/right flat length

  // Front lip (flat section between corners)
  if (flatFB > 0) {
    meshes.push(createBox(-halfW + outerR, -halfD, z, flatFB, lipInset, lipHeight));
  }
  // Back lip
  if (flatFB > 0) {
    meshes.push(createBox(-halfW + outerR, halfD - lipInset, z, flatFB, lipInset, lipHeight));
  }
  // Left lip
  if (flatLR > 0) {
    meshes.push(createBox(-halfW, -halfD + outerR, z, lipInset, flatLR, lipHeight));
  }
  // Right lip
  if (flatLR > 0) {
    meshes.push(createBox(halfW - lipInset, -halfD + outerR, z, lipInset, flatLR, lipHeight));
  }

  // Rounded corners (quarter-cylinder shells matching the bin body)
  if (innerR > 0) {
    // Front-left
    meshes.push(createQuarterCylinderShell(-halfW + outerR, -halfD + outerR, z, lipHeight, outerR, innerR, Math.PI));
    // Front-right
    meshes.push(createQuarterCylinderShell(halfW - outerR, -halfD + outerR, z, lipHeight, outerR, innerR, 3 * Math.PI / 2));
    // Back-left
    meshes.push(createQuarterCylinderShell(-halfW + outerR, halfD - outerR, z, lipHeight, outerR, innerR, Math.PI / 2));
    // Back-right
    meshes.push(createQuarterCylinderShell(halfW - outerR, halfD - outerR, z, lipHeight, outerR, innerR, 0));
  }

  return mergeMeshes(meshes);
}

/**
 * Generates base geometry including optional attachment features.
 * The base occupies Z = 0 to BASE_HEIGHT (7mm per spec).
 *
 * For magnet/screw styles, holes are subtracted from corners.
 * In Alpha (no boolean ops), we represent holes as separate cylinders
 * that the 3D preview can render differently.
 */
export function generateBaseGeometry(params: BinParams): MeshData {
  const outerWidth = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerDepth = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  // Height units INCLUDE the base (first unit = base, no cavity)
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;

  const meshes: MeshData[] = [];

  // Magnet/screw hole features (one at each grid corner)
  if (params.base.style === 'magnet' || params.base.style === 'screw' || params.base.style === 'magnet_and_screw') {
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
 *
 * The 'magnet_and_screw' style generates both hole types at each position:
 * a wider shallow magnet hole with a narrower deeper screw hole concentric.
 */
function generateCornerHoles(params: BinParams): MeshData {
  if (params.base.style === 'magnet_and_screw') {
    // Both: magnet counterbore + screw through-hole at each position
    const magnetHoles = generateAllCornerHoles(
      params,
      GRIDFINITY.MAGNET_DIAMETER / 2,
      params.base.magnetDepth
    );
    const screwHoles = generateAllCornerHoles(
      params,
      GRIDFINITY.SCREW_DIAMETER / 2,
      GRIDFINITY.SCREW_DEPTH
    );
    return mergeMeshes([magnetHoles, screwHoles]);
  }

  const isMagnet = params.base.style === 'magnet';
  const radius = isMagnet
    ? GRIDFINITY.MAGNET_DIAMETER / 2
    : GRIDFINITY.SCREW_DIAMETER / 2;
  const depth = isMagnet ? params.base.magnetDepth : GRIDFINITY.SCREW_DEPTH;

  return generateAllCornerHoles(params, radius, depth);
}

/**
 * Corner hole generation: places holes at grid unit corners.
 *
 * Uses 24 segments for smooth circles (vs 12 in Alpha). The extra geometry
 * is negligible (~2KB per hole) but dramatically improves print quality for
 * magnet fit tolerance.
 *
 * Hole placement rules:
 * - Bins smaller than 1 unit in either dimension get 4 corner holes at the bin's own corners.
 * - Bins 1 unit or larger get holes at each full grid cell intersection (using floored cell counts).
 * - Fractional portions beyond the last full grid cell (e.g., the 0.5 in a 1.5-unit bin)
 *   do not receive additional holes beyond the standard grid pattern.
 */
function generateAllCornerHoles(params: BinParams, radius: number, depth: number): MeshData {
  const meshes: MeshData[] = [];
  const inset = GRIDFINITY.MAGNET_INSET;
  const halfW = (params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE) / 2;
  const halfD = (params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE) / 2;

  // Only iterate over full grid cells (fractional edges don't get holes)
  const cellsX = Math.floor(params.width);
  const cellsY = Math.floor(params.depth);

  // If bin is smaller than 1 full unit, place 4 corner holes at the bin's own corners
  if (cellsX === 0 || cellsY === 0) {
    const segments = 24;
    meshes.push(createCylinder(-halfW + inset, -halfD + inset, 0, radius, depth, segments));
    meshes.push(createCylinder(halfW - inset, -halfD + inset, 0, radius, depth, segments));
    meshes.push(createCylinder(-halfW + inset, halfD - inset, 0, radius, depth, segments));
    meshes.push(createCylinder(halfW - inset, halfD - inset, 0, radius, depth, segments));
    return mergeMeshes(meshes);
  }

  const segments = 24; // Smoother circles for better print quality

  for (let gx = 0; gx < cellsX; gx++) {
    for (let gy = 0; gy < cellsY; gy++) {
      const cellMinX = -halfW + gx * GRIDFINITY.GRID_SIZE;
      const cellMinY = -halfD + gy * GRIDFINITY.GRID_SIZE;
      const cellMaxX = cellMinX + GRIDFINITY.GRID_SIZE;
      const cellMaxY = cellMinY + GRIDFINITY.GRID_SIZE;

      // Only generate holes for the outermost corners of each cell
      // to avoid excessive duplicates at internal grid intersections
      const isLeftEdge = gx === 0;
      const isRightEdge = gx === cellsX - 1;
      const isFrontEdge = gy === 0;
      const isBackEdge = gy === cellsY - 1;

      // Bottom-left corner
      if (isLeftEdge || isFrontEdge) {
        meshes.push(createCylinder(cellMinX + inset, cellMinY + inset, 0, radius, depth, segments));
      }
      // Bottom-right corner
      if (isRightEdge || isFrontEdge) {
        meshes.push(createCylinder(cellMaxX - inset, cellMinY + inset, 0, radius, depth, segments));
      }
      // Top-left corner
      if (isLeftEdge || isBackEdge) {
        meshes.push(createCylinder(cellMinX + inset, cellMaxY - inset, 0, radius, depth, segments));
      }
      // Top-right corner
      if (isRightEdge || isBackEdge) {
        meshes.push(createCylinder(cellMaxX - inset, cellMaxY - inset, 0, radius, depth, segments));
      }
    }
  }

  return mergeMeshes(meshes);
}
