/**
 * Analytics metric computation — layout metrics and labs metrics.
 * Pure functions that derive analytics data from Layout and store state.
 */

import type { Layout, CategoryId } from '@/core/types';
import { DEFAULT_CATEGORIES, calcMaxGridUnits, hasFractionalDimensions } from '@/core/constants';
import { useLabsStore } from '@/core/store/labs';
import { getFeature } from '@/core/labs';
import { splitBinsByLocation } from '@/shared/utils';

// LABS METRICS

export interface LabsMetrics {
  labs_enabled_features: string[];
  labs_enabled_count: number;
}

/**
 * Compute Labs-related metrics for analytics snapshot.
 */
export function computeLabsMetrics(): LabsMetrics {
  const prefs = useLabsStore.getState().preferences;
  const enabledFeatures = Object.entries(prefs.enabledFeatures)
    .filter(([id, enabled]) => {
      if (!enabled) return false;
      const feature = getFeature(id);
      // Only include non-graduated features (graduated are always on)
      return feature?.status === 'experimental' || feature?.status === 'preview';
    })
    .map(([id]) => id);

  return {
    labs_enabled_features: enabledFeatures,
    labs_enabled_count: enabledFeatures.length,
  };
}

// METRICS TYPES

export interface LayoutMetrics {
  // Drawer configuration
  drawer_width: number;
  drawer_depth: number;
  drawer_height: number;
  grid_unit_mm: number;
  height_unit_mm: number;
  print_bed_size: number;
  print_bed_depth: number;
  drawer_is_default: boolean;

  // Bins summary
  bin_count: number;
  bins_on_grid: number;
  bins_in_staging: number;
  bins_with_labels: number;
  bins_with_notes: number;
  bins_with_clearance: number;
  bins_with_half_units: number;
  bin_avg_area: number;
  bin_top_sizes: Array<{ size: string; count: number }>;
  bin_heights: Record<number, number>;

  // Layers summary
  layer_count: number;
  layer_heights: number[];
  layer_total_height: number;

  // Categories summary
  category_count: number;
  custom_category_count: number;
  top_categories: Array<{ name: string; count: number }>;

  // Feature flags
  feature_multi_layer: boolean;
  feature_half_bins: boolean;
  feature_clearance: boolean;
  feature_custom_categories: boolean;
  feature_labels: boolean;
  feature_notes: boolean;
  feature_custom_drawer: boolean;
  feature_custom_print_bed: boolean;
  feature_asymmetric_bed: boolean;

  // Print readiness
  has_oversized_bins: boolean;
  max_bin_width: number;
  max_bin_depth: number;

  // Engagement
  is_engaged: boolean;
  is_substantial: boolean;
}

// METRICS COMPUTATION

export const DEFAULT_DRAWER = { width: 10, depth: 8, height: 12 };
export const DEFAULT_PRINT_BED = 256;
export const DEFAULT_CATEGORY_NAMES = new Set(DEFAULT_CATEGORIES.map((c) => c.name.toLowerCase()));

export function computeLayoutMetrics(layout: Layout): LayoutMetrics {
  const { gridBins, stagingBins } = splitBinsByLocation(layout.bins);

  // Bin size distribution
  const sizeCount = new Map<string, number>();
  const heightCount = new Map<number, number>();
  let totalArea = 0;
  let withLabels = 0;
  let withNotes = 0;
  let withClearance = 0;
  let withHalfUnits = 0;
  let maxWidth = 0;
  let maxDepth = 0;

  for (const bin of gridBins) {
    // Size tracking
    const sizeKey = `${bin.width}x${bin.depth}`;
    sizeCount.set(sizeKey, (sizeCount.get(sizeKey) || 0) + 1);

    // Height tracking
    heightCount.set(bin.height, (heightCount.get(bin.height) || 0) + 1);

    // Area
    totalArea += bin.width * bin.depth;

    // Feature detection
    if (bin.label.trim()) withLabels++;
    if (bin.notes.trim()) withNotes++;
    if (bin.clearanceHeight && bin.clearanceHeight > 0) withClearance++;
    if (hasFractionalDimensions(bin)) withHalfUnits++;

    // Max dimensions for print check
    maxWidth = Math.max(maxWidth, bin.width);
    maxDepth = Math.max(maxDepth, bin.depth);
  }

  // Top 5 sizes
  const topSizes = [...sizeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([size, count]) => ({ size, count }));

  // Height distribution
  const heights: Record<number, number> = {};
  for (const [h, c] of heightCount) {
    heights[h] = c;
  }

  // Category distribution
  const categoryCount = new Map<string, number>();
  for (const bin of gridBins) {
    categoryCount.set(bin.category, (categoryCount.get(bin.category) || 0) + 1);
  }

  const categoryIdToName = new Map(layout.categories.map((c) => [c.id, c.name]));
  const topCategories = [...categoryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ name: categoryIdToName.get(id as CategoryId) || 'Unknown', count }));

  // Custom categories (not matching default names)
  const customCategoryCount = layout.categories.filter(
    (c) => !DEFAULT_CATEGORY_NAMES.has(c.name.toLowerCase())
  ).length;

  // Print bed check
  const printBedDepth = layout.printBedDepth ?? layout.printBedSize;
  const maxGrid = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm, printBedDepth);
  const hasOversizedBins = maxWidth > maxGrid.width || maxDepth > maxGrid.depth;

  // Drawer defaults check
  const isDefaultDrawer =
    layout.drawer.width === DEFAULT_DRAWER.width &&
    layout.drawer.depth === DEFAULT_DRAWER.depth &&
    layout.drawer.height === DEFAULT_DRAWER.height;

  return {
    // Drawer
    drawer_width: layout.drawer.width,
    drawer_depth: layout.drawer.depth,
    drawer_height: layout.drawer.height,
    grid_unit_mm: layout.gridUnitMm,
    height_unit_mm: layout.heightUnitMm,
    print_bed_size: layout.printBedSize,
    print_bed_depth: printBedDepth,
    drawer_is_default: isDefaultDrawer,

    // Bins
    bin_count: layout.bins.length,
    bins_on_grid: gridBins.length,
    bins_in_staging: stagingBins.length,
    bins_with_labels: withLabels,
    bins_with_notes: withNotes,
    bins_with_clearance: withClearance,
    bins_with_half_units: withHalfUnits,
    bin_avg_area: gridBins.length > 0 ? Math.round((totalArea / gridBins.length) * 10) / 10 : 0,
    bin_top_sizes: topSizes,
    bin_heights: heights,

    // Layers
    layer_count: layout.layers.length,
    layer_heights: layout.layers.map((l) => l.height),
    layer_total_height: layout.layers.reduce((sum, l) => sum + l.height, 0),

    // Categories
    category_count: layout.categories.length,
    custom_category_count: customCategoryCount,
    top_categories: topCategories,

    // Features
    feature_multi_layer: layout.layers.length > 1,
    feature_half_bins: withHalfUnits > 0,
    feature_clearance: withClearance > 0,
    feature_custom_categories: customCategoryCount > 0,
    feature_labels: withLabels > 0,
    feature_notes: withNotes > 0,
    feature_custom_drawer: !isDefaultDrawer,
    feature_custom_print_bed: layout.printBedSize !== DEFAULT_PRINT_BED,
    feature_asymmetric_bed: printBedDepth !== layout.printBedSize,

    // Print
    has_oversized_bins: hasOversizedBins,
    max_bin_width: maxWidth,
    max_bin_depth: maxDepth,

    // Engagement
    is_engaged: gridBins.length >= 5,
    is_substantial: gridBins.length >= 15,
  };
}
