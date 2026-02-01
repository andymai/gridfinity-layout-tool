/**
 * Hex grid math and compound builder for eco mode honeycomb patterns.
 *
 * Generates flat-top hexagonal grids within rectangular bounds,
 * respecting solid edge margins. Used for both floor and wall
 * honeycomb cutout generation.
 *
 * Hex orientation: flat-top (pointy sides on left/right).
 * Row spacing = cellSize × 0.75, col spacing = cellSize.
 * Odd rows are staggered by cellSize / 2.
 */

import { drawCircle } from 'replicad';
import type { Shape3D, Sketch } from 'replicad';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HexGridConfig {
  /** Bounding box width in mm */
  readonly boundsW: number;
  /** Bounding box depth in mm */
  readonly boundsD: number;
  /** Hex cell flat-to-flat diameter in mm */
  readonly cellSize: number;
  /** Solid margin from edges in mm */
  readonly margin: number;
  /** Extrusion height in mm */
  readonly height: number;
}

export interface HexCenter {
  readonly x: number;
  readonly y: number;
}

// ─── Hex Math ────────────────────────────────────────────────────────────────

/**
 * Calculate hex centers that fit within bounds minus margin.
 *
 * Flat-top hex geometry:
 * - Width (flat-to-flat) = cellSize
 * - Height (vertex-to-vertex) = cellSize × 2/√3
 * - Circumradius = cellSize / √3
 * - Row spacing = cellSize × 3 / (2√3) = cellSize × √3/2
 * - Col spacing = cellSize
 * - Odd rows offset by cellSize / 2
 */
export function calculateHexCenters(config: HexGridConfig): HexCenter[] {
  const { boundsW, boundsD, cellSize, margin } = config;

  // Usable area after margins
  const usableW = boundsW - 2 * margin;
  const usableD = boundsD - 2 * margin;

  if (usableW <= 0 || usableD <= 0 || cellSize <= 0) return [];

  // Circumradius: distance from center to vertex (for containment check)
  const circumRadius = cellSize / Math.sqrt(3);

  // Row and column spacing for flat-top hexes
  const rowSpacing = (cellSize * Math.sqrt(3)) / 2;
  const colSpacing = cellSize;

  // Origin at center of bounds
  const originX = boundsW / 2;
  const originY = boundsD / 2;

  // Min/max usable region
  const minX = margin + circumRadius;
  const maxX = boundsW - margin - circumRadius;
  const minY = margin + circumRadius;
  const maxY = boundsD - margin - circumRadius;

  if (minX > maxX || minY > maxY) return [];

  const centers: HexCenter[] = [];

  // Calculate grid range centered on origin
  const maxRows = Math.ceil(usableD / rowSpacing) + 1;
  const maxCols = Math.ceil(usableW / colSpacing) + 1;

  for (let row = -maxRows; row <= maxRows; row++) {
    const y = originY + row * rowSpacing;
    const xOffset = row % 2 !== 0 ? colSpacing / 2 : 0;

    for (let col = -maxCols; col <= maxCols; col++) {
      const x = originX + col * colSpacing + xOffset;

      // Check if hex fits entirely within usable bounds
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        centers.push({ x, y });
      }
    }
  }

  return centers;
}

// ─── Compound Builder ────────────────────────────────────────────────────────

/**
 * Build a fused compound of hex cylinders for boolean cutting.
 *
 * Approximates hexes as circles (cellSize/2 radius) which produces
 * visually identical results after tessellation and is significantly
 * faster for boolean operations.
 *
 * Returns null if no hexes fit within the bounds.
 */
export function buildHexCompound(config: HexGridConfig): Shape3D | null {
  const centers = calculateHexCenters(config);
  if (centers.length === 0) return null;

  const radius = config.cellSize / 2;
  const hexes: Shape3D[] = [];

  for (const center of centers) {
    const hex = (drawCircle(radius).sketchOnPlane('XY') as unknown as Sketch).extrude(
      config.height
    );

    // Position from center of bounds (Replicad origin) to hex center
    // Shift from bounds-relative coordinates to centered coordinates
    hexes.push(hex.translate([center.x - config.boundsW / 2, center.y - config.boundsD / 2, 0]));
  }

  // Fuse all hex solids into a single compound for one boolean cut
  let compound = hexes[0];
  for (let i = 1; i < hexes.length; i++) {
    compound = compound.fuse(hexes[i]);
  }

  return compound;
}
