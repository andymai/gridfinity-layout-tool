/**
 * Analytics module exports.
 *
 * Two separate systems:
 * 1. PostHog analytics (product metrics, session tracking)
 * 2. ML telemetry (bin prediction training data)
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
  normalizeLabel,
  getCanonicalTerms,
  isKnownTerm,
  getTermDomain,
  VOCAB_VERSION,
  type LabelData,
  type LabelDomain,
} from './labelVocabulary';

// Gap analysis
export {
  analyzeGaps,
  calculateFillPercentage,
  type GapAnalysis,
} from './gapAnalysis';
