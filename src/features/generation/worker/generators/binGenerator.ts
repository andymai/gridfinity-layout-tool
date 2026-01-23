/**
 * Bin geometry generator.
 *
 * Produces a Gridfinity bin mesh from BinParams using pure TypeScript math.
 * Geometry is represented as triangle mesh (vertices + normals).
 *
 * Features proper Gridfinity rounded geometry:
 * - Outer vertical corners: quarter-cylinder shells (R=3.75mm)
 * - Inner cavity corners: concave fills (R=2.8mm)
 * - Base profile: smooth arc transitions per cell
 */

import type { BinParams } from '@/features/bin-designer/types';
import type { MeshData } from '../../bridge/types';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import {
  createBox, createDividerWall, createScoop, createLabelTab,
  createCornerGusset, createQuarterCylinderShell, createBaseArc, mergeMeshes
} from './geometry';
import { getStyleConstraints } from '@/features/bin-designer/utils/styleConstraints';
import { generateInserts } from './insertGenerator';

/**
 * Convert horizontal grid units to millimeters.
 *
 * @param units - Number of grid units (horizontal units used for width/depth)
 * @returns The length in millimeters corresponding to `units`
 */
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

  const halfW = outerWidth / 2;
  const halfD = outerDepth / 2;

  // Check if any wall cutouts are active
  const hasWallCutouts = !constraints.disabledFeatures.includes('walls') &&
    (params.walls.front > 0 || params.walls.back > 0 || params.walls.left > 0 || params.walls.right > 0);

  // For vase mode: rounded outer shell, no base profile or interior features
  if (params.style === 'vase') {
    const vaseMeshes: MeshData[] = [];
    const outerR = GRIDFINITY.OUTER_FILLET;
    const innerR = outerR - wallThickness;
    const vaseWallH = totalHeight - baseHeight;

    // Bottom plate
    vaseMeshes.push(createBox(-halfW, -halfD, 0, outerWidth, outerDepth, baseHeight));

    if (vaseWallH > 0 && innerR > 0) {
      const flatFB = outerWidth - 2 * outerR;
      const flatLR = outerDepth - 2 * outerR;

      // Flat walls (between corners)
      if (flatFB > 0) {
        vaseMeshes.push(createBox(-halfW + outerR, -halfD, baseHeight, flatFB, wallThickness, vaseWallH));
        vaseMeshes.push(createBox(-halfW + outerR, halfD - wallThickness, baseHeight, flatFB, wallThickness, vaseWallH));
      }
      if (flatLR > 0) {
        vaseMeshes.push(createBox(-halfW, -halfD + outerR, baseHeight, wallThickness, flatLR, vaseWallH));
        vaseMeshes.push(createBox(halfW - wallThickness, -halfD + outerR, baseHeight, wallThickness, flatLR, vaseWallH));
      }

      // Rounded corners
      vaseMeshes.push(createQuarterCylinderShell(-halfW + outerR, -halfD + outerR, baseHeight, vaseWallH, outerR, innerR, Math.PI));
      vaseMeshes.push(createQuarterCylinderShell(halfW - outerR, -halfD + outerR, baseHeight, vaseWallH, outerR, innerR, 3 * Math.PI / 2));
      vaseMeshes.push(createQuarterCylinderShell(-halfW + outerR, halfD - outerR, baseHeight, vaseWallH, outerR, innerR, Math.PI / 2));
      vaseMeshes.push(createQuarterCylinderShell(halfW - outerR, halfD - outerR, baseHeight, vaseWallH, outerR, innerR, 0));
    }

    return mergeMeshes(vaseMeshes);
  }

  const meshes: MeshData[] = [];

  // 1. Per-cell base profiles (stepped: narrow at bottom for baseplate fit)
  meshes.push(generateBaseProfileMesh(outerWidth, outerDepth, baseHeight, params.width, params.depth));

  // 2. Walls with rounded corners (from z=baseHeight to z=totalHeight)
  // Outer corners use OUTER_FILLET radius; inner corners adapt to wall thickness.
  if (wallHeight > 0) {
    const innerWidth = outerWidth - 2 * wallThickness;
    const innerDepth = outerDepth - 2 * wallThickness;

    if (innerWidth <= 0 || innerDepth <= 0) {
      // Solid block above base (walls too thick for cavity)
      meshes.push(createBox(-halfW, -halfD, baseHeight, outerWidth, outerDepth, wallHeight));
    } else {
      const outerR = GRIDFINITY.OUTER_FILLET; // 3.75mm
      const innerR = outerR - wallThickness;   // Adapts per style (e.g., 2.8mm for standard)

      // Flat wall lengths (between corner arcs)
      const flatFrontBackLen = outerWidth - 2 * outerR;
      const flatLeftRightLen = outerDepth - 2 * outerR;

      // Per-wall heights (affected by cutouts)
      const frontH = hasWallCutouts ? wallHeight * (1 - params.walls.front / 100) : wallHeight;
      const backH = hasWallCutouts ? wallHeight * (1 - params.walls.back / 100) : wallHeight;
      const leftH = hasWallCutouts ? wallHeight * (1 - params.walls.left / 100) : wallHeight;
      const rightH = hasWallCutouts ? wallHeight * (1 - params.walls.right / 100) : wallHeight;

      // Front flat wall (shortened, between corner arcs)
      if (frontH > 0 && flatFrontBackLen > 0) {
        meshes.push(createBox(-halfW + outerR, -halfD, baseHeight, flatFrontBackLen, wallThickness, frontH));
      }
      // Back flat wall
      if (backH > 0 && flatFrontBackLen > 0) {
        meshes.push(createBox(-halfW + outerR, halfD - wallThickness, baseHeight, flatFrontBackLen, wallThickness, backH));
      }
      // Left flat wall
      if (leftH > 0 && flatLeftRightLen > 0) {
        meshes.push(createBox(-halfW, -halfD + outerR, baseHeight, wallThickness, flatLeftRightLen, leftH));
      }
      // Right flat wall
      if (rightH > 0 && flatLeftRightLen > 0) {
        meshes.push(createBox(halfW - wallThickness, -halfD + outerR, baseHeight, wallThickness, flatLeftRightLen, rightH));
      }

      // 4 rounded outer corners (quarter-cylinder shells)
      // Corner height = minimum of the two adjacent walls
      if (innerR > 0) {
        const flH = Math.min(frontH, leftH);
        const frH = Math.min(frontH, rightH);
        const blH = Math.min(backH, leftH);
        const brH = Math.min(backH, rightH);

        // Front-left corner: center at (-halfW+outerR, -halfD+outerR), arc from PI to 3PI/2
        if (flH > 0) meshes.push(createQuarterCylinderShell(-halfW + outerR, -halfD + outerR, baseHeight, flH, outerR, innerR, Math.PI));
        // Front-right corner: center at (+halfW-outerR, -halfD+outerR), arc from 3PI/2 to 2PI
        if (frH > 0) meshes.push(createQuarterCylinderShell(halfW - outerR, -halfD + outerR, baseHeight, frH, outerR, innerR, 3 * Math.PI / 2));
        // Back-left corner: center at (-halfW+outerR, +halfD-outerR), arc from PI/2 to PI
        if (blH > 0) meshes.push(createQuarterCylinderShell(-halfW + outerR, halfD - outerR, baseHeight, blH, outerR, innerR, Math.PI / 2));
        // Back-right corner: center at (+halfW-outerR, +halfD-outerR), arc from 0 to PI/2
        if (brH > 0) meshes.push(createQuarterCylinderShell(halfW - outerR, halfD - outerR, baseHeight, brH, outerR, innerR, 0));
      }
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

  // 3b. Inserts (pocket walls on the bin floor)
  if (params.inserts.length > 0) {
    const wallHeight = totalHeight - baseHeight;
    const insertMesh = generateInserts(
      params.inserts,
      innerWidth,
      innerDepth,
      wallThickness,
      baseHeight,
      wallHeight,
      halfW,
      halfD
    );
    meshes.push(insertMesh);
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
 * Generates per-cell base profiles with smooth arc transitions.
 *
 * Each grid cell gets its OWN profile (narrow at bottom, wider at top),
 * with gaps between adjacent cells where baseplate ridges sit.
 * This is what makes bins lock into Gridfinity baseplates.
 *
 * Per cell:
 * - Arc transition (z=0 to 2.15mm): smooth curve from narrow (~34.5mm) to wide (~41.5mm)
 * - Upper step (z=2.15 to 7mm): full width flat (bridge/floor)
 * - Gap between cells: ~0.5mm (baseplate ridge slot)
 *
 * The arc replaces the old sharp step, matching real Gridfinity's smooth
 * stacking profile that slides into baseplates.
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

  const arcRadius = GRIDFINITY.BASE_TOP_FILLET; // 2.15mm arc height
  const upperH = baseHeight - arcRadius; // 4.85mm flat upper section
  const inset = GRIDFINITY.OUTER_FILLET; // 3.75mm inset per side for narrow base
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

      // Smooth arc transition from narrow bottom to wide top (replaces sharp step)
      if (bottomW > 0 && bottomD > 0 && arcRadius > 0) {
        meshes.push(createBaseArc(
          cx, cy,
          bottomW, bottomD,
          topW, topD,
          arcRadius,
          0 // arc starts at z=0
        ));
      }

      // Upper flat section (bridge to cavity floor)
      if (topW > 0 && topD > 0 && upperH > 0) {
        meshes.push(createBox(
          cx - topW / 2, cy - topD / 2, arcRadius,
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