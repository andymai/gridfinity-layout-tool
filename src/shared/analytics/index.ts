/**
 * Analytics module exports.
 *
 * Two separate systems:
 * 1. PostHog analytics (product metrics, session tracking) — import from '@/shared/analytics/posthog'
 *    NOT re-exported here due to naming collisions (trackLayoutSnapshot, trackFillOperation, etc.)
 * 2. ML telemetry (bin prediction training data) — exported below
 */

// ML Telemetry - for bin prediction training
export {
  initMLTelemetry,
  trackBinPlacement,
  trackLabelUpdate,
  trackBulkPlacement,
  resetMLSession,
  forceFlush as forceFlushMLTelemetry,
  type BinPlacementEvent,
  type LabelUpdateEvent,
  type PlacementMethod,
} from './mlTelemetry';

// Label processing
export {
  processLabel,
  getCanonicalTerms,
  isKnownTerm,
  getTermDomain,
  VOCAB_VERSION,
  type LabelData,
  type LabelDomain,
} from './labelVocabulary';

// Gap analysis
export { analyzeGaps, calculateFillPercentage, type GapAnalysis } from './gapAnalysis';
