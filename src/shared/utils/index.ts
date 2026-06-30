/**
 * Shared utility functions with no domain coupling.
 * These utilities are pure functions that don't depend on specific business logic.
 */

export { getContrastColor, getBinTextColors } from './color';
export type { BinTextColors } from './color';

export {
  compressString,
  decompressString,
  compressLayout,
  decompressLayout,
  getCompressionRatio,
} from './compression';

export { generateUUID, generateLayoutId, isValidLayoutId, isLegacyUUID } from './uuid';

export { throttleRAF, cancelThrottledRAF, throttle } from './throttle';

export { getSplitPositions, getSplitPieceCount, getSplitPlanePositionsMm } from './splitPositions';

export { scheduleIdleCallback, cancelIdleCallback } from './idle';

export {
  getVisibleBins,
  getGridBins,
  getStagingBins,
  getLayerBins,
  getLabeledBins,
  splitBinsByLocation,
} from './bins';
export type { VisibleBinsOptions } from './bins';

export {
  isValidDrawer,
  isValidLayer,
  isValidBin,
  isValidCategory,
  canPlaceBin,
  getPlacementErrorMessage,
  validateImport,
  validateLayoutIntegrity,
  validateCustomProperties,
  clamp,
  truncate,
  formatDimension,
} from './validation';

export {
  getDisplayLayers,
  getLayerZStartResult,
  getBin3DRectResult,
  footprintsOverlap,
  verticalRangesOverlap,
  binsCollideResult,
  getBlockedZones,
  isInBlockedZone,
  checkLayerReorderCollisions,
} from './collision';

export { fillAllWithSize, fillGaps } from './fill';

export { snapPosition, snapGroupDelta, snapResizeRect, snapDrawRect, SNAP_RADIUS } from './snap';
export type { SnapResult } from './snap';

export { calculateResizeRect } from './resize';

export { getErrorCode, getErrorMessage } from './errors';
