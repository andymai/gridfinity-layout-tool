/**
 * Structure Hash Computation for Layout Clustering
 *
 * Generates a deterministic hash that represents the structural "shape" of a layout,
 * enabling clustering of similar layouts for ML training data analysis.
 *
 * The hash encodes:
 * - Drawer aspect ratio bucket
 * - Bin count bucket
 * - Size distribution fingerprint
 * - Spatial density (quadrant occupancy)
 * - Layer usage pattern
 */

import type { Layout, Bin } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

/**
 * Compute a structure hash for layout clustering.
 * Returns an 8-character hex string that represents the structural fingerprint.
 *
 * @param layout - Layout to compute hash for
 * @returns 8-character hex hash
 */
export function computeStructureHash(layout: Layout): string {
  const bins = layout.bins.filter((b) => b.layerId !== STAGING_ID);

  // Component 1: Drawer aspect ratio bucket (2 bits)
  const aspectRatioBucket = computeAspectRatioBucket(layout.drawer.width, layout.drawer.depth);

  // Component 2: Bin count bucket (3 bits)
  const binCountBucket = computeBinCountBucket(bins.length);

  // Component 3: Size distribution fingerprint (8 bits)
  const sizeFingerprint = computeSizeFingerprint(bins);

  // Component 4: Spatial density / quadrant occupancy (4 bits)
  const quadrantOccupancy = computeQuadrantOccupancy(bins, layout.drawer);

  // Component 5: Layer usage pattern (3 bits)
  const layerPattern = computeLayerPattern(bins, layout.layers);

  // Combine components into a 20-bit value
  const combined =
    (aspectRatioBucket << 18) |
    (binCountBucket << 15) |
    (sizeFingerprint << 7) |
    (quadrantOccupancy << 3) |
    layerPattern;

  // Convert to 8-char hex (pad with leading zeros)
  return combined.toString(16).padStart(8, '0').slice(-8);
}

/**
 * Compute drawer aspect ratio bucket.
 * 0 = square-ish (ratio < 1.2)
 * 1 = wide (width > depth)
 * 2 = deep (depth > width)
 * 3 = extreme ratio (ratio > 2)
 */
function computeAspectRatioBucket(width: number, depth: number): number {
  const ratio = Math.max(width, depth) / Math.min(width, depth);

  if (ratio < 1.2) return 0; // Square-ish
  if (ratio > 2) return 3; // Extreme

  return width > depth ? 1 : 2; // Wide or deep
}

/**
 * Compute bin count bucket (8 buckets).
 * 0 = 0-5, 1 = 6-10, 2 = 11-20, 3 = 21-40,
 * 4 = 41-80, 5 = 81-160, 6 = 161-320, 7 = 321+
 */
function computeBinCountBucket(binCount: number): number {
  if (binCount <= 5) return 0;
  if (binCount <= 10) return 1;
  if (binCount <= 20) return 2;
  if (binCount <= 40) return 3;
  if (binCount <= 80) return 4;
  if (binCount <= 160) return 5;
  if (binCount <= 320) return 6;
  return 7;
}

/**
 * Compute size distribution fingerprint.
 * Creates an 8-bit value representing:
 * - Bits 0-2: Most common size category (0-7)
 * - Bits 3-5: Size variety (0-7)
 * - Bits 6-7: Average size bucket (0-3)
 */
