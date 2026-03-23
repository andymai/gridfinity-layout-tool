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

// Identity
export { pruneAnalyticsData } from './identity';

// Init
export { initAnalytics, optOutAnalytics, optInAnalytics } from './init';

// Privacy signal detection (separate module to avoid circular deps with settings store)
export { isTrackingOptOut } from './privacy';

// Metrics
export type { LabsMetrics, LayoutMetrics } from './metrics';
export { computeLabsMetrics, computeLayoutMetrics } from './metrics';

// Events
export type {
  AnalyticsTrigger,
  BinCreatedProperties,
  ActivityContext,
  HeartbeatPayload,
} from './events';
export {
  getDeviceType,
  trackLayoutSnapshot,
  trackEvent,
  track3DPreview,
  trackLayoutAction,
  trackFillOperation,
  trackPaintMode,
  trackBinCreated,
  getActivityContext,
  buildHeartbeatPayload,
  trackHeartbeat,
  markFeatureUsed,
  captureException,
  trackLayoutSaveFailure,
  trackShareFailure,
  track3DRenderError,
  trackTemplateLoadError,
  trackWasmThreadingStatus,
  trackCachePerformance,
  trackKernelPerformance,
  trackGalleryOpened,
  trackGalleryClosed,
  listenForPwaInstall,
  captureUtmParameters,
} from './events';
