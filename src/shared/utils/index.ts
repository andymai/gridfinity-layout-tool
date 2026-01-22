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
} from './validation';
