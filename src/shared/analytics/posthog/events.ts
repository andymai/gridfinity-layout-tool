/**
 * Analytics event tracking functions, milestones, and person properties.
 * Contains all 20+ tracking functions for PostHog events.
 */

import type { Layout } from '@/core/types';
import { useInteractionStore } from '@/core/store/interaction';
import type { LayerViewMode } from '@/core/store/view';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useViewStore } from '@/core/store/view';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { splitBinsByLocation, getGridBins } from '@/shared/utils';
import { isFirstSession, loadAnalyticsData, saveAnalyticsData, getFirstSeenDate } from './identity';
import { capture, getPosthogInstance } from './init';
import { computeLayoutMetrics, computeLabsMetrics } from './metrics';
import { getDeviceType, trackEvent } from './trackEvent';

// Re-export so callers using the barrel keep working
export { getDeviceType, trackEvent };

// TRACKING FUNCTIONS

export type AnalyticsTrigger = 'export_json' | 'export_url' | 'export_tsv' | 'session_engaged';

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
      is_first_session: isFirstSession(),
      ...metrics,
      ...labsMetrics,
      ...sessionContext,
    });
  } catch {
    // Analytics should never break the app
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
 * Properties for tracking bin creation events.
 */
export interface BinCreatedProperties {
  method: 'draw' | 'paint' | 'fill_layer' | 'fill_gaps' | 'import' | 'duplicate';
  count: number;
  width?: number;
  depth?: number;
  height?: number;
  from_template_id?: string | null;
}

/**
 * Track bin creation events with enriched context.
 * Called when bins are created via draw, paint, fill, duplicate, or import operations.
 */
export function trackBinCreated(props: BinCreatedProperties): void {
  try {
    const isFirstBin = !loadAnalyticsData().milestones['first_bin'];
    const hasDimensions =
      props.width !== undefined && props.depth !== undefined && props.height !== undefined;

    trackEvent('bin_created', {
      method: props.method,
      count: props.count,
      is_first_bin: isFirstBin,
      is_first_session: isFirstSession(),
      ...(hasDimensions
        ? {
            size: `${props.width}x${props.depth}x${props.height}`,
            bin_width: props.width as number,
            bin_depth: props.depth as number,
            bin_height: props.height as number,
          }
        : {}),
      from_template_id: props.from_template_id ?? null,
    });
    checkEngagementMilestones();
  } catch {
    // Fail silently
  }
}

export const MILESTONE_THRESHOLDS: Array<{
  key: 'first_bin' | 'engaged' | 'substantial' | 'power_user';
  min: number;
}> = [
  { key: 'first_bin', min: 1 },
  { key: 'engaged', min: 5 },
  { key: 'substantial', min: 15 },
  { key: 'power_user', min: 30 },
];

/**
 * Check if the current bin count crosses any engagement milestone thresholds.
 * Uses localStorage to ensure each milestone fires only once per user.
 */
function checkEngagementMilestones(): void {
  try {
    const bins = useLayoutStore.getState().layout.bins;
    const binsOnGrid = getGridBins(bins).length;
    const data = loadAnalyticsData();
    let changed = false;

    for (const { key, min } of MILESTONE_THRESHOLDS) {
      if (binsOnGrid >= min && !data.milestones[key]) {
        data.milestones[key] = new Date().toISOString();
        changed = true;
        trackEvent('engagement_milestone', { milestone: key });
        updatePersonProperties();
      }
    }

    if (changed) {
      saveAnalyticsData(data);
    }
  } catch {
    // Silently ignore - analytics should never break the app
  }
}

// ACTIVITY CONTEXT (for PostHog heartbeat)

export type ActivityContext = 'drawing' | 'editing' | 'viewing';

/**
 * Derive current activity context from interaction store state.
 * Used for PostHog heartbeat to show what users are doing.
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

// HEARTBEAT PAYLOAD

export interface HeartbeatPayload {
  // Engagement
  context: ActivityContext;
  session_minutes: number;
  // Layout complexity
  bin_count: number;
  bins_in_staging: number;
  layer_count: number;
  category_count: number;
  grid_utilization: number; // 0-1 fraction
  drawer_width: number;
  drawer_depth: number;
  // Feature usage
  half_bin_mode: boolean;
  layer_view_mode: LayerViewMode;
  is_3d_preview_open: boolean;
  is_preview_expanded: boolean;
  paint_mode_active: boolean;
  left_panel_collapsed: boolean;
  right_panel_collapsed: boolean;
}

/**
 * Build a heartbeat payload from current store state.
 * Reads from multiple stores via getState() (outside React).
 */
export function buildHeartbeatPayload(sessionMinutes: number): HeartbeatPayload {
  const { bins, layers, categories, drawer } = useLayoutStore.getState().layout;
  const interaction = useInteractionStore.getState();
  const view = useViewStore.getState();
  const { halfBinMode } = useHalfBinModeStore.getState();

  const { gridBins, stagingBins } = splitBinsByLocation(bins);

  // Grid utilization: occupied area / total drawer area
  const drawerArea = drawer.width * drawer.depth;
  const occupiedArea = gridBins.reduce((sum, bin) => sum + bin.width * bin.depth, 0);
  const gridUtilization = drawerArea > 0 ? Math.round((occupiedArea / drawerArea) * 100) / 100 : 0;

  return {
    context: getActivityContext(),
    session_minutes: sessionMinutes,
    bin_count: bins.length,
    bins_in_staging: stagingBins.length,
    layer_count: layers.length,
    category_count: categories.length,
    grid_utilization: gridUtilization,
    drawer_width: drawer.width,
    drawer_depth: drawer.depth,
    half_bin_mode: halfBinMode,
    layer_view_mode: view.layerViewMode,
    is_3d_preview_open: view.showIsometricPreview,
    is_preview_expanded: view.isPreviewExpanded,
    paint_mode_active: interaction.paintSize !== null,
    left_panel_collapsed: view.leftPanelCollapsed,
    right_panel_collapsed: view.rightPanelCollapsed,
  };
}

/**
 * Track a heartbeat event via PostHog.
 * Sends engagement depth, feature usage, and layout complexity.
 */
export function trackHeartbeat(sessionMinutes: number): void {
  try {
    const payload = buildHeartbeatPayload(sessionMinutes);
    capture('heartbeat', {
      device_type: getDeviceType(),
      ...payload,
    });
  } catch {
    // Analytics should never break the app
  }
}

// PERSON PROPERTIES (for cohorts & targeting)

/**
 * Compute the engagement tier based on usage patterns.
 */
export function computeEngagementTier(
  layoutCount: number,
  totalBins: number
): 'new' | 'active' | 'power' {
  if (layoutCount >= 5 || totalBins >= 100) return 'power';
  if (layoutCount >= 2 || totalBins >= 20) return 'active';
  return 'new';
}

/**
 * Update person properties in PostHog.
 * Call this after significant actions to keep user profile up-to-date.
 */
export function updatePersonProperties(): void {
  const posthogInstance = getPosthogInstance();
  if (!posthogInstance) return;

  try {
    // Get library data for usage metrics
    const libraryEntries = useLibraryStore.getState().library.entries;
    const layoutCount = libraryEntries.length;

    // Get current layout for feature detection
    const layout = useLayoutStore.getState().layout;
    const metrics = computeLayoutMetrics(layout);

    // Compute cumulative bins (rough estimate from current + saved layouts)
    const currentBins = layout.bins.length;
    const savedBinsEstimate = layoutCount * 10; // Rough average
    const totalBinsEstimate = currentBins + savedBinsEstimate;

    const data = loadAnalyticsData();
    const flags = data.featureFlags;

    // Properties that can change ($set)
    posthogInstance.setPersonProperties({
      // Usage metrics
      layout_count: layoutCount,
      total_bins_estimate: totalBinsEstimate,
      last_active: new Date().toISOString(),

      // Feature adoption (has ever used)
      uses_multi_layer: metrics.feature_multi_layer || flags['multi_layer'],
      uses_half_bins: metrics.feature_half_bins || flags['half_bins'],
      uses_custom_categories: metrics.feature_custom_categories || flags['custom_categories'],
      uses_labels: metrics.feature_labels || flags['labels'],
      uses_3d_preview: flags['3d_preview'],
      uses_cloud_share: flags['cloud_share'],
      uses_fill_operations: flags['fill'],
      uses_paint_mode: flags['paint_mode'],

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

    // Track feature adoption in consolidated storage for persistence
    const adoptionChecks: Array<[boolean, string]> = [
      [metrics.feature_multi_layer, 'multi_layer'],
      [metrics.feature_half_bins, 'half_bins'],
      [metrics.feature_custom_categories, 'custom_categories'],
      [metrics.feature_labels, 'labels'],
    ];

    let flagsChanged = false;
    for (const [isActive, key] of adoptionChecks) {
      if (isActive && !flags[key]) {
        flags[key] = true;
        flagsChanged = true;
      }
    }
    if (flagsChanged) {
      saveAnalyticsData(data);
    }
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
    | 'pwa_installed'
): void {
  try {
    const data = loadAnalyticsData();
    if (data.featureFlags[feature]) return; // Already tracked
    data.featureFlags[feature] = true;
    saveAnalyticsData(data);
  } catch {
    // best-effort
  }
  updatePersonProperties();
}

// ERROR CONTEXT (enriches error tracking)

/**
 * Get current layout context for error enrichment.
 * This helps debug errors by showing what the user was doing.
 */
function getLayoutContext(): Record<string, unknown> {
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
  const posthogInstance = getPosthogInstance();
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

// FAILURE TRACKING

/**
 * Track layout save failures.
 * Called when auto-save fails to persist layout data.
 */
export function trackLayoutSaveFailure(
  errorCode: string,
  errorMessage: string,
  failureCount: number
): void {
  trackEvent('layout_save_failure', {
    error_code: errorCode,
    error_message: errorMessage,
    failure_count: failureCount,
  });
}

/**
 * Track cloud share failures.
 * Called when share create/update/delete fails.
 */
export function trackShareFailure(errorCode: string, errorMessage: string): void {
  trackEvent('share_failure', {
    error_code: errorCode,
    error_message: errorMessage,
  });
}

/**
 * Track 3D rendering or component errors.
 * Called from error boundaries when a panel/component crashes.
 */
export function track3DRenderError(component: string, errorMessage: string): void {
  trackEvent('3d_render_error', {
    component,
    error_message: errorMessage,
  });
}

/**
 * Track template load failures from the inspiration gallery.
 */
export function trackTemplateLoadError(templateId: string, errorMessage: string): void {
  trackEvent('template_load_error', {
    template_id: templateId,
    error_message: errorMessage,
  });
}

// WASM THREADING TRACKING

/**
 * Track WASM threading status when generation bridge initializes.
 * This helps understand hardware capabilities across our user base.
 */
export function trackWasmThreadingStatus(isThreaded: boolean, hardwareConcurrency: number): void {
  trackEvent('wasm_threading_status', {
    is_threaded: isThreaded,
    hardware_concurrency: hardwareConcurrency,
  });
}

// CACHE PERFORMANCE TRACKING

/**
 * Track generation cache performance for capacity planning.
 * Called after each geometry generation with per-generation hit/miss/eviction deltas.
 */
export function trackCachePerformance(stats: {
  total_hits: number;
  total_misses: number;
  total_evictions: number;
  hit_rate: number;
  cache_count: number;
}): void {
  trackEvent('generation_cache_stats', {
    total_hits: stats.total_hits,
    total_misses: stats.total_misses,
    total_evictions: stats.total_evictions,
    hit_rate: stats.hit_rate,
    cache_count: stats.cache_count,
  });
}

// KERNEL PERFORMANCE TRACKING

const toSnakeCase = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/**
 * Track brepjs kernel operation timing for performance monitoring.
 * Called after each geometry generation with per-category timing breakdown.
 */
export function trackKernelPerformance(payload: {
  stats: Readonly<Record<string, { totalMs: number; count: number }>>;
}): void {
  // Flatten stats into snake_case properties: boolean_ms, edge_mesh_count, etc.
  const properties: Record<string, number> = {};
  for (const [category, { totalMs, count }] of Object.entries(payload.stats)) {
    if (count > 0) {
      const key = toSnakeCase(category);
      properties[`${key}_ms`] = Math.round(totalMs * 10) / 10;
      properties[`${key}_count`] = count;
    }
  }
  if (Object.keys(properties).length > 0) {
    trackEvent('generation_kernel_perf', properties);
  }
}

// BASEPLATE PREVIEW TIMING

/**
 * Track time-to-first-mesh (direct-mesh placeholder) and time-to-final-mesh
 * (BREP) for the baseplate page. Lets us validate the perceived-perf win
 * post-launch and catch regressions if the direct-mesh path stalls.
 *
 * `directMeshMs` is the synchronous procedural path (~50-200 ms typical).
 * `brepMs` is the WASM BREP path (~1-3 s warm, +2-4 s cold for WASM init).
 * `pieceCount` is 1 for unsplit baseplates; >1 for split tilings.
 * `success` distinguishes completed BREP from errored/timed-out runs so
 * failures are visible in PostHog dashboards.
 */
export function trackBaseplatePreviewTiming(payload: {
  directMeshMs: number;
  brepMs: number;
  pieceCount: number;
  isSplit: boolean;
  wasmCold: boolean;
  success: boolean;
}): void {
  trackEvent('baseplate_preview_timing', {
    direct_mesh_ms: Math.round(payload.directMeshMs * 10) / 10,
    brep_ms: Math.round(payload.brepMs * 10) / 10,
    piece_count: payload.pieceCount,
    is_split: payload.isSplit,
    wasm_cold: payload.wasmCold,
    success: payload.success,
  });
}

// BIN EXPORT TRACKING — see ./binExportEvents.ts for trackBinExportSucceeded
// and trackBinExportFailure. Split out to keep this file under the line cap.

// PWA INSTALL TRACKING

/**
 * Track PWA app installation via the `appinstalled` browser event.
 * Call once from the app shell — the listener fires at most once per install.
 */
export function listenForPwaInstall(): void {
  try {
    window.addEventListener(
      'appinstalled',
      () => {
        trackEvent('pwa_installed', {
          is_first_session: isFirstSession(),
        });
        markFeatureUsed('pwa_installed');
      },
      { once: true }
    );
  } catch {
    // Fail silently
  }
}

// UTM PARAMETER TRACKING

/**
 * Parse UTM parameters from the current URL and set them as
 * once-only person properties in PostHog (first-touch attribution).
 * Strips UTM params from the URL after capture to keep it clean.
 */
export function captureUtmParameters(): void {
  try {
    const url = new URL(window.location.href);
    const utmKeys = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
    ] as const;
    const params: Record<string, string> = {};
    let hasUtm = false;

    for (const key of utmKeys) {
      const value = url.searchParams.get(key);
      if (value) {
        params[key] = value;
        hasUtm = true;
      }
    }

    if (!hasUtm) return;

    // Set as once-only person properties (first-touch attribution)
    const posthogInstance = getPosthogInstance();
    if (!posthogInstance) return;

    posthogInstance.setPersonProperties({}, params);

    // Also fire a discrete event so UTMs appear in the event stream
    trackEvent('utm_captured', params);

    // Clean UTM params from URL to avoid double-counting on refresh
    for (const key of utmKeys) {
      url.searchParams.delete(key);
    }
    // window.history.state is typed as `any` by the DOM lib; widen to `unknown`.
    const currentState: unknown = window.history.state ?? null;
    window.history.replaceState(currentState, '', url.toString());
  } catch {
    // Fail silently
  }
}

// GALLERY TRACKING

/**
 * Track gallery opened with first-session context.
 */
export function trackGalleryOpened(layoutCount: number): void {
  trackEvent('gallery_opened', {
    layout_count: layoutCount,
    is_first_session: isFirstSession(),
  });
}

/**
 * Track gallery close with reason indicating user behavior.
 */
export function trackGalleryClosed(reason: 'applied_template' | 'dismissed'): void {
  trackEvent('gallery_closed', { reason });
}
