/**
 * Domain-specific error types with rich metadata.
 *
 * This module defines structured error types for each domain in the application:
 * - StorageError: Browser storage operations (localStorage, IndexedDB)
 * - ValidationError: Bin placement and layout validation
 * - LayoutError: Layout, layer, and category operations
 * - ApiError: Cloud sharing API operations
 *
 * All errors extend the base AppError interface which includes:
 * - kind: Discriminant for the error domain
 * - code: Unique error code from the catalog
 * - message: Default message for logging
 * - timestamp: When the error occurred
 * - metadata: Optional additional context
 * - cause: Optional original error for debugging
 */

/**
 * Reason codes for validation failures.
 * Matches the existing ValidationResult.reason type.
 */
export type ValidationFailureReason =
  | 'out_of_bounds'
  | 'exceeds_width'
  | 'exceeds_depth'
  | 'exceeds_height'
  | 'invalid_layer'
  | 'collision'
  | 'blocked_zone';

/**
 * Base interface for all application errors.
 * Provides a consistent structure for error handling and logging.
 */
export interface AppError {
  /** Discriminant for the error domain (StorageError, ValidationError, etc.) */
  readonly kind: string;
  /** Unique error code from the error catalog */
  readonly code: string;
  /** Default message for logging/debugging */
  readonly message: string;
  /** Unix timestamp when the error occurred */
  readonly timestamp: number;
  /** Optional additional context for the error */
  readonly metadata?: Record<string, unknown>;
  /** Optional original error for debugging */
  readonly cause?: unknown;
}

// =============================================================================
// Storage Errors
// =============================================================================

/**
 * Error when browser storage quota is exceeded.
 * Common with large layouts in localStorage (5MB limit).
 */
export interface StorageQuotaExceededError extends AppError {
  readonly kind: 'StorageError';
  readonly code: 'STORAGE_QUOTA_EXCEEDED';
  /** Current storage usage in bytes, if known */
  readonly usageBytes?: number;
  /** Storage limit in bytes, if known */
  readonly limitBytes?: number;
}

/**
 * Error when requested data is not found in storage.
 */
export interface StorageNotFoundError extends AppError {
  readonly kind: 'StorageError';
  readonly code: 'STORAGE_NOT_FOUND';
  /** The storage key that was not found */
  readonly key: string;
}

/**
 * Error when stored data fails validation or parsing.
 */
export interface StorageCorruptedError extends AppError {
  readonly kind: 'StorageError';
  readonly code: 'STORAGE_CORRUPTED';
  /** The storage key with corrupted data */
  readonly key: string;
  /** Validation errors that caused the corruption detection */
  readonly validationErrors?: string[];
}

/**
 * Error when a storage backend is unavailable.
 * Can occur in private browsing or with disabled storage.
 */
export interface StorageUnavailableError extends AppError {
  readonly kind: 'StorageError';
  readonly code: 'STORAGE_UNAVAILABLE';
  /** Which backend is unavailable */
  readonly backend: 'localStorage' | 'indexedDB';
}

/**
 * Error during network-related storage operations.
 * Primarily for IndexedDB which can have async issues.
 */
export interface StorageNetworkError extends AppError {
  readonly kind: 'StorageError';
  readonly code: 'STORAGE_NETWORK_ERROR';
}

/**
 * Union of all storage-related errors.
 */
export type StorageError =
  | StorageQuotaExceededError
  | StorageNotFoundError
  | StorageCorruptedError
  | StorageUnavailableError
  | StorageNetworkError;

// =============================================================================
// Validation Errors
// =============================================================================

/**
 * Error when bin placement is outside drawer bounds.
 */
export interface ValidationOutOfBoundsError extends AppError {
  readonly kind: 'ValidationError';
  readonly code: 'VALIDATION_OUT_OF_BOUNDS';
  /** Specific reason for the bounds violation */
  readonly reason: ValidationFailureReason;
  /** The bin data that failed validation */
  readonly binData?: {
    x: number;
    y: number;
    width: number;
    depth: number;
  };
}

/**
 * Error when bin placement would collide with existing bins.
 */
export interface ValidationCollisionError extends AppError {
  readonly kind: 'ValidationError';
  readonly code: 'VALIDATION_COLLISION';
  /** IDs of bins that would collide */
  readonly collidingBinIds?: string[];
}

/**
 * Error when referencing a layer that doesn't exist.
 */
export interface ValidationInvalidLayerError extends AppError {
  readonly kind: 'ValidationError';
  readonly code: 'VALIDATION_INVALID_LAYER';
  /** The invalid layer ID */
  readonly layerId: string;
}

/**
 * Error when bin height exceeds available space.
 */
export interface ValidationHeightExceededError extends AppError {
  readonly kind: 'ValidationError';
  readonly code: 'VALIDATION_HEIGHT_EXCEEDED';
  /** Requested height */
  readonly requested: number;
  /** Maximum allowed height */
  readonly max: number;
}

/**
 * Error when placement is blocked by clearance zone from tall bins.
 */
export interface ValidationBlockedZoneError extends AppError {
  readonly kind: 'ValidationError';
  readonly code: 'VALIDATION_BLOCKED_ZONE';
  /** IDs of bins creating the blocked zone */
  readonly blockingBinIds?: string[];
}

/**
 * Error when imported layout fails validation.
 */
export interface ValidationImportError extends AppError {
  readonly kind: 'ValidationError';
  readonly code: 'VALIDATION_IMPORT_FAILED';
  /** List of validation errors */
  readonly errors: string[];
}

