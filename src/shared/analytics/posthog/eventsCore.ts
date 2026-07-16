/**
 * Layout-level + bin-creation analytics events plus the engagement
 * milestone ladder.
 *
 * `trackBinCreated` is the hot path — every bin draw, paint stroke,
 * fill op, duplicate, or import lands here, and it cascades into the
 * milestone check that fires on each engagement threshold crossing
 * (5, 15, 30 bins).
 */

import type { Layout } from '@/core/types';
import { useLayoutStore } from '@/core/store/layout';
import { getGridBins } from '@/shared/utils';
import { isFirstSession, loadAnalyticsData, saveAnalyticsData } from './identity';
import { capture } from './init';
import { computeLayoutMetrics, computeLabsMetrics } from './metrics';
import { getDeviceType, trackEvent } from './trackEvent';
import { markFeatureUsed, updatePersonProperties } from './eventsPerson';

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

/** Which drawer-shape authoring surface an event refers to. */
export type DrawerShapeEditor = 'cells' | 'corners';

/** Track a drawer-shape editor being opened. */
export function trackDrawerShapeEditorOpened(editor: DrawerShapeEditor): void {
  trackEvent('drawer_shape_editor_opened', { editor });
}

export interface DrawerShapeAppliedProperties {
  editor: DrawerShapeEditor;
  /** Bins pushed to staging by the new shape. */
  displaced_bins: number;
  /** Cells editor only: the user seeded the grid from the bin layout. */
  used_trace: boolean;
  /** The apply resolved to the plain rectangle (corner cuts all 'none'). */
  cleared: boolean;
}

/** Track a drawer shape being applied from one of the editors. */
export function trackDrawerShapeApplied(props: DrawerShapeAppliedProperties): void {
  trackEvent('drawer_shape_applied', { ...props });
}

/** Track the sidebar toggle resetting the drawer back to a rectangle. */
export function trackDrawerShapeReset(): void {
  trackEvent('drawer_shape_reset', {});
}

export interface DrawerMeasuredCommittedProperties {
  /** Leftover mm per axis after fitting the grid (negative = clamped up). */
  slack_width_mm: number;
  slack_depth_mm: number;
  /** Whether a tighter half-unit fit was offered after this commit. */
  half_fit_offered: boolean;
  has_height: boolean;
}

/** Track the user committing a measured drawer size in mm. */
export function trackDrawerMeasuredCommitted(props: DrawerMeasuredCommittedProperties): void {
  trackEvent('drawer_measured_committed', {
    ...props,
    slack_width_mm: Math.round(props.slack_width_mm * 10) / 10,
    slack_depth_mm: Math.round(props.slack_depth_mm * 10) / 10,
  });
}

/** Track the half-unit fit suggestion being acted on. */
export function trackDrawerHalfFitSuggestion(action: 'accepted' | 'dismissed'): void {
  trackEvent('drawer_half_fit_suggestion', { action });
}

/** Track the stored drawer measurement being cleared. */
export function trackDrawerMeasurementCleared(): void {
  trackEvent('drawer_measurement_cleared', {});
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
