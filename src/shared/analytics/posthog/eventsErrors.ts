/**
 * Error capture + failure tracking helpers.
 *
 * `captureException` enriches caught errors with layout context so a
 * PostHog stack trace is debuggable without round-tripping a session
 * recording. The narrower `track*Failure` helpers fire discrete events
 * for known-bad outcomes (save, share, 3D render, template load) so
 * they show up in dashboards alongside the generic exceptions.
 */

import { useInteractionStore } from '@/core/store/interaction';
import { useLayoutStore } from '@/core/store/layout';
import { getPosthogInstance } from './init';
import { getDeviceType, trackEvent } from './trackEvent';

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
 *
 * Delegates to posthog-js's native `captureException`, which constructs the
 * required `$exception_list` payload (with parsed stack frames + mechanism)
 * that PostHog's ingestion pipeline now requires. Manually firing `$exception`
 * with the legacy flat fields produces serde "missing field $exception_list"
 * warnings and the events get dropped.
 */
export function captureException(error: Error, additionalContext?: Record<string, unknown>): void {
  const posthogInstance = getPosthogInstance();
  if (!posthogInstance) return;

  try {
    posthogInstance.captureException(error, {
      ...getLayoutContext(),
      ...additionalContext,
    });
  } catch {
    // Never break the app for analytics
  }
}

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
