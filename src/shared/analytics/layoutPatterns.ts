/**
 * Layout Pattern Detection for ML Telemetry
 *
 * Analyzes layout structures to detect archetypes and spatial patterns
 * for training smart layout generation models.
 */

import type { Layout, Bin, Drawer } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

// ============================================
// TYPES
// ============================================

/**
 * High-level layout archetype classification.
 */
export type LayoutArchetype =
  | 'uniform' // >80% bins same size
  | 'mixed' // Default - variety of sizes
  | 'border_fill' // Bins on 3+ edges + center bins
  | 'compartmentalized' // Distinct category clusters
  | 'layered'; // Different patterns per layer

/**
 * Spatial patterns detected in bin placement.
 */
export type SpatialPattern =
  | 'corner_start' // Earliest bins near a corner
  | 'large_first' // Avg size decreases over placement order
  | 'category_grouped' // Same categories adjacent
  | 'edge_aligned' // >60% bins touch edge
  | 'center_out'; // Bins start from center

/**
 * Edge usage tracking for layout analysis.
 */
export interface EdgeUsage {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

// ============================================
// ARCHETYPE DETECTION
// ============================================

/**
 * Get all non-staging bins from a layout.
 */
function getActiveBins(layout: Layout): Bin[] {
  return layout.bins.filter((b) => b.layerId !== STAGING_ID);
}

/**
 * Compute the size key for a bin.
 */
function getBinSizeKey(bin: Bin): string {
  return `${bin.width}x${bin.depth}x${bin.height}`;
}

/**
 * Detect the layout archetype.
 *
 * @param layout - Layout to analyze
 * @returns Detected archetype
 */
export function detectArchetype(layout: Layout): LayoutArchetype {
  const bins = getActiveBins(layout);

  if (bins.length === 0) return 'mixed';

  // Check uniform first (>80% same size)
  const sizeDistribution = new Map<string, number>();
  for (const bin of bins) {
    const key = getBinSizeKey(bin);
    sizeDistribution.set(key, (sizeDistribution.get(key) || 0) + 1);
  }

  const maxCount = Math.max(...sizeDistribution.values());
  if (maxCount / bins.length > 0.8) {
    return 'uniform';
  }

  // Check layered (different patterns per layer)
  if (layout.layers.length > 1) {
    const layerPatterns = new Map<string, Set<string>>();
    for (const bin of bins) {
      let sizeSet = layerPatterns.get(bin.layerId);
      if (!sizeSet) {
        sizeSet = new Set();
        layerPatterns.set(bin.layerId, sizeSet);
      }
      sizeSet.add(getBinSizeKey(bin));
    }

    // If layers have significantly different size sets, it's layered
    const layerSets = Array.from(layerPatterns.values());
    if (layerSets.length > 1) {
      let differentLayers = 0;
      for (let i = 0; i < layerSets.length - 1; i++) {
        const overlap = [...layerSets[i]].filter((s) => layerSets[i + 1].has(s)).length;
        const total = Math.max(layerSets[i].size, layerSets[i + 1].size);
        if (overlap / total < 0.5) {
          differentLayers++;
        }
      }
      if (differentLayers >= layerSets.length / 2) {
        return 'layered';
      }
    }
  }

  // Check border_fill (bins on 3+ edges + center bins)
  const edgeUsage = computeEdgeUsage(bins, layout.drawer);
  const edgeCount = [edgeUsage.left, edgeUsage.right, edgeUsage.top, edgeUsage.bottom].filter(
    Boolean
  ).length;

  if (edgeCount >= 3) {
    // Also need center bins for border_fill
    const hasCenterBins = bins.some((bin) => {
      const centerX = layout.drawer.width / 2;
      const centerY = layout.drawer.depth / 2;
      const binCenterX = bin.x + bin.width / 2;
      const binCenterY = bin.y + bin.depth / 2;
      const distFromCenter = Math.sqrt(
        Math.pow(binCenterX - centerX, 2) + Math.pow(binCenterY - centerY, 2)
      );
      const maxDist = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
      return distFromCenter < maxDist * 0.5; // Within 50% of center
    });

    if (hasCenterBins) {
      return 'border_fill';
    }
  }

  // Check compartmentalized (distinct category clusters)
  if (isCompartmentalized(bins, layout)) {
    return 'compartmentalized';
  }

  return 'mixed';
}

/**
 * Check if layout has compartmentalized category grouping.
 */
function isCompartmentalized(bins: Bin[], layout: Layout): boolean {
  if (layout.categories.length < 2) return false;

  // Group bins by category
  const categoryBins = new Map<string, Bin[]>();
  for (const bin of bins) {
    const cat = bin.category || 'default';
    let binArray = categoryBins.get(cat);
    if (!binArray) {
      binArray = [];
      categoryBins.set(cat, binArray);
    }
    binArray.push(bin);
  }

  // Check if categories form spatial clusters
  let clusteredCategories = 0;
  for (const [_category, catBins] of categoryBins) {
    if (catBins.length < 2) continue;

    // Check if bins in this category are adjacent
    let adjacentCount = 0;
    for (let i = 0; i < catBins.length; i++) {
      for (let j = i + 1; j < catBins.length; j++) {
        if (areBinsAdjacent(catBins[i], catBins[j])) {
          adjacentCount++;
        }
      }
    }

    // If >50% of possible pairs are adjacent, it's clustered
    const maxPairs = (catBins.length * (catBins.length - 1)) / 2;
    if (adjacentCount / maxPairs > 0.5) {
      clusteredCategories++;
    }
  }

  return clusteredCategories >= 2;
}

/**
 * Check if two bins are adjacent (touching).
 */
export function areBinsAdjacent(a: Bin, b: Bin): boolean {
  // Check if bins share an edge (not just corners)
  const aLeft = a.x;
  const aRight = a.x + a.width;
  const aTop = a.y + a.depth;
  const aBottom = a.y;

  const bLeft = b.x;
  const bRight = b.x + b.width;
  const bTop = b.y + b.depth;
  const bBottom = b.y;

  // Check horizontal adjacency (sharing vertical edge)
  const verticalOverlap = Math.max(0, Math.min(aTop, bTop) - Math.max(aBottom, bBottom));
  if ((aRight === bLeft || bRight === aLeft) && verticalOverlap > 0) {
    return true;
  }

  // Check vertical adjacency (sharing horizontal edge)
  const horizontalOverlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));
  if ((aTop === bBottom || bTop === aBottom) && horizontalOverlap > 0) {
    return true;
  }

  return false;
}

