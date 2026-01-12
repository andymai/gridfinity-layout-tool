/**
 * Analytics utilities for tracking layout metrics via Posthog.
 * Derives all metrics from the existing Layout type - no parallel tracking needed.
 * Posthog is lazy-loaded to avoid impacting initial bundle size.
 */

import type { PostHog } from 'posthog-js';
import type { Layout } from '../types';
import { STAGING_ID, DEFAULT_CATEGORIES, calcMaxGridUnits, hasFractionalDimensions, BREAKPOINTS } from '../constants';

// ============================================
// INITIALIZATION (LAZY LOADED)
// ============================================

let posthogInstance: PostHog | null = null;
let initPromise: Promise<void> | null = null;
let eventQueue: Array<{ name: string; properties: Record<string, unknown> }> = [];

export function initAnalytics(): void {
  if (initPromise) return;
  if (typeof window === 'undefined') return;
  if (import.meta.env.DEV) return; // Skip in development

  const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

  if (!key || !host) {
    console.warn('Posthog env vars not set, analytics disabled');
    return;
  }

  // Lazy load posthog-js
  initPromise = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        capture_pageview: false, // Vercel Analytics handles this
        persistence: 'localStorage',
        autocapture: false, // We'll track manually
      });
      posthogInstance = posthog;

      // Track app load for DAU metrics
      posthog.capture('app_loaded', {
        device_type: getDeviceType(),
        is_returning: Boolean(localStorage.getItem('gridfinity-library-v1')),
      });

      // Flush queued events
      for (const event of eventQueue) {
        posthog.capture(event.name, event.properties);
      }
      eventQueue = [];
    })
    .catch(() => {
      // Fail silently
    });
}

/**
 * Internal capture function that queues events if posthog isn't ready yet.
 */
function capture(name: string, properties: Record<string, unknown>): void {
  if (posthogInstance) {
    posthogInstance.capture(name, properties);
  } else if (initPromise) {
    // Queue event to be sent when posthog loads
    eventQueue.push({ name, properties });
  }
  // If no initPromise, analytics is disabled (dev mode or missing env vars)
}

// ============================================
// METRICS TYPES
// ============================================

export interface LayoutMetrics {
  // Drawer configuration
  drawer_width: number;
  drawer_depth: number;
  drawer_height: number;
  grid_unit_mm: number;
  height_unit_mm: number;
  print_bed_size: number;
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

  // Print readiness
  has_oversized_bins: boolean;
  max_bin_width: number;
  max_bin_depth: number;

  // Engagement
  is_engaged: boolean;
  is_substantial: boolean;
}

// ============================================
// METRICS COMPUTATION
// ============================================

const DEFAULT_DRAWER = { width: 10, depth: 8, height: 12 };
const DEFAULT_PRINT_BED = 256;
const DEFAULT_CATEGORY_NAMES = new Set(DEFAULT_CATEGORIES.map(c => c.name.toLowerCase()));

export function computeLayoutMetrics(layout: Layout): LayoutMetrics {
  const gridBins = layout.bins.filter(b => b.layerId !== STAGING_ID);
  const stagingBins = layout.bins.filter(b => b.layerId === STAGING_ID);

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
    if (bin.label?.trim()) withLabels++;
    if (bin.notes?.trim()) withNotes++;
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

  const categoryIdToName = new Map(layout.categories.map(c => [c.id, c.name]));
  const topCategories = [...categoryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ name: categoryIdToName.get(id) || 'Unknown', count }));

  // Custom categories (not matching default names)
  const customCategoryCount = layout.categories.filter(
    c => !DEFAULT_CATEGORY_NAMES.has(c.name.toLowerCase())
  ).length;

  // Print bed check
  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
  const hasOversizedBins = maxWidth > maxGridUnits || maxDepth > maxGridUnits;

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
    drawer_is_default: isDefaultDrawer,

    // Bins
    bin_count: layout.bins.length,
    bins_on_grid: gridBins.length,
    bins_in_staging: stagingBins.length,
    bins_with_labels: withLabels,
    bins_with_notes: withNotes,
    bins_with_clearance: withClearance,
    bins_with_half_units: withHalfUnits,
    bin_avg_area: gridBins.length > 0 ? Math.round(totalArea / gridBins.length * 10) / 10 : 0,
    bin_top_sizes: topSizes,
    bin_heights: heights,

    // Layers
    layer_count: layout.layers.length,
    layer_heights: layout.layers.map(l => l.height),
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

    // Print
    has_oversized_bins: hasOversizedBins,
    max_bin_width: maxWidth,
    max_bin_depth: maxDepth,

    // Engagement
    is_engaged: gridBins.length >= 5,
    is_substantial: gridBins.length >= 15,
  };
}

// ============================================
// TRACKING FUNCTIONS
// ============================================

export type AnalyticsTrigger =
  | 'export_json'
  | 'export_url'
  | 'export_tsv'
  | 'session_engaged';

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < BREAKPOINTS.MD) return 'mobile';
  if (width < BREAKPOINTS.LG) return 'tablet';
  return 'desktop';
}

/**
 * Track a comprehensive layout snapshot.
 * Called on exports and engaged session end.
 */
export function trackLayoutSnapshot(
  layout: Layout,
  trigger: AnalyticsTrigger,
  sessionContext?: { duration_seconds: number }
): void {
  try {
    const metrics = computeLayoutMetrics(layout);

    // Skip non-engaged users on session end (noise filter)
    if (!metrics.is_engaged && trigger === 'session_engaged') {
      return;
    }

    capture('layout_snapshot', {
      trigger,
      device_type: getDeviceType(),
      ...metrics,
      ...(sessionContext || {}),
    });
  } catch {
    // Analytics should never break the app
  }
}

/**
 * Track a discrete event (feature usage, actions).
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): void {
  try {
    capture(name, {
      device_type: getDeviceType(),
      ...properties,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Track 3D preview usage.
 */
export function track3DPreview(action: 'opened' | 'expanded' | 'camera_preset', preset?: string): void {
  trackEvent('3d_preview', { action, preset: preset || '' });
}

/**
 * Track layout management actions.
 */
export function trackLayoutAction(
  action: 'created' | 'switched' | 'deleted' | 'duplicated' | 'imported' | 'renamed',
  source?: string
): void {
  trackEvent('layout_action', { action, source: source || '' });
}

/**
 * Track fill operations.
 */
export function trackFillOperation(type: 'fill_layer' | 'fill_gaps', binCount: number): void {
  trackEvent('fill_operation', { type, bin_count: binCount });
}

/**
 * Track paint mode usage.
 */
export function trackPaintMode(action: 'entered' | 'exited', binsCreated?: number): void {
  trackEvent('paint_mode', { action, bins_created: binsCreated || 0 });
}
