/**
 * Cutout feature type definitions.
 *
 * Types for photo-based tool cutouts in the bin designer.
 * Supports image tracing, contour storage, and library management.
 */

// =============================================================================
// Contour Types
// =============================================================================

/** A 2D point in normalized coordinates (0-1 range) */
export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A traced contour from image processing.
 * Points are normalized to 0-1 coordinates for scale-independence.
 */
export interface TracedContour {
  /** Contour points normalized to 0-1 range */
  readonly points: ReadonlyArray<NormalizedPoint>;
  /** Original aspect ratio (width/height) of the bounding box */
  readonly boundingBox: {
    readonly width: number;
    readonly height: number;
  };
  /** Contour area as fraction of bounding box (0-1, for validation) */
  readonly area: number;
}

// =============================================================================
// Library Types
// =============================================================================

/**
 * A saved cutout template in the personal library.
 */
export interface CutoutTemplate {
  readonly id: string;
  readonly name: string;
  readonly contour: TracedContour;
  /** Resized preview image (~10KB, base64 data URL) */
  readonly thumbnail: string | null;
  /** Original photo (~200KB, base64 data URL) */
  readonly originalImage: string | null;
  /** Real-world width in mm */
  readonly widthMm: number;
  /** Real-world height in mm */
  readonly heightMm: number;
  /** ISO timestamp */
  readonly createdAt: string;
  /** ISO timestamp */
  readonly updatedAt: string;
  /** Optional category for organization (e.g., "screwdriver", "wrench") */
  readonly category?: string;
}

// =============================================================================
// Processing Types
// =============================================================================

/**
 * Options for image processing.
 */
export interface ProcessingOptions {
  /** Threshold for binary conversion (0-255, default 128) */
  readonly threshold: number;
  /** Blur radius for noise reduction (0-10, default 3) */
  readonly blur: number;
  /** Minimum contour area in pixels (default 100) */
  readonly minContourArea: number;
  /** Douglas-Peucker simplification epsilon (default 0.005) */
  readonly simplificationEpsilon: number;
}

/** Default processing options */
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  threshold: 128,
  blur: 3,
  minContourArea: 100,
  simplificationEpsilon: 0.005,
};

// =============================================================================
// Error Types
// =============================================================================

/**
 * Processing error types for user-friendly messages.
 */
export type ProcessingErrorType =
  | 'opencv_load_failed'
  | 'no_contour_found'
  | 'invalid_image'
  | 'image_too_large'
  | 'processing_failed';

export interface ProcessingError {
  readonly type: ProcessingErrorType;
  readonly message: string;
}

/** Error constructor helpers */
export const processingError = {
  opencvLoadFailed: (message: string): ProcessingError => ({
    type: 'opencv_load_failed',
    message,
  }),
  noContourFound: (message = 'No tool outline detected'): ProcessingError => ({
    type: 'no_contour_found',
    message,
  }),
  invalidImage: (message = 'Invalid image file'): ProcessingError => ({
    type: 'invalid_image',
    message,
  }),
  imageTooLarge: (maxMb: number): ProcessingError => ({
    type: 'image_too_large',
    message: `Image exceeds ${maxMb}MB limit`,
  }),
  processingFailed: (message: string): ProcessingError => ({
    type: 'processing_failed',
    message,
  }),
};

// =============================================================================
// Storage Error Types
// =============================================================================

/**
 * Storage error types for cutout library operations.
 */
export type StorageErrorType = 'validation_error' | 'storage_full' | 'not_found' | 'storage_failed';

export interface StorageError {
  readonly type: StorageErrorType;
  readonly message: string;
}

/** Storage error constructor helpers */
export const storageError = {
  validationError: (message: string): StorageError => ({
    type: 'validation_error',
    message,
  }),
  storageFull: (maxCount: number): StorageError => ({
    type: 'storage_full',
    message: `Library is full (maximum ${maxCount} templates)`,
  }),
  notFound: (id: string): StorageError => ({
    type: 'not_found',
    message: `Template not found: ${id}`,
  }),
  storageFailed: (message: string): StorageError => ({
    type: 'storage_failed',
    message,
  }),
};

// =============================================================================
// OpenCV Loading Types
// =============================================================================

/**
 * OpenCV loading stage.
 */
export type OpenCVLoadStage = 'idle' | 'downloading' | 'initializing' | 'ready' | 'error';

/**
 * OpenCV loading progress state.
 */
export interface OpenCVLoadProgress {
  readonly stage: OpenCVLoadStage;
  /** Progress percentage (0-100) */
  readonly progress: number;
  /** Error message if stage is 'error' */
  readonly error?: string;
}

// =============================================================================
// Storage Constants
// =============================================================================

/** Maximum number of cutout templates in the library */
export const MAX_CUTOUT_TEMPLATES = 100;

/** Maximum number of points per contour */
export const MAX_CONTOUR_POINTS = 500;

/** Maximum image size in bytes (10MB) */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** Thumbnail maximum dimension in pixels */
export const THUMBNAIL_MAX_SIZE = 200;

/** Default clearance in mm (fit tolerance) */
export const DEFAULT_CLEARANCE_MM = 0.5;

/** Minimum clearance in mm */
export const MIN_CLEARANCE_MM = 0.2;

/** Maximum clearance in mm */
export const MAX_CLEARANCE_MM = 2.0;
