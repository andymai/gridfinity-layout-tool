/**
 * Public facade for PostHog event tracking.
 *
 * The 20+ tracking helpers are split across focused sibling modules; this
 * file re-exports the public surface and houses the small one-off
 * trackers (PWA install, UTM capture, gallery open/close) that don't
 * fit any of the larger groupings.
 *
 * Sub-modules:
 *   - `eventsCore`         — layout/bin events + engagement milestones
 *   - `eventsHeartbeat`    — activity context + heartbeat payload
 *   - `eventsPerson`       — person properties + feature-adoption flags
 *   - `eventsErrors`       — exception capture + failure tracking
 *   - `eventsPerformance`  — WASM threading + cache + kernel + baseplate timing
 *   - `binExportEvents`    — sibling file (kept for line-cap headroom)
 */

import { isFirstSession } from './identity';
import { getPosthogInstance } from './init';
import { trackEvent, getDeviceType } from './trackEvent';
import { markFeatureUsed } from './eventsPerson';

// Re-export so callers using the barrel keep working
export { getDeviceType, trackEvent };
export {
  trackLayoutSnapshot,
  track3DPreview,
  trackLayoutAction,
  trackFillOperation,
  trackPaintMode,
  trackBinCreated,
  trackDrawerShapeEditorOpened,
  trackDrawerShapeApplied,
  trackDrawerShapeReset,
  trackDrawerMeasuredCommitted,
  trackDrawerHalfFitSuggestion,
  trackDrawerMeasurementCleared,
  MILESTONE_THRESHOLDS,
  type AnalyticsTrigger,
  type BinCreatedProperties,
  type DrawerMeasuredCommittedProperties,
  type DrawerShapeAppliedProperties,
  type DrawerShapeEditor,
} from './eventsCore';
export {
  getActivityContext,
  buildHeartbeatPayload,
  trackHeartbeat,
  type ActivityContext,
  type HeartbeatPayload,
} from './eventsHeartbeat';
export { computeEngagementTier, updatePersonProperties, markFeatureUsed } from './eventsPerson';
export {
  captureException,
  trackLayoutSaveFailure,
  trackShareFailure,
  track3DRenderError,
  trackTemplateLoadError,
} from './eventsErrors';
export {
  trackWasmThreadingStatus,
  trackCachePerformance,
  trackKernelPerformance,
  trackBooleanFallbacks,
  trackBaseplatePreviewTiming,
} from './eventsPerformance';

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

// HELP MODAL TRACKING

/**
 * Sanitize a help search query before sending to telemetry: lowercase + truncated
 * to 80 chars so PII-shaped strings (an email, a long phrase, etc.) can't slip
 * through verbatim. Not a privacy guarantee, but a sensible limit.
 */
function sanitizeQuery(query: string): string {
  return query.trim().toLowerCase().slice(0, 80);
}

export function trackHelpSearchJump(entryId: string, query: string, position: number): void {
  trackEvent('help_search_jump', {
    entry_id: entryId,
    query: sanitizeQuery(query),
    position,
  });
}

export function trackHelpSearchEmpty(query: string, mode?: string): void {
  trackEvent('help_search_empty', {
    query: sanitizeQuery(query),
    ...(mode ? { mode } : {}),
  });
}

export function trackHelpCommandPaletteFallthrough(query: string, mode?: string): void {
  trackEvent('help_command_palette_fallthrough', {
    query: sanitizeQuery(query),
    ...(mode ? { mode } : {}),
  });
}
