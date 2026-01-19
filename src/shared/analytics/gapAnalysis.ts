/**
 * Gap analysis utilities for ML telemetry.
 * Computes spatial context: largest empty rectangle, fill percentage.
 */

import type { Layout, Bin } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

export interface GapAnalysis {
  /** Largest empty rectangle as "WxD" string */
  largestGap: string;
  /** Fill percentage (0-100) of occupied cells */
  fillPct: number;
  /** Whether the placed bin fits the largest gap exactly */
  gapFit: 'exact' | 'partial' | 'none';
}

/**
 * Create a 2D grid of occupied cells for a specific layer.
 * Returns a Set of "x,y" strings for O(1) lookup.
 */
function createOccupiedGrid(bins: Bin[], layerId: string, width: number, depth: number): Set<string> {
  const occupied = new Set<string>();

  for (const bin of bins) {
    if (bin.layerId !== layerId) continue;
    for (let x = Math.floor(bin.x); x < Math.ceil(bin.x + bin.width); x++) {
      for (let y = Math.floor(bin.y); y < Math.ceil(bin.y + bin.depth); y++) {
        if (x >= 0 && x < width && y >= 0 && y < depth) {
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
  const width = Math.ceil(drawer.width);
  const depth = Math.ceil(drawer.depth);
  const totalCells = width * depth;

  // Get bins on this layer (excluding staging)
  const layerBins = layout.bins.filter(
    (b) => b.layerId === layerId && b.layerId !== STAGING_ID
  );

  // Create occupied grid
  const occupied = createOccupiedGrid(layerBins, layerId, width, depth);
  const occupiedCount = occupied.size;

  // Calculate fill percentage
  const fillPct = totalCells > 0 ? Math.round((occupiedCount / totalCells) * 100) : 0;

  // Find largest empty rectangle
  const largest = findLargestEmptyRect(occupied, width, depth);
  const largestGap = largest.w > 0 && largest.d > 0 ? `${largest.w}x${largest.d}` : '0x0';

  // Determine gap fit
  let gapFit: 'exact' | 'partial' | 'none' = 'none';
  if (placedBinSize && largest.w > 0 && largest.d > 0) {
    const binW = Math.ceil(placedBinSize.width);
    const binD = Math.ceil(placedBinSize.depth);

    if (binW === largest.w && binD === largest.d) {
      gapFit = 'exact';
    } else if (binW <= largest.w && binD <= largest.d) {
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
 */
export function calculateFillPercentage(layout: Layout, layerId: string): number {
  const { drawer } = layout;
  const totalCells = Math.ceil(drawer.width) * Math.ceil(drawer.depth);

  if (totalCells === 0) return 0;

  let occupiedCells = 0;
  for (const bin of layout.bins) {
    if (bin.layerId === layerId && bin.layerId !== STAGING_ID) {
      occupiedCells += Math.ceil(bin.width) * Math.ceil(bin.depth);
    }
  }

  return Math.round((occupiedCells / totalCells) * 100);
}
