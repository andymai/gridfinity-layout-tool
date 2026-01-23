/**
 * ML Telemetry Module
 *
 * Collects bin placement, layout snapshot, and quality signal data for training
 * predictive models and enabling smart layout generation.
 *
 * Architecture:
 * - types.ts: Event interfaces, type aliases, constants
 * - eventBuffer.ts: Buffer management, circuit breaker, flush/send
 * - sessionState.ts: Session tracking, bin creation records, undo timing
 * - computations.ts: Quality assessment, distributions, confidence scoring
 * - trackers.ts: All tracking functions (the main API)
 * - init.ts: Initialization, cleanup, idle detection
 */

// Types
export type {
  BinPlacementEvent,
  LabelUpdateEvent,
  LayoutSnapshotEvent,
  LayoutQualityEvent,
  DrawerPurposeEvent,
  CategoryChangeEvent,
  BinResizeEvent,
  BinDeletedEvent,
  AbandonedBinEvent,
  BinMovedEvent,
  DrawerResizedEvent,
  FillOperationEvent,
  LayerMoveEvent,
  BinRotatedEvent,
  PlacementRejectedEvent,
  UndoEvent,
  QuickCorrectionEvent,
  SessionSummaryEvent,
  CrossLayoutPatternEvent,
  MLTelemetryEvent,
  ConfidenceBreakdown,
  AbandonmentType,
  PlacementMethod,
  DeleteMethod,
  MoveMethod,
  FillMethod,
  LayerMoveMethod,
  RejectionReason,
  UndoActionType,
  LayoutSnapshotTrigger,
  QualitySignal,
  LayoutQualityTier,
  DrawerPurpose,
} from './types';

export { DRAWER_PURPOSES } from './types';

// Event buffer
export { CLIENT_VERSION, getBufferSize } from './eventBuffer';
export { flush as forceFlush } from './eventBuffer';

// Session state
export {
  resetMLSession,
  recordBinCreation,
  getBinCreationRecord,
  removeBinCreationRecord,
  recordActionTimestamp,
  getTimeSinceLastAction,
  incrementEditCount,
  getSessionContext,
  markEditActivity,
} from './sessionState';

// Computations
export { computeConfidenceBreakdown, detectAbandonmentType } from './computations';

// Trackers
export {
  trackBinPlacement,
  trackLabelUpdate,
  trackBulkPlacement,
  trackLayoutSnapshot,
  trackQualitySignal,
  trackDrawerPurpose,
  trackCategoryChange,
  trackBinResize,
  trackBinDeletion,
  trackBinMove,
  trackDrawerResize,
  trackFillOperation,
  trackLayerMove,
  trackBinRotation,
  trackPlacementRejection,
  trackUndo,
  trackQuickCorrection,
  trackSessionSummary,
  trackCrossLayoutPattern,
} from './trackers';

// Initialization
export { initMLTelemetry, cleanupMLTelemetry, setLayoutStoreRef } from './init';
