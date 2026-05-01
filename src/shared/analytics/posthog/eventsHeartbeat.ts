/**
 * Heartbeat telemetry: derive an "activity context" from store state and
 * snapshot enough layout/feature data to power PostHog dashboards.
 *
 * `trackHeartbeat` runs on a periodic interval. `getActivityContext`
 * lives alongside the heartbeat payload because both are derived from
 * the same interaction-store inputs and ship together in the heartbeat
 * event — co-locating them keeps inputs and consumers in one file.
 */

import { useInteractionStore } from '@/core/store/interaction';
import type { LayerViewMode } from '@/core/store/view';
import { useLayoutStore } from '@/core/store/layout';
import { useViewStore } from '@/core/store/view';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { splitBinsByLocation } from '@/shared/utils';
import { capture } from './init';
import { getDeviceType } from './trackEvent';

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
