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

export {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- backward compat re-export
  generateUUID,
  generateLayoutId,
  isValidLayoutId,
  isLegacyUUID,
  LAYOUT_ID_LENGTH,
} from './uuid';

export { throttleRAF, cancelThrottledRAF, throttle } from './throttle';

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
