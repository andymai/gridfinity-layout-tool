/**
 * Factory functions to construct domain errors.
 *
 * These functions ensure consistent error structure and automatically
 * populate messages from the error catalog. Use these instead of
 * manually creating error objects.
 *
 * @example
 * ```ts
 * import { storageNotFound, validationCollision, apiRateLimited } from '../result';
 *
 * // Storage error
 * const error1 = storageNotFound('gridfinity-layout-abc123');
 *
 * // Validation error with context
 * const error2 = validationCollision(['bin-1', 'bin-2']);
 *
 * // API error with retry info
 * const error3 = apiRateLimited(60);
 * ```
 */

import type {
  StorageQuotaExceededError,
  StorageNotFoundError,
  StorageCorruptedError,
  StorageUnavailableError,
  StorageNetworkError,
  ValidationOutOfBoundsError,
  ValidationCollisionError,
  ValidationInvalidLayerError,
  ValidationHeightExceededError,
  ValidationBlockedZoneError,
  ValidationImportError,
  LayoutLayerLimitError,
  LayoutCategoryLimitError,
  LayoutLibraryLimitError,
  LayoutLastEntityError,
  LayoutInvalidOperationError,
  ApiRateLimitedError,
  ApiUnauthorizedError,
  ApiNotFoundError,
  ApiServerError,
  ApiNetworkError,
  ApiValidationError,
  ApiContentBlockedError,
  ApiSizeLimitError,
  ApiBinLimitError,
  ApiExpiredError,
  ApiInvalidExpirationError,
  UnknownError,
  ValidationFailureReason,
} from './errors';
import { getErrorInfo } from './catalog';

// =============================================================================
// Storage Error Constructors
// =============================================================================

/**
 * Create a storage quota exceeded error.
 *
 * @param usageBytes - Current storage usage in bytes
 * @param limitBytes - Storage limit in bytes
 * @param cause - Original error that caused this
 */
export function storageQuotaExceeded(
  usageBytes?: number,
  limitBytes?: number,
  cause?: unknown
): StorageQuotaExceededError {
  return {
    kind: 'StorageError',
    code: 'STORAGE_QUOTA_EXCEEDED',
    message: getErrorInfo('STORAGE_QUOTA_EXCEEDED').defaultMessage,
    timestamp: Date.now(),
    usageBytes,
    limitBytes,
    cause,
  };
}

/**
 * Create a storage not found error.
 *
 * @param key - The storage key that was not found
 * @param cause - Original error that caused this
 */
export function storageNotFound(
  key: string,
  cause?: unknown
): StorageNotFoundError {
  return {
    kind: 'StorageError',
    code: 'STORAGE_NOT_FOUND',
    message: getErrorInfo('STORAGE_NOT_FOUND').defaultMessage,
    timestamp: Date.now(),
    key,
    cause,
  };
}

/**
 * Create a storage corrupted error.
 *
 * @param key - The storage key with corrupted data
 * @param validationErrors - List of validation errors
 * @param cause - Original error that caused this
 */
export function storageCorrupted(
  key: string,
  validationErrors?: string[],
  cause?: unknown
): StorageCorruptedError {
  return {
    kind: 'StorageError',
    code: 'STORAGE_CORRUPTED',
    message: getErrorInfo('STORAGE_CORRUPTED').defaultMessage,
    timestamp: Date.now(),
    key,
    validationErrors,
    cause,
  };
}

/**
 * Create a storage unavailable error.
 *
 * @param backend - Which storage backend is unavailable
 * @param cause - Original error that caused this
 */
export function storageUnavailable(
  backend: 'localStorage' | 'indexedDB',
  cause?: unknown
): StorageUnavailableError {
  return {
    kind: 'StorageError',
    code: 'STORAGE_UNAVAILABLE',
    message: getErrorInfo('STORAGE_UNAVAILABLE').defaultMessage,
    timestamp: Date.now(),
    backend,
    cause,
  };
}

