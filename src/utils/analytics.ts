/**
 * Analytics utilities for tracking layout metrics via Posthog.
 * Derives all metrics from the existing Layout type - no parallel tracking needed.
 * Posthog is lazy-loaded to avoid impacting initial bundle size.
 *
 * Features:
 * - Event tracking with layout context
 * - Error tracking with automatic exception capture
 * - Person properties for user identification
 * - Session replay integration (configured via PostHog dashboard)
 */

import type { PostHog } from 'posthog-js';
import type { Layout } from '@/core/types';
import {
  STAGING_ID,
  DEFAULT_CATEGORIES,
  calcMaxGridUnits,
  hasFractionalDimensions,
  BREAKPOINTS,
} from '@/core/constants';
import { useLabsStore, useInteractionStore, useLayoutStore, useSettingsStore } from '@/core/store';
import { getFeature } from '@/core/labs';
import { generateUUID } from '@/shared/utils';

// ============================================
// STABLE USER IDENTITY
// ============================================

const USER_ID_KEY = 'gridfinity_user_id';
const USER_FIRST_SEEN_KEY = 'gridfinity_first_seen';

/**
 * Get or create a stable user ID for anonymous users.
 * This persists across sessions within the same browser.
 * Falls back to a session-only UUID if localStorage is unavailable.
 */
function getStableUserId(): string {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(USER_ID_KEY, id);
      localStorage.setItem(USER_FIRST_SEEN_KEY, new Date().toISOString());
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.)
    // Fall back to a session-only ID
    return generateUUID();
  }
}

/**
 * Get the date this user was first seen.
 * Persists a generated timestamp if missing, to keep it stable across sessions.
 */
function getFirstSeenDate(): string {
  try {
    let firstSeen = localStorage.getItem(USER_FIRST_SEEN_KEY);
    if (!firstSeen) {
      firstSeen = new Date().toISOString();
      localStorage.setItem(USER_FIRST_SEEN_KEY, firstSeen);
    }
    return firstSeen;
  } catch {
    return new Date().toISOString();
  }
}

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

  // Check if analytics is enabled in settings
  const { analyticsEnabled } = useSettingsStore.getState().settings;
  if (!analyticsEnabled) return;

  const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

  if (!key) {
    console.warn('Posthog API key not set, analytics disabled');
    return;
  }

  // Lazy load posthog-js
  initPromise = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: '/ph',
        ui_host: 'https://us.posthog.com',
        capture_pageview: false, // Manual pageview - auto mode fires on every replaceState
        capture_pageleave: true,
        persistence: 'localStorage',
        autocapture: false, // We'll track specific events manually

        // Error tracking - auto-capture exceptions
        capture_exceptions: true,

        // Performance monitoring - web vitals
        capture_performance: true,
      });
      posthogInstance = posthog;

      // Fire a single pageview on app load
      posthog.capture('$pageview');

      // Identify user with stable ID for person properties & cohorts
      const userId = getStableUserId();
      posthog.identify(userId);

      // Set person properties (these persist across sessions)
      updatePersonProperties();

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
 * Opt out of analytics tracking.
 * Called when user disables analytics in settings.
 */
export function optOutAnalytics(): void {
  if (posthogInstance) {
    posthogInstance.opt_out_capturing();
  }
}

/**
 * Opt back into analytics tracking.
 * Called when user re-enables analytics in settings.
 */