// ============================================
// SPATIAL PATTERN DETECTION
// ============================================

/**
 * Detect spatial patterns in the layout.
 *
 * @param layout - Layout to analyze
 * @returns Array of detected patterns
 */
export function detectSpatialPatterns(layout: Layout): SpatialPattern[] {
  const bins = getActiveBins(layout);
  const patterns: SpatialPattern[] = [];

  if (bins.length === 0) return patterns;

  // Check edge_aligned (>60% bins touch edge)
  const edgeBins = bins.filter((bin) => binTouchesEdge(bin, layout.drawer));
  if (edgeBins.length / bins.length > 0.6) {
    patterns.push('edge_aligned');
  }

  // Check corner_start (earliest bins near a corner)
  // Using bin ID as proxy for order (UUIDs are roughly time-ordered)
  if (bins.length >= 3) {
    const sortedBins = [...bins].sort((a, b) => a.id.localeCompare(b.id));
    const earlyBins = sortedBins.slice(0, Math.ceil(bins.length * 0.3));

    const corners = [
      { x: 0, y: 0 },
      { x: layout.drawer.width, y: 0 },
      { x: 0, y: layout.drawer.depth },
      { x: layout.drawer.width, y: layout.drawer.depth },
    ];

    let cornerBinCount = 0;
    for (const bin of earlyBins) {
      const binCenter = { x: bin.x + bin.width / 2, y: bin.y + bin.depth / 2 };
      const nearCorner = corners.some((corner) => {
        const dist = Math.sqrt(
          Math.pow(binCenter.x - corner.x, 2) + Math.pow(binCenter.y - corner.y, 2)
        );
        const maxDist = Math.sqrt(
          Math.pow(layout.drawer.width, 2) + Math.pow(layout.drawer.depth, 2)
        );
        return dist < maxDist * 0.3;
      });
      if (nearCorner) cornerBinCount++;
    }

    if (cornerBinCount / earlyBins.length > 0.6) {
      patterns.push('corner_start');
    }
  }

  // Check center_out (bins start from center)
  if (bins.length >= 3) {
    const sortedBins = [...bins].sort((a, b) => a.id.localeCompare(b.id));
    const earlyBins = sortedBins.slice(0, Math.ceil(bins.length * 0.3));

    const centerX = layout.drawer.width / 2;
    const centerY = layout.drawer.depth / 2;

    let centerBinCount = 0;
    for (const bin of earlyBins) {
      const binCenter = { x: bin.x + bin.width / 2, y: bin.y + bin.depth / 2 };
      const dist = Math.sqrt(
        Math.pow(binCenter.x - centerX, 2) + Math.pow(binCenter.y - centerY, 2)
      );
      const maxDist = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
      if (dist < maxDist * 0.4) centerBinCount++;
    }

    if (centerBinCount / earlyBins.length > 0.5) {
      patterns.push('center_out');
    }
  }

  // Check large_first (avg size decreases over time)
  if (bins.length >= 5) {
    const sortedBins = [...bins].sort((a, b) => a.id.localeCompare(b.id));
    const firstHalf = sortedBins.slice(0, Math.floor(bins.length / 2));
    const secondHalf = sortedBins.slice(Math.floor(bins.length / 2));

    const avgSizeFirst =
      firstHalf.reduce((sum, b) => sum + b.width * b.depth, 0) / firstHalf.length;
    const avgSizeSecond =
      secondHalf.reduce((sum, b) => sum + b.width * b.depth, 0) / secondHalf.length;

    if (avgSizeFirst > avgSizeSecond * 1.3) {
      patterns.push('large_first');
    }
  }

  // Check category_grouped (same categories adjacent)
  if (layout.categories.length >= 2) {
    let adjacentSameCategory = 0;
    let totalAdjacentPairs = 0;

    for (let i = 0; i < bins.length; i++) {
      for (let j = i + 1; j < bins.length; j++) {
        if (areBinsAdjacent(bins[i], bins[j])) {
          totalAdjacentPairs++;
          if (bins[i].category === bins[j].category) {
            adjacentSameCategory++;
          }
        }
      }
    }

    if (totalAdjacentPairs > 0 && adjacentSameCategory / totalAdjacentPairs > 0.6) {
      patterns.push('category_grouped');
    }
  }

  return patterns;
}

