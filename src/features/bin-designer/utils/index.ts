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
export {
  captureThumbnail,
  captureThumbnailPNG,
  setPreviewCanvas,
  clearPreviewCanvas,
} from './thumbnail';
export { packageSplitPiecesAsZip } from './splitExport';
export { validateBinParams, computeMinCellSize, validateCompartmentSizes } from './validation';
export type { DesignerValidationError, MinCellSize } from './validation';
