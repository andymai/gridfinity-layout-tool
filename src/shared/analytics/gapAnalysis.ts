/**
 * Gap analysis utilities for ML telemetry.
 * Computes spatial context: largest empty rectangle, fill percentage.
 *
 * Handles half-bin mode by detecting fractional coordinates and scaling
 * the internal grid by 2x for accurate measurements.
 */

import type { Layout, Bin } from '@/core/types';
import { STAGING_ID, isFractional } from '@/core/constants';

export interface GapAnalysis {
  /** Largest empty rectangle as "WxD" string (in grid units) */
  largestGap: string;
  /** Fill percentage (0-100) of occupied cells */
  fillPct: number;
  /** Whether the placed bin fits the largest gap exactly */
  gapFit: 'exact' | 'partial' | 'none';
}

/**
 * Check if any bin or drawer dimension has fractional values.
 * Used to determine if we need to scale the grid for half-bin support.
 */
function hasFractionalCoordinates(bins: Bin[], drawerWidth: number, drawerDepth: number): boolean {
  if (isFractional(drawerWidth) || isFractional(drawerDepth)) return true;
  return bins.some(
    (b) => isFractional(b.x) || isFractional(b.y) || isFractional(b.width) || isFractional(b.depth)
  );
}

/**
 * Create a 2D grid of occupied cells for a specific layer.
 * Returns a Set of "x,y" strings for O(1) lookup.
 *
 * @param scale - Grid scale factor (2 for half-bin mode, 1 otherwise)
 */
function createOccupiedGrid(
  bins: Bin[],
  layerId: string,
  width: number,
  depth: number,
  scale: number
): Set<string> {
  const occupied = new Set<string>();
  const scaledWidth = width * scale;
  const scaledDepth = depth * scale;

  for (const bin of bins) {
    if (bin.layerId !== layerId) continue;
    // Scale bin coordinates and iterate at scaled resolution
    const startX = Math.round(bin.x * scale);
    const startY = Math.round(bin.y * scale);
    const endX = Math.round((bin.x + bin.width) * scale);
    const endY = Math.round((bin.y + bin.depth) * scale);

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        if (x >= 0 && x < scaledWidth && y >= 0 && y < scaledDepth) {
          occupied.add(`${x},${y}`);
        }
      }
    }
  }

  return occupied;
}

/**
 * Find the largest empty rectangle in a grid.
 * Uses a simple O(width * depth * min(width, depth)) algorithm.
 *
 * For typical gridfinity grids (< 50x50), this is fast enough.
 */
function findLargestEmptyRect(
  occupied: Set<string>,
  width: number,
  depth: number
): { w: number; d: number } {
  let maxArea = 0;
  let bestW = 0;
  let bestD = 0;

  // For each potential top-left corner
  for (let startX = 0; startX < width; startX++) {
    for (let startY = 0; startY < depth; startY++) {
      // Skip if starting cell is occupied
      if (occupied.has(`${startX},${startY}`)) continue;

      // Try expanding rectangle from this corner
      // First, find max width from this point
      let maxW = 0;
      for (let x = startX; x < width; x++) {
        if (occupied.has(`${x},${startY}`)) break;
        maxW = x - startX + 1;
      }

      // For each possible width, find max depth
      let currentMaxW = maxW;
      for (let dy = 0; startY + dy < depth; dy++) {
        // Check how far we can extend width at this row
        let rowW = 0;
        for (let dx = 0; dx < currentMaxW && startX + dx < width; dx++) {
          if (occupied.has(`${startX + dx},${startY + dy}`)) break;
          rowW = dx + 1;
        }

        if (rowW === 0) break; // Row is blocked at start

        currentMaxW = Math.min(currentMaxW, rowW);
        const currentD = dy + 1;
        const area = currentMaxW * currentD;

        if (area > maxArea) {
          maxArea = area;
          bestW = currentMaxW;
          bestD = currentD;
        }
      }
    }
  }

  return { w: bestW, d: bestD };
}

/**
 * Analyze gaps in a layout for ML telemetry.
 *
 * Handles half-bin mode by scaling the internal grid by 2x when fractional
 * coordinates are detected, ensuring accurate fill and gap calculations.
 *
 * @param layout - Current layout state
 * @param layerId - Layer to analyze
 * @param placedBinSize - Size of the bin that was just placed (for gap fit check)
 * @returns Gap analysis results
 */
export function analyzeGaps(
  layout: Layout,
  layerId: string,
  placedBinSize?: { width: number; depth: number }
): GapAnalysis {
  const { drawer } = layout;

  // Get bins on this layer (excluding staging)
  const layerBins = layout.bins.filter((b) => b.layerId === layerId && b.layerId !== STAGING_ID);

  // Determine scale factor: 2x for half-bin mode, 1x otherwise
  const scale = hasFractionalCoordinates(layerBins, drawer.width, drawer.depth) ? 2 : 1;

  const width = Math.ceil(drawer.width);
  const depth = Math.ceil(drawer.depth);
  const scaledWidth = width * scale;
  const scaledDepth = depth * scale;
  const totalScaledCells = scaledWidth * scaledDepth;

  // Create occupied grid at scaled resolution
  const occupied = createOccupiedGrid(layerBins, layerId, width, depth, scale);
  const occupiedCount = occupied.size;

  // Calculate fill percentage (same regardless of scale)
  const fillPct = totalScaledCells > 0 ? Math.round((occupiedCount / totalScaledCells) * 100) : 0;

  // Find largest empty rectangle at scaled resolution
  const largest = findLargestEmptyRect(occupied, scaledWidth, scaledDepth);

  // Convert back to grid units (may be fractional for half-bin mode)
  const gapW = largest.w / scale;
  const gapD = largest.d / scale;
  const largestGap = gapW > 0 && gapD > 0 ? `${gapW}x${gapD}` : '0x0';

  // Determine gap fit
  let gapFit: 'exact' | 'partial' | 'none' = 'none';
  if (placedBinSize && gapW > 0 && gapD > 0) {
    const binW = placedBinSize.width;
    const binD = placedBinSize.depth;

    // Use small epsilon for floating point comparison
    const epsilon = 0.001;
    if (Math.abs(binW - gapW) < epsilon && Math.abs(binD - gapD) < epsilon) {
      gapFit = 'exact';
    } else if (binW <= gapW + epsilon && binD <= gapD + epsilon) {
      gapFit = 'partial';
    }
  }

  return {
    largestGap,
    fillPct,
    gapFit,
  };
}

/**
 * Quick fill percentage calculation (without full gap analysis).
 * Use this when you only need fill % and not the largest gap.
 *
 * Handles half-bin mode by using actual bin dimensions rather than rounding.
 */
export function calculateFillPercentage(layout: Layout, layerId: string): number {
  const { drawer } = layout;
  const totalArea = drawer.width * drawer.depth;

  if (totalArea === 0) return 0;

  let occupiedArea = 0;
  for (const bin of layout.bins) {
    if (bin.layerId === layerId && bin.layerId !== STAGING_ID) {
      occupiedArea += bin.width * bin.depth;
    }
  }

  return Math.round((occupiedArea / totalArea) * 100);
}
