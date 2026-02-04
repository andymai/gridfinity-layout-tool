/**
 * Cutouts feature module.
 *
 * Photo-based tool cutouts for the bin designer.
 * Allows users to photograph tools, trace their outlines,
 * and create custom bin cavities.
 *
 * @module cutouts
 */

// =============================================================================
// Types
// =============================================================================

export type {
  TracedContour,
  CutoutTemplate,
  ProcessingOptions,
  ProcessingError,
  ProcessingErrorType,
  OpenCVLoadProgress,
  OpenCVLoadStage,
  NormalizedPoint,
} from './types';

export {
  DEFAULT_PROCESSING_OPTIONS,
  MAX_CUTOUT_TEMPLATES,
  MAX_CONTOUR_POINTS,
  MAX_IMAGE_SIZE_BYTES,
  THUMBNAIL_MAX_SIZE,
  DEFAULT_CLEARANCE_MM,
  MIN_CLEARANCE_MM,
  MAX_CLEARANCE_MM,
  processingError,
} from './types';

// =============================================================================
// Services
// =============================================================================

export { loadOpenCV, isOpenCVReady, getCV } from './services/opencvLoader';

export { traceImageContour, validateImageData, fileToImageData } from './services/imageProcessor';

export {
  simplifyContour,
  douglasPeucker,
  contourPathLength,
  contourArea,
} from './services/contourSimplifier';

export {
  generateThumbnail,
  getImageDimensions,
  estimateDataUrlSize,
} from './services/thumbnailGenerator';

// =============================================================================
// Assets
// =============================================================================

export { default as sampleWrench } from './assets/sample-wrench.json';