export function optInAnalytics(): void {
  if (posthogInstance) {
    posthogInstance.opt_in_capturing();
  } else {
    // If posthog wasn't initialized, try to initialize now
    initPromise = null;
    initAnalytics();
  }
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
// LABS METRICS
// ============================================

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
const DEFAULT_CATEGORY_NAMES = new Set(DEFAULT_CATEGORIES.map((c) => c.name.toLowerCase()));

export function computeLayoutMetrics(layout: Layout): LayoutMetrics {
  const gridBins = layout.bins.filter((b) => b.layerId !== STAGING_ID);
  const stagingBins = layout.bins.filter((b) => b.layerId === STAGING_ID);

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

  const categoryIdToName = new Map(layout.categories.map((c) => [c.id, c.name]));
  const topCategories = [...categoryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ name: categoryIdToName.get(id) || 'Unknown', count }));

  // Custom categories (not matching default names)
  const customCategoryCount = layout.categories.filter(
    (c) => !DEFAULT_CATEGORY_NAMES.has(c.name.toLowerCase())
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

export type AnalyticsTrigger = 'export_json' | 'export_url' | 'export_tsv' | 'session_engaged';

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
    const labsMetrics = computeLabsMetrics();

    // Skip non-engaged users on session end (noise filter)
    if (!metrics.is_engaged && trigger === 'session_engaged') {
      return;
    }

    capture('layout_snapshot', {
      trigger,
      device_type: getDeviceType(),
      ...metrics,
      ...labsMetrics,
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
export function track3DPreview(
  action: 'opened' | 'expanded' | 'camera_preset',
  preset?: string
): void {
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
 * Updates person properties to track feature adoption.
 */
export function trackFillOperation(type: 'fill_layer' | 'fill_gaps', binCount: number): void {
  trackEvent('fill_operation', { type, bin_count: binCount });
  markFeatureUsed('fill');
}

/**
 * Track paint mode usage.
 * Updates person properties to track feature adoption.
 */
export function trackPaintMode(action: 'entered' | 'exited', binsCreated?: number): void {
  trackEvent('paint_mode', { action, bins_created: binsCreated || 0 });
  if (action === 'entered') {
    markFeatureUsed('paint_mode');
  }
}

/**
 * Track bin creation events.
 * Called when bins are created via draw, paint, or fill operations.
 */
export function trackBinCreated(
  method: 'draw' | 'paint' | 'fill_layer' | 'fill_gaps' | 'import' | 'duplicate',
  count: number = 1,
  size?: { width: number; depth: number; height: number }
): void {
  trackEvent('bin_created', {
    method,
    count,
    ...(size ? { size: `${size.width}x${size.depth}x${size.height}` } : {}),
  });
  checkEngagementMilestones();
}

const MILESTONE_THRESHOLDS: Array<{ key: 'first_bin' | 'engaged' | 'substantial'; min: number }> = [
  { key: 'first_bin', min: 1 },
  { key: 'engaged', min: 5 },
  { key: 'substantial', min: 15 },
];

/**
 * Check if the current bin count crosses any engagement milestone thresholds.
 * Uses localStorage to ensure each milestone fires only once per user.
 */
function checkEngagementMilestones(): void {
  try {
    const bins = useLayoutStore.getState().layout.bins;
    const binsOnGrid = bins.filter((b) => b.layerId !== STAGING_ID).length;

    for (const { key, min } of MILESTONE_THRESHOLDS) {
      const storageKey = `gridfinity_milestone_${key}`;
      if (binsOnGrid >= min && !localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, new Date().toISOString());
        trackEngagementMilestone(key);
      }
    }
  } catch {
    // Silently ignore - analytics should never break the app
  }
}

/**
 * Track when a user reaches an engagement milestone.
 * Called automatically when bin count thresholds are crossed.
 */
export function trackEngagementMilestone(milestone: 'first_bin' | 'engaged' | 'substantial'): void {
  trackEvent('engagement_milestone', { milestone });
  // Also update person properties when milestones are reached
  updatePersonProperties();
}

// ============================================
// ACTIVITY CONTEXT (for Vercel heartbeat)
// ============================================

export type ActivityContext = 'drawing' | 'editing' | 'viewing';

/**
 * Derive current activity context from interaction store state.
 * Used for Vercel Analytics heartbeat to show what users are doing.
 */
export function getActivityContext(): ActivityContext {
  const { interaction, paintSize, keyboardDragMode, keyboardResizeMode } =
    useInteractionStore.getState();

  // Drawing: creating new bins (draw mode or paint mode)
  if (interaction?.type === 'draw' || interaction?.type === 'paint' || paintSize !== null) {
    return 'drawing';
  }

  // Editing: modifying existing bins
  if (
    interaction?.type === 'drag' ||
    interaction?.type === 'resize' ||
    interaction?.type === 'stagingDrag' ||
    keyboardDragMode ||
    keyboardResizeMode
  ) {
    return 'editing';
  }

  return 'viewing';
}

// ============================================
// PERSON PROPERTIES (for cohorts & targeting)
// ============================================

/**
 * Compute the engagement tier based on usage patterns.
 */
function computeEngagementTier(layoutCount: number, totalBins: number): 'new' | 'active' | 'power' {
  if (layoutCount >= 5 || totalBins >= 100) return 'power';
  if (layoutCount >= 2 || totalBins >= 20) return 'active';
  return 'new';
}

/**
 * Update person properties in PostHog.
 * Call this after significant actions to keep user profile up-to-date.
 */
export function updatePersonProperties(): void {
  if (!posthogInstance) return;

  try {
    // Get library data for usage metrics
    const libraryData = localStorage.getItem('gridfinity-library-v1');
    const library = libraryData ? JSON.parse(libraryData) : null;
    const layoutCount = library?.entries?.length ?? 0;

    // Get current layout for feature detection
    const layout = useLayoutStore.getState().layout;
    const metrics = computeLayoutMetrics(layout);

    // Compute cumulative bins (rough estimate from current + saved layouts)
    const currentBins = layout.bins.length;
    const savedBinsEstimate = layoutCount * 10; // Rough average
    const totalBinsEstimate = currentBins + savedBinsEstimate;

    // Properties that can change ($set)
    posthogInstance.setPersonProperties({
      // Usage metrics
      layout_count: layoutCount,
      total_bins_estimate: totalBinsEstimate,
      last_active: new Date().toISOString(),

      // Feature adoption (has ever used)
      uses_multi_layer:
        metrics.feature_multi_layer || localStorage.getItem('has_used_multi_layer') === 'true',
      uses_half_bins:
        metrics.feature_half_bins || localStorage.getItem('has_used_half_bins') === 'true',
      uses_custom_categories:
        metrics.feature_custom_categories ||
        localStorage.getItem('has_used_custom_categories') === 'true',
      uses_labels: metrics.feature_labels || localStorage.getItem('has_used_labels') === 'true',
      uses_3d_preview: localStorage.getItem('has_used_3d_preview') === 'true',
      uses_cloud_share: localStorage.getItem('has_used_cloud_share') === 'true',
      uses_fill_operations: localStorage.getItem('has_used_fill') === 'true',
      uses_paint_mode: localStorage.getItem('has_used_paint_mode') === 'true',

      // Engagement tier
      engagement_tier: computeEngagementTier(layoutCount, totalBinsEstimate),

      // Device preference
      primary_device: getDeviceType(),
    });

    // Properties set only once ($set_once) - immutable user traits
    posthogInstance.setPersonPropertiesForFlags({
      first_seen: getFirstSeenDate(),
      initial_referrer: document.referrer || 'direct',
      initial_device: getDeviceType(),
    });

    // Track feature adoption in localStorage for persistence
    if (metrics.feature_multi_layer) localStorage.setItem('has_used_multi_layer', 'true');
    if (metrics.feature_half_bins) localStorage.setItem('has_used_half_bins', 'true');
    if (metrics.feature_custom_categories)
      localStorage.setItem('has_used_custom_categories', 'true');
    if (metrics.feature_labels) localStorage.setItem('has_used_labels', 'true');
  } catch {
    // Never break the app for analytics
  }
}

/**
 * Mark a feature as used (for adoption tracking).
 */
export function markFeatureUsed(
  feature:
    | 'multi_layer'
    | 'half_bins'
    | 'custom_categories'
    | 'labels'
    | '3d_preview'
    | 'cloud_share'
    | 'fill'
    | 'paint_mode'
): void {
  try {
    localStorage.setItem(`has_used_${feature}`, 'true');
  } catch {
    // Ignore storage errors
  }
  updatePersonProperties();
}

// ============================================
// ERROR CONTEXT (enriches error tracking)
// ============================================

/**
 * Get current layout context for error enrichment.
 * This helps debug errors by showing what the user was doing.
 */
export function getLayoutContext(): Record<string, unknown> {
  try {
    const layout = useLayoutStore.getState().layout;
    const { interaction } = useInteractionStore.getState();

    return {
      drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
      bin_count: layout.bins.length,
      layer_count: layout.layers.length,
      category_count: layout.categories.length,
      active_interaction: interaction?.type ?? 'none',
      device_type: getDeviceType(),
    };
  } catch {
    return { context_error: 'Failed to get layout context' };
  }
}

/**
 * Capture an exception with layout context.
 * Use this for caught errors that you want to track.
 */
export function captureException(error: Error, additionalContext?: Record<string, unknown>): void {
  if (!posthogInstance) return;

  try {
    posthogInstance.capture('$exception', {
      $exception_message: error.message,
      $exception_type: error.name,
      $exception_stack_trace_raw: error.stack,
      ...getLayoutContext(),
      ...additionalContext,
    });
  } catch {
    // Never break the app for analytics
  }
}

// ============================================
// POSTHOG INSTANCE ACCESS (for advanced usage)
// ============================================

/**
 * Get the PostHog instance for advanced operations.
 * Returns null if PostHog isn't initialized.
 */
export function getPostHogInstance(): PostHog | null {
  return posthogInstance;
}
