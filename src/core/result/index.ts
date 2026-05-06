/**
 * Result<T, E> Type System
 *
 * A comprehensive error handling system for type-safe operations.
 *
 * @example Basic usage:
 * ```ts
 * import { Result, ok, err, isOk, match } from '@/core/result';
 *
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return err('Division by zero');
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 *
 * // Pattern matching
 * const message = match(result, {
 *   ok: (value) => `Result: ${value}`,
 *   err: (error) => `Error: ${error}`,
 * });
 *
 * // Type guards
 * if (isOk(result)) {
 *   console.log(result.value);
 * }
 * ```
 *
 * @example With domain errors:
 * ```ts
 * import { Result, err, storageNotFound, getUserMessage } from '@/core/result';
 * import type { StorageError } from '@/core/result';
 *
 * async function loadLayout(id: string): Promise<Result<Layout, StorageError>> {
 *   const data = await storage.load(id);
 *   if (!data) return err(storageNotFound(`gridfinity-layout-${id}`));
 *   return ok(data);
 * }
 *
 * // Handle the result
 * const result = await loadLayout('abc123');
 * if (isErr(result)) {
 *   addToast(getUserMessage(result.error), 'error');
 * }
 * ```
 *
 * @example Chaining operations:
 * ```ts
 * import { flatMap, map, tryCatchAsync } from '@/core/result';
 *
 * const result = await tryCatchAsync(
 *   () => fetchData(url),
 *   (e) => apiNetworkError(e)
 * );
 *
 * const transformed = flatMap(result, (data) =>
 *   map(validateData(data), (valid) => processData(valid))
 * );
 * ```
 *
 * @module result
 */

// Primary API (used in production)

export type { Result, Ok, Err, Unit } from './types';
export { ok, err, isOk, isErr, OK } from './types';

export { getUserMessage, isRetryable, getErrorInfo, formatErrorMessage } from './catalog';

export { tryCatchAsync, unwrapOr } from './utils';

export { ResultAsync } from './resultAsync';

// Extended API (available, not currently used in production)

export {
  map,
  mapErr,
  flatMap,
  andThen,
  match,
  unwrap,
  unwrapErr,
  unwrapOrElse,
  tryCatch,
} from './utils';

export { getRecoveryHint, getSeverity } from './catalog';

// Domain Error Types

export type {
  // Base type + error code union
  AppError,
  ErrorCode,
  ValidationFailureReason,

  // Storage errors
  StorageError,
  StorageQuotaExceededError,
  StorageNotFoundError,
  StorageCorruptedError,
  StorageUnavailableError,
  StorageNetworkError,

  // Validation errors
  ValidationError,
  ValidationOutOfBoundsError,
  ValidationCollisionError,
  ValidationInvalidLayerError,
  ValidationHeightExceededError,
  ValidationBlockedZoneError,
  ValidationImportError,

  // Layout errors
  LayoutError,
  LayoutLayerLimitError,
  LayoutCategoryLimitError,
  LayoutLibraryLimitError,
  LayoutLastEntityError,
  LayoutInvalidOperationError,

  // API errors
  ApiError,
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

  // Generic
  UnknownError,
  DomainError,
} from './errors';

export type { ErrorCatalogEntry } from './catalog';

// Error Constructors

export {
  // Storage errors
  storageQuotaExceeded,
  storageNotFound,
  storageCorrupted,
  storageUnavailable,
  storageNetworkError,

  // Validation errors
  validationOutOfBounds,
  validationCollision,
  validationInvalidLayer,
  validationHeightExceeded,
  validationBlockedZone,
  validationImportFailed,

  // Layout errors
  layoutLayerLimit,
  layoutCategoryLimit,
  layoutLibraryLimit,
  layoutLastEntity,
  layoutInvalidOperation,

  // API errors
  apiRateLimited,
  apiUnauthorized,
  apiNotFound,
  apiServerError,
  apiNetworkError,
  apiTimeout,
  apiValidationError,
  apiContentBlocked,
  apiSizeLimit,
  apiBinLimit,
  apiExpired,
  apiInvalidExpiration,

  // Generic
  unknownError,
  fromUnknown,
} from './constructors';
