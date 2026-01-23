/**
 * Bin geometry generator.
 *
 * Produces a Gridfinity bin mesh from BinParams using pure TypeScript math.
 * Geometry is represented as triangle mesh (vertices + normals).
 *
 * Alpha implementation: simple box geometry without fillets.
 * Future: swap with replicad BREP for proper fillets and boolean ops.
 */

import type { BinParams } from '@/features/bin-designer/types';
import type { MeshData } from '../../bridge/types';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import { createHollowBox, createDividerWall, mergeMeshes } from './geometry';

/** Converts grid units to mm (width/depth) */
function gridToMm(units: number): number {
  return units * GRIDFINITY.GRID_SIZE;
}

/** Converts height units to mm */
function heightToMm(units: number): number {
  return units * GRIDFINITY.HEIGHT_UNIT;
}

/** Get wall thickness for a bin style */
function getWallThickness(style: string): number {
  return STYLE_WALL_THICKNESS[style] ?? GRIDFINITY.WALL_THICKNESS;
}

/**
 * Generates complete bin geometry from parameters.
 *
 * Geometry is centered on X/Y axes, with Z=0 at the bottom of the bin.
 * Includes outer shell, inner cavity, and optional dividers.
 */
export function generateBinGeometry(params: BinParams): MeshData {
  const wallThickness = getWallThickness(params.style);

  // Outer dimensions in mm (subtract tolerance for baseplate fit)
  const outerWidth = gridToMm(params.width) - GRIDFINITY.TOLERANCE;
  const outerDepth = gridToMm(params.depth) - GRIDFINITY.TOLERANCE;
  const totalHeight = heightToMm(params.height) + GRIDFINITY.BASE_HEIGHT;

  // Base + shell
  const bottomThickness = GRIDFINITY.BASE_HEIGHT + GRIDFINITY.BOTTOM_THICKNESS;

  // For vase mode: just the outer shell, no interior features
  if (params.style === 'vase') {
    return createHollowBox(outerWidth, outerDepth, totalHeight, wallThickness, bottomThickness);
  }

  const meshes: MeshData[] = [];

  // Main shell (outer walls + bottom)
  meshes.push(createHollowBox(outerWidth, outerDepth, totalHeight, wallThickness, bottomThickness));

  // Dividers (if any)
  if (params.dividers.x > 0 || params.dividers.y > 0) {
    const dividerMesh = generateDividers(params, outerWidth, outerDepth, totalHeight, wallThickness, bottomThickness);
    meshes.push(dividerMesh);
  }

  return mergeMeshes(meshes);
}

/**
 * Generates divider wall geometry inside the bin cavity.
 */
function generateDividers(
  params: BinParams,
  outerWidth: number,
  outerDepth: number,
  totalHeight: number,
  wallThickness: number,
  bottomThickness: number
): MeshData {
  const meshes: MeshData[] = [];
  const { x: divX, y: divY, thickness } = params.dividers;

  // Inner cavity dimensions
  const innerWidth = outerWidth - 2 * wallThickness;
  const innerDepth = outerDepth - 2 * wallThickness;
  const dividerHeight = totalHeight - bottomThickness;

  // Starting point (inner cavity origin, centered)
  const startX = -innerWidth / 2;
  const startY = -innerDepth / 2;

  // X dividers: walls parallel to X axis (splitting depth into sections)
  if (divY > 0) {
    const sectionDepth = innerDepth / (divY + 1);
    for (let i = 1; i <= divY; i++) {
      const y = startY + i * sectionDepth - thickness / 2;
      meshes.push(createDividerWall(startX, y, bottomThickness, innerWidth, thickness, dividerHeight));
    }
  }

  // Y dividers: walls parallel to Y axis (splitting width into sections)
  if (divX > 0) {
    const sectionWidth = innerWidth / (divX + 1);
    for (let i = 1; i <= divX; i++) {
      const x = startX + i * sectionWidth - thickness / 2;
      meshes.push(createDividerWall(x, startY, bottomThickness, thickness, innerDepth, dividerHeight));
    }
  }

  return mergeMeshes(meshes);
}