/**
 * Union of all validation-related errors.
 */
export type ValidationError =
  | ValidationOutOfBoundsError
  | ValidationCollisionError
  | ValidationInvalidLayerError
  | ValidationHeightExceededError
  | ValidationBlockedZoneError
  | ValidationImportError;

// =============================================================================
// Layout Operation Errors
// =============================================================================

/**
 * Error when maximum layer count is reached.
 */
export interface LayoutLayerLimitError extends AppError {
  readonly kind: 'LayoutError';
  readonly code: 'LAYOUT_LAYER_LIMIT';
  /** Current number of layers */
  readonly currentCount: number;
  /** Maximum allowed layers */
  readonly maxCount: number;
}

/**
 * Error when maximum category count is reached.
 */
export interface LayoutCategoryLimitError extends AppError {
  readonly kind: 'LayoutError';
  readonly code: 'LAYOUT_CATEGORY_LIMIT';
  /** Current number of categories */
  readonly currentCount: number;
  /** Maximum allowed categories */
  readonly maxCount: number;
}

/**
 * Error when maximum layout count in library is reached.
 */
export interface LayoutLibraryLimitError extends AppError {
  readonly kind: 'LayoutError';
  readonly code: 'LAYOUT_LIBRARY_LIMIT';
  /** Current number of layouts */
  readonly currentCount: number;
  /** Maximum allowed layouts */
  readonly maxCount: number;
}

/**
 * Error when trying to delete the last entity of a type.
 */
export interface LayoutLastEntityError extends AppError {
  readonly kind: 'LayoutError';
  readonly code: 'LAYOUT_LAST_ENTITY';
  /** Type of entity that cannot be deleted */
  readonly entityType: 'layer' | 'category' | 'layout';
}

/**
 * Error for invalid layout operations.
 */
export interface LayoutInvalidOperationError extends AppError {
  readonly kind: 'LayoutError';
  readonly code: 'LAYOUT_INVALID_OPERATION';
  /** Name of the operation that failed */
  readonly operation: string;
  /** Additional reason for failure */
  readonly reason?: string;
}

/**
 * Union of all layout operation errors.
 */
export type LayoutError =
  | LayoutLayerLimitError
  | LayoutCategoryLimitError
  | LayoutLibraryLimitError
  | LayoutLastEntityError
  | LayoutInvalidOperationError;

// =============================================================================
// API Errors (Cloud Sharing)
// =============================================================================

/**
 * Error when API rate limit is exceeded.
 */
export interface ApiRateLimitedError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_RATE_LIMITED';
  /** Seconds until rate limit resets */
  readonly retryAfter?: number;
}

/**
 * Error when API request is unauthorized.
 */
export interface ApiUnauthorizedError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_UNAUTHORIZED';
}

/**
 * Error when API resource is not found.
 */
export interface ApiNotFoundError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_NOT_FOUND';
  /** ID of the resource that was not found */
  readonly resourceId?: string;
}

/**
 * Error when API server returns an error.
 */
export interface ApiServerError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_SERVER_ERROR';
  /** HTTP status code */
  readonly status?: number;
}

/**
 * Error when network request fails.
 */
export interface ApiNetworkError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_NETWORK_ERROR';
}

/**
 * Error when API request times out.
 */
export interface ApiTimeoutError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_TIMEOUT';
}

/**
 * Error when API validation fails.
 */
export interface ApiValidationError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_VALIDATION_ERROR';
  /** Fields that failed validation */
  readonly fields?: string[];
}

/**
 * Error when content is blocked by content filter.
 */
export interface ApiContentBlockedError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_CONTENT_BLOCKED';
  /** Fields that were blocked */
  readonly blockedFields?: string[];
}

/**
 * Error when layout size exceeds upload limit.
 */
export interface ApiSizeLimitError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_SIZE_LIMIT';
  /** Current size in bytes */
  readonly sizeBytes?: number;
  /** Maximum allowed size in bytes */
  readonly maxBytes?: number;
}

/**
 * Error when bin count exceeds upload limit.
 */
export interface ApiBinLimitError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_BIN_LIMIT';
  /** Current bin count */
  readonly binCount?: number;
  /** Maximum allowed bins */
  readonly maxBins?: number;
}

/**
 * Error when share has expired.
 */
export interface ApiExpiredError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_EXPIRED';
  /** ID of the expired share */
  readonly shareId?: string;
}

/**
 * Error when invalid expiration period is specified.
 */
export interface ApiInvalidExpirationError extends AppError {
  readonly kind: 'ApiError';
  readonly code: 'API_INVALID_EXPIRATION';
  /** The invalid value that was provided */
  readonly providedValue?: number;
}

/**
 * Union of all API-related errors.
 */
export type ApiError =
  | ApiRateLimitedError
  | ApiUnauthorizedError
  | ApiNotFoundError
  | ApiServerError
  | ApiNetworkError
  | ApiTimeoutError
  | ApiValidationError
  | ApiContentBlockedError
  | ApiSizeLimitError
  | ApiBinLimitError
  | ApiExpiredError
  | ApiInvalidExpirationError;

// =============================================================================
// Generic Errors
// =============================================================================

/**
 * Error for unexpected/unknown errors.
 * Used as a fallback when wrapping unknown exceptions.
 */
export interface UnknownError extends AppError {
  readonly kind: 'UnknownError';
  readonly code: 'UNKNOWN_ERROR';
}

/**
 * Union of all domain errors in the application.
 */
export type DomainError = StorageError | ValidationError | LayoutError | ApiError | UnknownError;
