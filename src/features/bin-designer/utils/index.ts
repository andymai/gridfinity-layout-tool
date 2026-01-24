export { describeBin, getStatusAnnouncement } from './a11y';
export { batchExport, type BatchProgress, type BatchExportResult } from './batchExport';
export {
  createUniformGrid,
  createSingleCell,
  getCellId,
  cellIndex,
  getCompartmentIds,
  getCellsForCompartment,
  getCompartmentBounds,
  getCompartmentCount,
  isRectangularSelection,
  validateCompartmentGrid,
  mergeCells,
  splitCompartment,
  normalizeIds,
  deriveWallSegments,
  fromDividerConfig,
  type WallSegment,
} from './compartments';
export { generateFileName } from './fileNaming';
export type { FileNameStyle } from './fileNaming';
export { estimatePrint, formatPrintTime, formatFilament } from './printEstimates';
export type { PrintEstimate } from './printEstimates';
export { getStyleConstraints, isFeatureDisabled } from './styleConstraints';
export type { StyleConstraints, ConstrainedFeature } from './styleConstraints';
export {
  captureThumbnail,
  captureThumbnailPNG,
  setPreviewCanvas,
  clearPreviewCanvas,
} from './thumbnail';
export { validateBinParams, computeMinCellSize, validateCompartmentSizes } from './validation';
export type { DesignerValidationError, MinCellSize } from './validation';
