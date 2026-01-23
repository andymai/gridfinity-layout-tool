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
import { createBox, createHollowBox, createDividerWall, createScoop, createLabelTab, createCornerGusset, mergeMeshes } from './geometry';
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
 * Height units INCLUDE the base: a 3U bin is 3×7=21mm tall (body).
 * The base occupies the first 7mm (no cavity there).
 * Cavity height = (height - 1) × 7mm.
 *
 * Base profile: stepped per Gridfinity spec so bins lock into baseplates.
 * Lower step (~2.15mm): narrower for baseplate groove fit.
 * Upper step (to 7mm): full outer width (bridge/floor).
 */
export function generateBinGeometry(params: BinParams): MeshData {
  const wallThickness = getWallThickness(params.style);
  const constraints = getStyleConstraints(params.style);

  // Outer dimensions in mm (subtract tolerance for baseplate fit)
  const outerWidth = gridToMm(params.width) - GRIDFINITY.TOLERANCE;
  const outerDepth = gridToMm(params.depth) - GRIDFINITY.TOLERANCE;

  // Height units INCLUDE the base. 3U = 3*7 = 21mm body height.
  const totalHeight = heightToMm(params.height);

  // Base = first height unit (7mm dead space: profile + bridge + floor)
  const baseHeight = GRIDFINITY.BASE_HEIGHT;
  // Wall/cavity height above the base
  const wallHeight = totalHeight - baseHeight;

  // Check if any wall cutouts are active
  const hasWallCutouts = !constraints.disabledFeatures.includes('walls') &&
    (params.walls.front > 0 || params.walls.back > 0 || params.walls.left > 0 || params.walls.right > 0);

  // For vase mode: just the outer shell, no base profile or interior features
  if (params.style === 'vase') {
    return createHollowBox(outerWidth, outerDepth, totalHeight, wallThickness, baseHeight);
  }

  const meshes: MeshData[] = [];

  const halfW = outerWidth / 2;
  const halfD = outerDepth / 2;

  // 1. Per-cell base profiles (stepped: narrow at bottom for baseplate fit)
  meshes.push(generateBaseProfileMesh(outerWidth, outerDepth, baseHeight, params.width, params.depth));

  // 2. Walls (from z=baseHeight to z=totalHeight)
  if (wallHeight > 0) {
    const innerWidth = outerWidth - 2 * wallThickness;
    const innerDepth = outerDepth - 2 * wallThickness;

    if (innerWidth <= 0 || innerDepth <= 0) {
      // Solid block above base (walls too thick for cavity)
      meshes.push(createBox(-halfW, -halfD, baseHeight, outerWidth, outerDepth, wallHeight));
    } else if (hasWallCutouts) {
      // Per-wall height reduction from cutout percentages
      const innerHalfD = innerDepth / 2;
      const frontH = wallHeight * (1 - params.walls.front / 100);
      const backH = wallHeight * (1 - params.walls.back / 100);
      const leftH = wallHeight * (1 - params.walls.left / 100);
      const rightH = wallHeight * (1 - params.walls.right / 100);

      if (frontH > 0) meshes.push(createBox(-halfW, -halfD, baseHeight, outerWidth, wallThickness, frontH));
      if (backH > 0) meshes.push(createBox(-halfW, halfD - wallThickness, baseHeight, outerWidth, wallThickness, backH));
      if (leftH > 0) meshes.push(createBox(-halfW, -innerHalfD, baseHeight, wallThickness, innerDepth, leftH));
      if (rightH > 0) meshes.push(createBox(halfW - wallThickness, -innerHalfD, baseHeight, wallThickness, innerDepth, rightH));
    } else {
      // Full-height walls
      const innerHalfD = innerDepth / 2;
      meshes.push(createBox(-halfW, -halfD, baseHeight, outerWidth, wallThickness, wallHeight));
      meshes.push(createBox(-halfW, halfD - wallThickness, baseHeight, outerWidth, wallThickness, wallHeight));
      meshes.push(createBox(-halfW, -innerHalfD, baseHeight, wallThickness, innerDepth, wallHeight));
      meshes.push(createBox(halfW - wallThickness, -innerHalfD, baseHeight, wallThickness, innerDepth, wallHeight));
    }
  }

  // Inner cavity dimensions (used by multiple features)
  const innerWidth = outerWidth - 2 * wallThickness;
  const innerDepth = outerDepth - 2 * wallThickness;

  // 3. Dividers (if any and not constrained)
  const hasDividers = !constraints.disabledFeatures.includes('dividers') &&
    (params.dividers.x > 0 || params.dividers.y > 0);
  if (hasDividers) {
    const dividerMesh = generateDividers(params, outerWidth, outerDepth, totalHeight, wallThickness, baseHeight);
    meshes.push(dividerMesh);
  }

  // 4. Scoops (if enabled and not constrained)
  if (params.scoop && !constraints.disabledFeatures.includes('scoop')) {
    const scoopMesh = generateScoops(params, innerWidth, innerDepth, wallThickness, baseHeight);
    meshes.push(scoopMesh);
  }

  // 5. Label tab (if enabled and not constrained)
  if (params.label.enabled && !constraints.disabledFeatures.includes('label')) {
    const labelMesh = generateLabelTabs(params, outerWidth, outerDepth, wallThickness, totalHeight);
    meshes.push(labelMesh);
  }

  // 6. Corner gussets for reinforced styles (solid, rugged)
  if (constraints.hasGussets) {
    const gussetMesh = generateCornerGussets(outerWidth, outerDepth, wallThickness, baseHeight, totalHeight);
    meshes.push(gussetMesh);
  }

  return mergeMeshes(meshes);
}