/**
 * Create a storage network error.
 *
 * @param cause - Original error that caused this
 */
export function storageNetworkError(cause?: unknown): StorageNetworkError {
  return {
    kind: 'StorageError',
    code: 'STORAGE_NETWORK_ERROR',
    message: getErrorInfo('STORAGE_NETWORK_ERROR').defaultMessage,
    timestamp: Date.now(),
    cause,
  };
}

// =============================================================================
// Validation Error Constructors
// =============================================================================

/**
 * Create a validation out of bounds error.
 *
 * @param reason - Specific reason for the bounds violation
 * @param binData - The bin data that failed validation
 */
export function validationOutOfBounds(
  reason: ValidationFailureReason,
  binData?: { x: number; y: number; width: number; depth: number }
): ValidationOutOfBoundsError {
  return {
    kind: 'ValidationError',
    code: 'VALIDATION_OUT_OF_BOUNDS',
    message: getErrorInfo('VALIDATION_OUT_OF_BOUNDS').defaultMessage,
    timestamp: Date.now(),
    reason,
    binData,
  };
}

/**
 * Create a validation collision error.
 *
 * @param collidingBinIds - IDs of bins that would collide
 */
export function validationCollision(
  collidingBinIds?: string[]
): ValidationCollisionError {
  return {
    kind: 'ValidationError',
    code: 'VALIDATION_COLLISION',
    message: getErrorInfo('VALIDATION_COLLISION').defaultMessage,
    timestamp: Date.now(),
    collidingBinIds,
  };
}

/**
 * Create a validation invalid layer error.
 *
 * @param layerId - The invalid layer ID
 */
export function validationInvalidLayer(
  layerId: string
): ValidationInvalidLayerError {
  return {
    kind: 'ValidationError',
    code: 'VALIDATION_INVALID_LAYER',
    message: getErrorInfo('VALIDATION_INVALID_LAYER').defaultMessage,
    timestamp: Date.now(),
    layerId,
  };
}

/**
 * Create a validation height exceeded error.
 *
 * @param requested - Requested height
 * @param max - Maximum allowed height
 */
export function validationHeightExceeded(
  requested: number,
  max: number
): ValidationHeightExceededError {
  return {
    kind: 'ValidationError',
    code: 'VALIDATION_HEIGHT_EXCEEDED',
    message: getErrorInfo('VALIDATION_HEIGHT_EXCEEDED').defaultMessage,
    timestamp: Date.now(),
    requested,
    max,
  };
}

/**
 * Create a validation blocked zone error.
 *
 * @param blockingBinIds - IDs of bins creating the blocked zone
 */
export function validationBlockedZone(
  blockingBinIds?: string[]
): ValidationBlockedZoneError {
  return {
    kind: 'ValidationError',
    code: 'VALIDATION_BLOCKED_ZONE',
    message: getErrorInfo('VALIDATION_BLOCKED_ZONE').defaultMessage,
    timestamp: Date.now(),
    blockingBinIds,
  };
}

/**
 * Create a validation import failed error.
 *
 * @param errors - List of validation errors
 */
export function validationImportFailed(errors: string[]): ValidationImportError {
  return {
    kind: 'ValidationError',
    code: 'VALIDATION_IMPORT_FAILED',
    message: getErrorInfo('VALIDATION_IMPORT_FAILED').defaultMessage,
    timestamp: Date.now(),
    errors,
  };
}

// =============================================================================
// Layout Error Constructors
// =============================================================================

/**
 * Create a layout layer limit error.
 *
 * @param currentCount - Current number of layers
 * @param maxCount - Maximum allowed layers
 */
export function layoutLayerLimit(
  currentCount: number,
  maxCount: number
): LayoutLayerLimitError {
  return {
    kind: 'LayoutError',
    code: 'LAYOUT_LAYER_LIMIT',
    message: getErrorInfo('LAYOUT_LAYER_LIMIT').defaultMessage,
    timestamp: Date.now(),
    currentCount,
    maxCount,
  };
}

