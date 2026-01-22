/**
 * Storage Error Utilities
 *
 * Centralizes error classification logic that was previously duplicated
 * across LayoutService.ts and LayoutManager.ts.
 *
 * @module storage/errorUtils
 */

import type { StorageError } from '@/core/result';
import { storageQuotaExceeded, storageUnavailable } from '@/core/result';

/**
 * Patterns that indicate a quota/storage full error.
 * These strings appear in browser error messages across different engines.
 */
const QUOTA_ERROR_PATTERNS = [
  'quota',
  'QuotaExceeded',
  'QuotaExceededError',
  'Storage full',
  'storage quota',
  'NS_ERROR_DOM_QUOTA_REACHED',
] as const;

/**
 * Patterns that indicate storage is unavailable or inaccessible.
 * These can occur due to security restrictions, private browsing, etc.
 */
const UNAVAILABLE_ERROR_PATTERNS = [
  'unavailable',
  'SecurityError',
  'access denied',
  'not allowed',
  'blocked',
  'NS_ERROR_FILE_CORRUPTED',
] as const;

/**
 * Extract error message from unknown error value.
 *
 * @param error - The caught error value (may be Error, string, or other)
 * @returns The error message string
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Check if an error message matches any of the given patterns.
 * Case-insensitive matching.
 *
 * @param message - The error message to check
 * @param patterns - Array of patterns to match against
 * @returns true if any pattern matches
 */
function matchesAnyPattern(
  message: string,
  patterns: readonly string[]
): boolean {
  const lowerMessage = message.toLowerCase();
  return patterns.some((pattern) =>
    lowerMessage.includes(pattern.toLowerCase())
  );
}

/**
 * Classify an unknown error into a typed StorageError.
 *
 * This function centralizes the error classification logic that was previously
 * duplicated across multiple storage functions. It examines the error message
 * to determine whether it's a quota error, unavailability error, or generic error.
 *
 * @param error - The caught error (unknown type from catch block)
 * @param storageType - The storage backend type (e.g., 'indexedDB', 'localStorage')
 * @returns A typed StorageError with appropriate error code and message
 *
 * @example
 * ```ts
 * try {
 *   await saveToStorage(data);
 * } catch (error) {
 *   return err(classifyStorageError(error, 'indexedDB'));
 * }
 * ```
 */
export function classifyStorageError(
  error: unknown,
  storageType: 'indexedDB' | 'localStorage' = 'indexedDB'
): StorageError {
  const message = extractErrorMessage(error);
  const originalError = error instanceof Error ? error : undefined;

  // Check for quota exceeded errors
  if (matchesAnyPattern(message, QUOTA_ERROR_PATTERNS)) {
    return storageQuotaExceeded(undefined, undefined, originalError);
  }

  // Check for storage unavailable errors
  if (matchesAnyPattern(message, UNAVAILABLE_ERROR_PATTERNS)) {
    return storageUnavailable(storageType, originalError);
  }

  // Default to unavailable with the original error context
  return storageUnavailable(storageType, originalError);
}

/**
 * Create an error classifier function for use with tryCatchAsync.
 *
 * This is a convenience function that returns a classifier bound to a specific
 * storage type, suitable for passing to tryCatchAsync.
 *
 * @param storageType - The storage backend type
 * @returns A function that classifies errors for that storage type
 *
 * @example
 * ```ts
 * const result = await tryCatchAsync(
 *   () => backend.saveAsync(key, data),
 *   createStorageErrorClassifier('indexedDB')
 * );
 * ```
 */
export function createStorageErrorClassifier(
  storageType: 'indexedDB' | 'localStorage' = 'indexedDB'
): (error: unknown) => StorageError {
  return (error: unknown) => classifyStorageError(error, storageType);
}
