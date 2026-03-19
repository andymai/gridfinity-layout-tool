/**
 * Factory functions to construct domain errors.
 *
 * These functions ensure consistent error structure and automatically
 * populate messages from the error catalog. Use these instead of
 * manually creating error objects.
 *
 * @example
 * ```ts
 * import { storageNotFound, validationCollision, apiRateLimited } from '@/core/result';
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
  AppError,
  ErrorCode,
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
  ApiTimeoutError,
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

// Internal Helpers

/**
 * Build a metadata object from the given fields, filtering out undefined values.
 * Returns undefined if no fields have values (keeps error objects clean).
 */
function buildMetadata(fields: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

/**
 * Generic factory for creating domain errors with auto-populated base fields.
 * Sets kind, code, message (from catalog), and timestamp automatically.
 */
function createError<T extends AppError>(
  kind: T['kind'],
  code: ErrorCode,
  fields?: Omit<T, 'kind' | 'code' | 'message' | 'timestamp'>
): T {
  return {
    kind,
    code,
    message: getErrorInfo(code).defaultMessage,
    timestamp: Date.now(),
    ...fields,
  } as T;
}

// Storage Error Constructors

/** Create a storage quota exceeded error. */
export function storageQuotaExceeded(
  usageBytes?: number,
  limitBytes?: number,
  cause?: unknown
): StorageQuotaExceededError {
  return createError('StorageError', 'STORAGE_QUOTA_EXCEEDED', { usageBytes, limitBytes, cause });
}

/** Create a storage not found error. */
export function storageNotFound(key: string, cause?: unknown): StorageNotFoundError {
  return createError('StorageError', 'STORAGE_NOT_FOUND', {
    key,
    cause,
    metadata: buildMetadata({ key }),
  });
}

/** Create a storage corrupted error. */
export function storageCorrupted(
  key: string,
  validationErrors?: string[],
  cause?: unknown
): StorageCorruptedError {
  return createError('StorageError', 'STORAGE_CORRUPTED', { key, validationErrors, cause });
}

/** Create a storage unavailable error. */
export function storageUnavailable(
  backend: 'localStorage' | 'indexedDB',
  cause?: unknown
): StorageUnavailableError {
  return createError('StorageError', 'STORAGE_UNAVAILABLE', {
    backend,
    cause,
    metadata: buildMetadata({ backend }),
  });
}

/** Create a storage network error. */
export function storageNetworkError(cause?: unknown): StorageNetworkError {
  return createError('StorageError', 'STORAGE_NETWORK_ERROR', { cause });
}

// Validation Error Constructors

/** Create a validation out of bounds error. */
export function validationOutOfBounds(
  reason: ValidationFailureReason,
  binData?: { x: number; y: number; width: number; depth: number }
): ValidationOutOfBoundsError {
  return createError('ValidationError', 'VALIDATION_OUT_OF_BOUNDS', { reason, binData });
}

/** Create a validation collision error. */
export function validationCollision(collidingBinIds?: string[]): ValidationCollisionError {
  return createError('ValidationError', 'VALIDATION_COLLISION', { collidingBinIds });
}

/** Create a validation invalid layer error. */
export function validationInvalidLayer(layerId: string): ValidationInvalidLayerError {
  return createError('ValidationError', 'VALIDATION_INVALID_LAYER', { layerId });
}

/** Create a validation height exceeded error. */
export function validationHeightExceeded(
  requested: number,
  max: number
): ValidationHeightExceededError {
  return createError('ValidationError', 'VALIDATION_HEIGHT_EXCEEDED', {
    requested,
    max,
    metadata: buildMetadata({ requested, max }),
  });
}

/** Create a validation blocked zone error. */
export function validationBlockedZone(blockingBinIds?: string[]): ValidationBlockedZoneError {
  return createError('ValidationError', 'VALIDATION_BLOCKED_ZONE', { blockingBinIds });
}

/** Create a validation import failed error. */
export function validationImportFailed(errors: string[]): ValidationImportError {
  return createError('ValidationError', 'VALIDATION_IMPORT_FAILED', { errors });
}

// Layout Error Constructors

/** Create a layout layer limit error. */
export function layoutLayerLimit(currentCount: number, maxCount: number): LayoutLayerLimitError {
  return createError('LayoutError', 'LAYOUT_LAYER_LIMIT', {
    currentCount,
    maxCount,
    metadata: buildMetadata({ currentCount, maxCount }),
  });
}

/** Create a layout category limit error. */
export function layoutCategoryLimit(
  currentCount: number,
  maxCount: number
): LayoutCategoryLimitError {
  return createError('LayoutError', 'LAYOUT_CATEGORY_LIMIT', {
    currentCount,
    maxCount,
    metadata: buildMetadata({ currentCount, maxCount }),
  });
}

/** Create a layout library limit error. */
export function layoutLibraryLimit(
  currentCount: number,
  maxCount: number
): LayoutLibraryLimitError {
  return createError('LayoutError', 'LAYOUT_LIBRARY_LIMIT', {
    currentCount,
    maxCount,
    metadata: buildMetadata({ currentCount, maxCount }),
  });
}

/** Create a layout last entity error. */
export function layoutLastEntity(
  entityType: 'layer' | 'category' | 'layout'
): LayoutLastEntityError {
  return createError('LayoutError', 'LAYOUT_LAST_ENTITY', {
    entityType,
    metadata: { entityType },
  });
}

/** Create a layout invalid operation error. */
export function layoutInvalidOperation(
  operation: string,
  reason?: string
): LayoutInvalidOperationError {
  return createError('LayoutError', 'LAYOUT_INVALID_OPERATION', { operation, reason });
}

// API Error Constructors

/** Create an API rate limited error. */
export function apiRateLimited(retryAfter?: number): ApiRateLimitedError {
  return createError('ApiError', 'API_RATE_LIMITED', {
    retryAfter,
    metadata: buildMetadata({ retryAfter }),
  });
}

/** Create an API unauthorized error. */
export function apiUnauthorized(cause?: unknown): ApiUnauthorizedError {
  return createError('ApiError', 'API_UNAUTHORIZED', { cause });
}

/** Create an API not found error. */
export function apiNotFound(resourceId?: string): ApiNotFoundError {
  return createError('ApiError', 'API_NOT_FOUND', { resourceId });
}

/** Create an API server error. */
export function apiServerError(status?: number, cause?: unknown): ApiServerError {
  return createError('ApiError', 'API_SERVER_ERROR', { status, cause });
}

/** Create an API network error. */
export function apiNetworkError(cause?: unknown): ApiNetworkError {
  return createError('ApiError', 'API_NETWORK_ERROR', { cause });
}

/** Create an API timeout error. */
export function apiTimeout(cause?: unknown): ApiTimeoutError {
  return createError('ApiError', 'API_TIMEOUT', { cause });
}

/** Create an API validation error. */
export function apiValidationError(fields?: string[], cause?: unknown): ApiValidationError {
  return createError('ApiError', 'API_VALIDATION_ERROR', { fields, cause });
}

/** Create an API content blocked error. */
export function apiContentBlocked(blockedFields?: string[]): ApiContentBlockedError {
  return createError('ApiError', 'API_CONTENT_BLOCKED', { blockedFields });
}

/** Create an API size limit error. */
export function apiSizeLimit(sizeBytes?: number, maxBytes?: number): ApiSizeLimitError {
  return createError('ApiError', 'API_SIZE_LIMIT', {
    sizeBytes,
    maxBytes,
    metadata: buildMetadata({ sizeBytes, maxBytes }),
  });
}

/** Create an API bin limit error. */
export function apiBinLimit(binCount?: number, maxBins?: number): ApiBinLimitError {
  return createError('ApiError', 'API_BIN_LIMIT', {
    binCount,
    maxBins,
    metadata: buildMetadata({ binCount, maxBins }),
  });
}

/** Create an API expired error. */
export function apiExpired(shareId?: string): ApiExpiredError {
  return createError('ApiError', 'API_EXPIRED', { shareId });
}

/** Create an API invalid expiration error. */
export function apiInvalidExpiration(providedValue?: number): ApiInvalidExpirationError {
  return createError('ApiError', 'API_INVALID_EXPIRATION', { providedValue });
}

// Unknown Error Constructor

/** Create an unknown error. Use this as a fallback when wrapping unknown exceptions. */
export function unknownError(cause?: unknown): UnknownError {
  return createError('UnknownError', 'UNKNOWN_ERROR', { cause });
}

/**
 * Wrap any unknown error into a domain error.
 * Useful in try-catch blocks where the error type is unknown.
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
