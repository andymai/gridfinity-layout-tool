/**
 * Re-export barrel for ML telemetry trackers.
 *
 * The tracker functions are organized into thematic sibling files:
 *   - `trackersHelpers`       — shared `isEnabled` gate + adjacency helper
 *   - `trackersBinPlacement`  — bin placement (single + bulk)
 *   - `trackersBinTransform`  — resize, move, deletion, rotation
 *   - `trackersBinMetadata`   — label and category changes
 *   - `trackersLayout`        — snapshot, drawer purpose/resize, fill, layer
 *                               move, plus the cross-layout pattern emitter
 *   - `trackersQuality`       — quality signal, placement rejection, undo,
 *                               quick correction, session summary
 *
 * Plus pass-through exports of `isSubstantialLayout` and `recordBinCreation`
 * from sessionState/computations for the init module.
 */

export { isEnabled } from './trackersHelpers';
export { trackBinPlacement, trackBulkPlacement } from './trackersBinPlacement';
export {
  trackBinResize,
  trackBinDeletion,
  trackBinMove,
  trackBinRotation,
} from './trackersBinTransform';
export { trackLabelUpdate, trackCategoryChange } from './trackersBinMetadata';
export {
  trackLayoutSnapshot,
  trackDrawerPurpose,
  trackDrawerResize,
  trackFillOperation,
  trackLayerMove,
} from './trackersLayout';
export {
  trackQualitySignal,
  trackPlacementRejection,
  trackUndo,
  trackQuickCorrection,
  trackSessionSummary,
} from './trackersQuality';

// Re-export functions that are used by the init module
export { isSubstantialLayout } from './computations';
export { recordBinCreation } from './sessionState';
