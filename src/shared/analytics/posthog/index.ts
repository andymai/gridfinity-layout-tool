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

export { pruneAnalyticsData } from './identity';

// Init
export { initAnalytics, optOutAnalytics, optInAnalytics } from './init';

// Privacy signal detection (separate module to avoid circular deps with settings store)
export { isTrackingOptOut } from './privacy';

export type { LabsMetrics, LayoutMetrics } from './metrics';
export { computeLabsMetrics, computeLayoutMetrics } from './metrics';

// Events
export type {
  AnalyticsTrigger,
  BinCreatedProperties,
  DrawerMeasuredCommittedProperties,
  DrawerShapeAppliedProperties,
  DrawerShapeEditor,
} from './events';
export type { BinExportProperties } from './binExportEvents';
export { trackBinExportSucceeded, trackBinExportFailure } from './binExportEvents';
export type { ToolSurface, ToolConvertedProperties } from './conversionEvents';
export { trackToolActivated, trackToolConverted } from './conversionEvents';
export {
  getDeviceType,
  trackLayoutSnapshot,
  trackEvent,
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
  markFeatureUsed,
  captureException,
  trackLayoutSaveFailure,
  trackShareFailure,
  trackTemplateLoadError,
  trackGalleryOpened,
  trackGalleryClosed,
  listenForPwaInstall,
  captureUtmParameters,
  trackDesignCreated,
} from './events';