/**
 * Create a layout category limit error.
 *
 * @param currentCount - Current number of categories
 * @param maxCount - Maximum allowed categories
 */
export function layoutCategoryLimit(
  currentCount: number,
  maxCount: number
): LayoutCategoryLimitError {
  return {
    kind: 'LayoutError',
    code: 'LAYOUT_CATEGORY_LIMIT',
    message: getErrorInfo('LAYOUT_CATEGORY_LIMIT').defaultMessage,
    timestamp: Date.now(),
    currentCount,
    maxCount,
  };
}

/**
 * Create a layout library limit error.
 *
 * @param currentCount - Current number of layouts
 * @param maxCount - Maximum allowed layouts
 */
export function layoutLibraryLimit(
  currentCount: number,
  maxCount: number
): LayoutLibraryLimitError {
  return {
    kind: 'LayoutError',
    code: 'LAYOUT_LIBRARY_LIMIT',
    message: getErrorInfo('LAYOUT_LIBRARY_LIMIT').defaultMessage,
    timestamp: Date.now(),
    currentCount,
    maxCount,
  };
}

/**
 * Create a layout last entity error.
 *
 * @param entityType - Type of entity that cannot be deleted
 */
export function layoutLastEntity(
  entityType: 'layer' | 'category' | 'layout'
): LayoutLastEntityError {
  return {
    kind: 'LayoutError',
    code: 'LAYOUT_LAST_ENTITY',
    message: getErrorInfo('LAYOUT_LAST_ENTITY').defaultMessage,
    timestamp: Date.now(),
    entityType,
    metadata: { entityType },
  };
}

/**
 * Create a layout invalid operation error.
 *
 * @param operation - Name of the operation that failed
 * @param reason - Additional reason for failure
 */
export function layoutInvalidOperation(
  operation: string,
  reason?: string
): LayoutInvalidOperationError {
  return {
    kind: 'LayoutError',
    code: 'LAYOUT_INVALID_OPERATION',
    message: getErrorInfo('LAYOUT_INVALID_OPERATION').defaultMessage,
    timestamp: Date.now(),
    operation,
    reason,
  };
}

// =============================================================================
// API Error Constructors
// =============================================================================

/**
 * Create an API rate limited error.
 *
 * @param retryAfter - Seconds until rate limit resets
 */
export function apiRateLimited(retryAfter?: number): ApiRateLimitedError {
  return {
    kind: 'ApiError',
    code: 'API_RATE_LIMITED',
    message: getErrorInfo('API_RATE_LIMITED').defaultMessage,
    timestamp: Date.now(),
    retryAfter,
    metadata: retryAfter !== undefined ? { retryAfter } : undefined,
  };
}

/**
 * Create an API unauthorized error.
 *
 * @param cause - Original error that caused this
 */
export function apiUnauthorized(cause?: unknown): ApiUnauthorizedError {
  return {
    kind: 'ApiError',
    code: 'API_UNAUTHORIZED',
    message: getErrorInfo('API_UNAUTHORIZED').defaultMessage,
    timestamp: Date.now(),
    cause,
  };
}

/**
 * Create an API not found error.
 *
 * @param resourceId - ID of the resource that was not found
 */
export function apiNotFound(resourceId?: string): ApiNotFoundError {
  return {
    kind: 'ApiError',
    code: 'API_NOT_FOUND',
    message: getErrorInfo('API_NOT_FOUND').defaultMessage,
    timestamp: Date.now(),
    resourceId,
  };
}

/**
 * Create an API server error.
 *
 * @param status - HTTP status code
 * @param cause - Original error that caused this
 */
export function apiServerError(
  status?: number,
  cause?: unknown
): ApiServerError {
  return {
    kind: 'ApiError',
    code: 'API_SERVER_ERROR',
    message: getErrorInfo('API_SERVER_ERROR').defaultMessage,
    timestamp: Date.now(),
    status,
    cause,
  };
}

/**
 * Create an API network error.
 *
 * @param cause - Original error that caused this
 */