/**
 * Generates per-cell stepped base profiles.
 *
 * Each grid cell gets its OWN profile (narrow at bottom, wider at top),
 * with gaps between adjacent cells where baseplate ridges sit.
 * This is what makes bins lock into Gridfinity baseplates.
 *
 * Per cell:
 * - Lower step (z=0 to 2.15mm): narrow (~34.5mm for 1U cell)
 * - Upper step (z=2.15 to 7mm): wider (~41.5mm for 1U cell)
 * - Gap between cells: ~0.5mm (baseplate ridge slot)
 *
 * Fractional cells (e.g., 0.5U edge) get proportionally smaller profiles.
 */
function generateBaseProfileMesh(
  outerWidth: number,
  outerDepth: number,
  baseHeight: number,
  gridWidth: number,
  gridDepth: number
): MeshData {
  const meshes: MeshData[] = [];

  const profileStep = GRIDFINITY.BASE_TOP_FILLET; // 2.15mm transition height
  const upperH = baseHeight - profileStep; // 4.85mm upper bridge height
  const inset = GRIDFINITY.OUTER_FILLET; // 3.75mm inset per side for lower step
  const cellGap = GRIDFINITY.TOLERANCE; // 0.5mm gap between adjacent profiles

  // Cell pitch: evenly distribute cells across bin dimensions
  const cellPitchX = outerWidth / gridWidth;
  const cellPitchY = outerDepth / gridDepth;

  const halfW = outerWidth / 2;
  const halfD = outerDepth / 2;

  // Number of cells (ceil to handle fractional grid dimensions like 1.5)
  const cellsX = Math.ceil(gridWidth);
  const cellsY = Math.ceil(gridDepth);

  for (let gx = 0; gx < cellsX; gx++) {
    for (let gy = 0; gy < cellsY; gy++) {
      // Fractional factor for edge cells (1.0 for full, <1 for partial)
      const fracX = Math.min(1.0, gridWidth - gx);
      const fracY = Math.min(1.0, gridDepth - gy);

      // Cell span in mm
      const spanX = fracX * cellPitchX;
      const spanY = fracY * cellPitchY;

      // Cell center position
      const cx = -halfW + gx * cellPitchX + spanX / 2;
      const cy = -halfD + gy * cellPitchY + spanY / 2;

      // Upper step: cell span minus gap (leaves room for baseplate ridges)
      const topW = spanX - cellGap;
      const topD = spanY - cellGap;

      // Lower step: further inset by OUTER_FILLET for stacking interface
      const bottomW = spanX - 2 * inset;
      const bottomD = spanY - 2 * inset;

      // Lower step (narrow, baseplate groove fit)
      if (bottomW > 0 && bottomD > 0 && profileStep > 0) {
        meshes.push(createBox(
          cx - bottomW / 2, cy - bottomD / 2, 0,
          bottomW, bottomD, profileStep
        ));
      }

      // Upper step (wider, bridge to cavity floor)
      if (topW > 0 && topD > 0 && upperH > 0) {
        meshes.push(createBox(
          cx - topW / 2, cy - topD / 2, profileStep,
          topW, topD, upperH
        ));
      }
    }
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

  // Scoop radius: 1/3 of smaller compartment dimension, max 15mm (per spec)
  const radius = Math.min(compWidth / 3, compDepth / 3, 15);

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
 * Generates label tabs for the front face of each column.
 * When X dividers exist, each compartment column gets its own tab.
 * Otherwise, a single tab spans the full bin width.
 */
function generateLabelTabs(
  params: BinParams,
  outerWidth: number,
  outerDepth: number,
  wallThickness: number,
  totalHeight: number
): MeshData {
  const halfDepth = outerDepth / 2;
  const divX = params.dividers.x;

  // No X dividers: single full-width tab
  if (divX === 0) {
    return createLabelTab(outerWidth, wallThickness, halfDepth, totalHeight);
  }

  // With X dividers: one tab per column
  const meshes: MeshData[] = [];
  const innerWidth = outerWidth - 2 * wallThickness;
  const columnCount = divX + 1;
  const columnWidth = innerWidth / columnCount;

  for (let col = 0; col < columnCount; col++) {
    // Each column tab: centered within its compartment
    const colCenterX = -innerWidth / 2 + (col + 0.5) * columnWidth;
    const tabWidth = columnWidth - params.dividers.thickness; // Account for divider wall
    if (tabWidth <= 2) continue; // Too small for a tab

    const specTabDepth = 15.85;
    const specTabHeight = specTabDepth * Math.tan(36 * Math.PI / 180); // ~11.52mm
    meshes.push(createLabelTab(
      tabWidth + 2 * wallThickness, // Pass as if it were the "outer width" for this column
      wallThickness,
      halfDepth,
      totalHeight,
      specTabHeight,
      specTabDepth,
      colCenterX // offsetX - center of this column
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
