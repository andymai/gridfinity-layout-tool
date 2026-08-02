export {
  createUniformGrid,
  createSingleCell,
  getCellId,
  cellIndex,
  getCompartmentIds,
  getCompartmentReadingOrder,
  getCellsForCompartment,
  getCompartmentBounds,
  getCompartmentCount,
  isRectangularSelection,
  validateCompartmentGrid,
  mergeCells,
  splitCompartment,
  previewMergeCells,
  previewSplitCells,
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
  captureThumbnailAtPreset,
  captureCommunityThumbnails,
  exportCommunityGlb,
  setPreviewCanvas,
  clearPreviewCanvas,
} from './thumbnail';
export type { ThumbnailCaptureOptions, BinFramingDimensions } from './thumbnail';
export { communityToDesign, lineageFromParent } from './communityToDesign';
export { findLocalDesignByPublishedId } from './findLocalDesignByPublishedId';
export { packageSplitPiecesAsZip } from './splitExport';
export { validateBinParams, computeMinCellSize, validateCompartmentSizes } from './validation';
export type { DesignerValidationError, MinCellSize } from './validation';