function computeSizeFingerprint(bins: Bin[]): number {
  if (bins.length === 0) return 0;

  // Count sizes by category (small, medium, large, extra-large)
  const sizeCounts = [0, 0, 0, 0]; // small, medium, large, xl

  let totalArea = 0;

  for (const bin of bins) {
    const area = bin.width * bin.depth;
    totalArea += area;

    if (area <= 2)
      sizeCounts[0]++; // 1x1, 1x2, 2x1
    else if (area <= 6)
      sizeCounts[1]++; // 2x2, 2x3, 3x2, 1x3-6
    else if (area <= 12)
      sizeCounts[2]++; // 3x3, 3x4, 4x3, etc
    else sizeCounts[3]++; // Large bins
  }

  // Most common size category (3 bits, 0-3, but we use 0-7 space)
  let mostCommon = 0;
  let maxCount = 0;
  for (let i = 0; i < sizeCounts.length; i++) {
    if (sizeCounts[i] > maxCount) {
      maxCount = sizeCounts[i];
      mostCommon = i;
    }
  }

  // Size variety: how many categories have bins (0-4, mapped to 0-7)
  const categoriesUsed = sizeCounts.filter((c) => c > 0).length;
  const variety = Math.min(categoriesUsed * 2, 7);

  // Average size bucket (0-3)
  const avgArea = totalArea / bins.length;
  const avgBucket = avgArea <= 2 ? 0 : avgArea <= 6 ? 1 : avgArea <= 12 ? 2 : 3;

  return (avgBucket << 6) | (variety << 3) | mostCommon;
}

/**
 * Compute quadrant occupancy.
 * Returns a 4-bit value where each bit represents a quadrant:
 * bit 0 = top-left, bit 1 = top-right, bit 2 = bottom-left, bit 3 = bottom-right
 */
function computeQuadrantOccupancy(bins: Bin[], drawer: { width: number; depth: number }): number {
  if (bins.length === 0) return 0;

  const midX = drawer.width / 2;
  const midY = drawer.depth / 2;

  let occupancy = 0;

  for (const bin of bins) {
    const centerX = bin.x + bin.width / 2;
    const centerY = bin.y + bin.depth / 2;

    // Determine quadrant (grid origin is bottom-left)
    // bit 0 = top-left, bit 1 = top-right, bit 2 = bottom-left, bit 3 = bottom-right
    if (centerX < midX && centerY >= midY)
      occupancy |= 1; // top-left
    else if (centerX >= midX && centerY >= midY)
      occupancy |= 2; // top-right
    else if (centerX < midX && centerY < midY)
      occupancy |= 4; // bottom-left
    else occupancy |= 8; // bottom-right
  }

  return occupancy;
}

/**
 * Compute layer usage pattern.
 * Returns a 3-bit value:
 * - bit 0: single layer only
 * - bit 1: bottom-heavy (more bins in lower layers)
 * - bit 2: uses many layers (3+)
 *
 * @param bins - Array of bins
 * @param layers - Array of layers (index 0 = bottom layer)
 */
function computeLayerPattern(bins: Bin[], layers: Array<{ id: string }>): number {
  if (bins.length === 0 || layers.length === 0) return 0;

  // Count bins per layer using layer index order (deterministic)
  const layerBinCounts = new Map<string, number>();
  for (const bin of bins) {
    layerBinCounts.set(bin.layerId, (layerBinCounts.get(bin.layerId) || 0) + 1);
  }

  const layersUsed = layerBinCounts.size;
  let pattern = 0;

  // Bit 0: Single layer only
  if (layersUsed === 1) pattern |= 1;

  // Bit 2: Uses many layers
  if (layersUsed >= 3) pattern |= 4;

  // Bit 1: Bottom-heavy (more bins in lower layers)
  // Use layer index order from layout.layers (index 0 = bottom layer)
  if (layersUsed > 1 && layers.length > 1) {
    // Count bins in bottom half vs top half of layers
    const midpoint = layers.length / 2;
    let bottomHalfBins = 0;
    let topHalfBins = 0;

    for (let i = 0; i < layers.length; i++) {
      const count = layerBinCounts.get(layers[i].id) || 0;
      if (i < midpoint) {
        bottomHalfBins += count;
      } else {
        topHalfBins += count;
      }
    }

    // Bottom-heavy if bottom half has significantly more bins
    if (bottomHalfBins > topHalfBins * 1.5) pattern |= 2;
  }

  return pattern;
}

/**
 * Compute temporal fields for a layout snapshot.
 *
 * @returns Object with hour_of_day, day_of_week, is_weekend
 */
export function computeTemporalFields(): {
  hour_of_day: number;
  day_of_week: number;
  is_weekend: boolean;
} {
  const now = new Date();

  return {
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(), // 0 = Sunday, 6 = Saturday
    is_weekend: now.getDay() === 0 || now.getDay() === 6,
  };
}
