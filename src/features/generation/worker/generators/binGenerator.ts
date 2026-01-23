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
import { createHollowBox, createDividerWall, createScoop, createLabelTab, createCornerGusset, mergeMeshes } from './geometry';
import { getStyleConstraints } from '@/features/bin-designer/utils/styleConstraints';

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
 * Includes outer shell, inner cavity, dividers, scoops, label tab, and style reinforcements.
 */
export function generateBinGeometry(params: BinParams): MeshData {
  const wallThickness = getWallThickness(params.style);
  const constraints = getStyleConstraints(params.style);

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

  // Inner cavity dimensions (used by multiple features)
  const innerWidth = outerWidth - 2 * wallThickness;
  const innerDepth = outerDepth - 2 * wallThickness;
  const halfDepth = outerDepth / 2;

  // Dividers (if any and not constrained)
  const hasDividers = !constraints.disabledFeatures.includes('dividers') &&
    (params.dividers.x > 0 || params.dividers.y > 0);
  if (hasDividers) {
    const dividerMesh = generateDividers(params, outerWidth, outerDepth, totalHeight, wallThickness, bottomThickness);
    meshes.push(dividerMesh);
  }

  // Scoops (if enabled and not constrained)
  if (params.scoop && !constraints.disabledFeatures.includes('scoop')) {
    const scoopMesh = generateScoops(params, innerWidth, innerDepth, wallThickness, bottomThickness);
    meshes.push(scoopMesh);
  }

  // Label tab (if enabled and not constrained)
  if (params.label.enabled && !constraints.disabledFeatures.includes('label')) {
    meshes.push(createLabelTab(outerWidth, wallThickness, halfDepth, totalHeight));
  }

  // Corner gussets for reinforced styles (solid, rugged)
  if (constraints.hasGussets) {
    const gussetMesh = generateCornerGussets(outerWidth, outerDepth, wallThickness, bottomThickness, totalHeight);
    meshes.push(gussetMesh);
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

/**
 * Generates scoop ramps at the front of each compartment.
 * Scoop radius is proportional to the compartment size, capped at 20mm.
 */
function generateScoops(
  params: BinParams,
  innerWidth: number,
  innerDepth: number,
  wallThickness: number,
  bottomThickness: number
): MeshData {
  const meshes: MeshData[] = [];
  const divX = params.dividers.x;

  // Number of compartments along X axis
  const compCountX = divX + 1;
  const compCountY = params.dividers.y + 1;

  const compWidth = innerWidth / compCountX;
  const compDepth = innerDepth / compCountY;

  // Scoop radius: 40% of smaller compartment dimension, max 20mm
  const radius = Math.min(compWidth * 0.4, compDepth * 0.4, 20);

  // Front row inner Y coordinate
  const frontInnerY = -innerDepth / 2;

  // Add scoops to the front row of compartments
  for (let ix = 0; ix < compCountX; ix++) {
    const cx = -innerWidth / 2 + (ix + 0.5) * compWidth;

    meshes.push(createScoop(
      cx,
      frontInnerY,
      bottomThickness,
      compWidth - wallThickness,
      radius
    ));
  }

  return mergeMeshes(meshes);
}

/**
 * Generates corner gussets at all 4 inner corners of the bin.
 * Gusset size is proportional to wall thickness.
 */
function generateCornerGussets(
  outerWidth: number,
  outerDepth: number,
  wallThickness: number,
  bottomThickness: number,
  totalHeight: number
): MeshData {
  const meshes: MeshData[] = [];
  const halfW = outerWidth / 2;
  const halfD = outerDepth / 2;

  // Gusset size: 2x wall thickness
  const gussetSize = wallThickness * 2;
  const gussetHeight = totalHeight - bottomThickness;

  // Inner corner positions
  const innerLeft = -halfW + wallThickness;
  const innerRight = halfW - wallThickness;
  const innerFront = -halfD + wallThickness;
  const innerBack = halfD - wallThickness;

  // 4 corners with appropriate directions
  meshes.push(createCornerGusset(innerLeft, innerFront, bottomThickness, gussetSize, gussetHeight, 1, 1));
  meshes.push(createCornerGusset(innerRight, innerFront, bottomThickness, gussetSize, gussetHeight, -1, 1));
  meshes.push(createCornerGusset(innerLeft, innerBack, bottomThickness, gussetSize, gussetHeight, 1, -1));
  meshes.push(createCornerGusset(innerRight, innerBack, bottomThickness, gussetSize, gussetHeight, -1, -1));

  return mergeMeshes(meshes);
}