export function apiNetworkError(cause?: unknown): ApiNetworkError {
  return {
    kind: 'ApiError',
    code: 'API_NETWORK_ERROR',
    message: getErrorInfo('API_NETWORK_ERROR').defaultMessage,
    timestamp: Date.now(),
    cause,
  };
}

/**
 * Create an API validation error.
 *
 * @param fields - Fields that failed validation
 * @param cause - Original error that caused this
 */
export function apiValidationError(
  fields?: string[],
  cause?: unknown
): ApiValidationError {
  return {
    kind: 'ApiError',
    code: 'API_VALIDATION_ERROR',
    message: getErrorInfo('API_VALIDATION_ERROR').defaultMessage,
    timestamp: Date.now(),
    fields,
    cause,
  };
}

/**
 * Create an API content blocked error.
 *
 * @param blockedFields - Fields that were blocked
 */
export function apiContentBlocked(
  blockedFields?: string[]
): ApiContentBlockedError {
  return {
    kind: 'ApiError',
    code: 'API_CONTENT_BLOCKED',
    message: getErrorInfo('API_CONTENT_BLOCKED').defaultMessage,
    timestamp: Date.now(),
    blockedFields,
  };
}

/**
 * Create an API size limit error.
 *
 * @param sizeBytes - Current size in bytes
 * @param maxBytes - Maximum allowed size in bytes
 */
export function apiSizeLimit(
  sizeBytes?: number,
  maxBytes?: number
): ApiSizeLimitError {
  return {
    kind: 'ApiError',
    code: 'API_SIZE_LIMIT',
    message: getErrorInfo('API_SIZE_LIMIT').defaultMessage,
    timestamp: Date.now(),
    sizeBytes,
    maxBytes,
  };
}

/**
 * Create an API bin limit error.
 *
 * @param binCount - Current bin count
 * @param maxBins - Maximum allowed bins
 */
export function apiBinLimit(
  binCount?: number,
  maxBins?: number
): ApiBinLimitError {
  return {
    kind: 'ApiError',
    code: 'API_BIN_LIMIT',
    message: getErrorInfo('API_BIN_LIMIT').defaultMessage,
    timestamp: Date.now(),
    binCount,
    maxBins,
  };
}

/**
 * Create an API expired error.
 *
 * @param shareId - ID of the expired share
 */
export function apiExpired(shareId?: string): ApiExpiredError {
  return {
    kind: 'ApiError',
    code: 'API_EXPIRED',
    message: getErrorInfo('API_EXPIRED').defaultMessage,
    timestamp: Date.now(),
    shareId,
  };
}

/**
 * Create an API invalid expiration error.
 *
 * @param providedValue - The invalid value that was provided
 */
export function apiInvalidExpiration(
  providedValue?: number
): ApiInvalidExpirationError {
  return {
    kind: 'ApiError',
    code: 'API_INVALID_EXPIRATION',
    message: getErrorInfo('API_INVALID_EXPIRATION').defaultMessage,
    timestamp: Date.now(),
    providedValue,
  };
}

// =============================================================================
// Unknown Error Constructor
// =============================================================================

/**
 * Create an unknown error.
 * Use this as a fallback when wrapping unknown exceptions.
 *
 * @param cause - Original error that caused this
 */
export function unknownError(cause?: unknown): UnknownError {
  return {
    kind: 'UnknownError',
    code: 'UNKNOWN_ERROR',
    message: getErrorInfo('UNKNOWN_ERROR').defaultMessage,
    timestamp: Date.now(),
    cause,
  };
}

/**
 * Wrap any unknown error into a domain error.
 * Useful in try-catch blocks where the error type is unknown.
 *
 * @param error - The unknown error to wrap
 * @returns An UnknownError with the original error as cause
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 *   return ok(result);
 * } catch (error) {
 *   return err(fromUnknown(error));
 * }
 * ```
 */
export function fromUnknown(error: unknown): UnknownError {
  return unknownError(error);
}