/**
 * Check if a bin touches any edge of the drawer.
 */
function binTouchesEdge(bin: Bin, drawer: Drawer): boolean {
  return (
    bin.x === 0 ||
    bin.y === 0 ||
    bin.x + bin.width === drawer.width ||
    bin.y + bin.depth === drawer.depth
  );
}

// ============================================
// UNIFORMITY SCORE
// ============================================

/**
 * Compute uniformity score (0-1) for bin sizes.
 * Higher score = more uniform (same sizes).
 *
 * @param bins - Bins to analyze
 * @returns Uniformity score 0-1
 */
export function computeUniformityScore(bins: Bin[]): number {
  if (bins.length === 0) return 1;
  if (bins.length === 1) return 1;

  // Count size distribution
  const sizeDistribution = new Map<string, number>();
  for (const bin of bins) {
    const key = getBinSizeKey(bin);
    sizeDistribution.set(key, (sizeDistribution.get(key) || 0) + 1);
  }

  // Calculate entropy-based uniformity
  // Low entropy = high uniformity (fewer distinct sizes)
  const total = bins.length;
  let entropy = 0;
  for (const count of sizeDistribution.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }

  // Normalize entropy (max entropy = log2(n) when all bins are different)
  const maxEntropy = Math.log2(Math.min(total, sizeDistribution.size));
  if (maxEntropy === 0) return 1;

  const normalizedEntropy = entropy / maxEntropy;

  // Convert to uniformity score (invert: high entropy = low uniformity)
  const uniformity = 1 - normalizedEntropy;

  // Round to 2 decimal places
  return Math.round(uniformity * 100) / 100;
}

// ============================================
// EDGE USAGE
// ============================================

/**
 * Compute which edges of the drawer have bins touching them.
 *
 * @param bins - Bins to analyze
 * @param drawer - Drawer dimensions
 * @returns Edge usage flags
 */
export function computeEdgeUsage(bins: Bin[], drawer: Drawer): EdgeUsage {
  const usage: EdgeUsage = {
    left: false,
    right: false,
    top: false,
    bottom: false,
  };

  for (const bin of bins) {
    if (bin.x === 0) usage.left = true;
    if (bin.y === 0) usage.bottom = true;
    if (bin.x + bin.width === drawer.width) usage.right = true;
    if (bin.y + bin.depth === drawer.depth) usage.top = true;
  }

  return usage;
}
