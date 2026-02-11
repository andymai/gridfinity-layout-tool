/**
 * Shared With Me Service - storage for layouts shared by other users.
 *
 * This module handles persistence for the "Shared with me" list - layouts
 * that other users have shared with you via cloud share links.
 *
 * API variants:
 * - Standard functions: Return data directly, log errors
 * - *Result suffix: Return Result<T, StorageError> for explicit error handling
 *
 * Storage key: gridfinity-shared-with-me-v1
 */

import type { SharedWithMeEntry } from '@/core/types';
import type { Result } from '@/core/result';
import type { StorageError } from '@/core/result/errors';
import { ok, err, storageCorrupted } from '@/core/result';
import { classifyStorageError } from './errorUtils';

const SHARED_WITH_ME_KEY = 'gridfinity-shared-with-me-v1';

interface SharedWithMeIndex {
  version: '1.0';
  entries: SharedWithMeEntry[];
}

/**
 * Save shared-with-me entries to localStorage.
 */
export function saveSharedWithMe(entries: SharedWithMeEntry[]): void {
  try {
    const data: SharedWithMeIndex = {
      version: '1.0',
      entries,
    };
    localStorage.setItem(SHARED_WITH_ME_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save shared-with-me entries:', error);
  }
}

/**
 * Load shared-with-me entries from localStorage.
 */
export function loadSharedWithMe(): SharedWithMeEntry[] {
  try {
    const raw = localStorage.getItem(SHARED_WITH_ME_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw) as SharedWithMeIndex;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- validate structure from localStorage
    if (!data.entries || !Array.isArray(data.entries)) {
      return [];
    }

    return data.entries;
  } catch (error) {
    console.error('Failed to load shared-with-me entries:', error);
    return [];
  }
}

/**
 * Clear all shared-with-me entries from localStorage.
 */
export function clearSharedWithMe(): void {
  try {
    localStorage.removeItem(SHARED_WITH_ME_KEY);
  } catch (error) {
    console.error('Failed to clear shared-with-me entries:', error);
  }
}

// === Result-Based Operations ===
// These functions return Result<T, StorageError> for explicit error handling.
// Use these when you need detailed error information for user feedback.

/**
 * Save shared-with-me entries with Result-based error handling.
 * Returns Ok on success, or Err with specific StorageError on failure.
 *
 * @example
 * ```typescript
 * const result = saveSharedWithMeResult(entries);
 * if (isErr(result)) {
 *   if (result.error.code === 'STORAGE_QUOTA_EXCEEDED') {
 *     addToast('Storage full. Remove some shared layouts.', 'error');
 *   }
 * }
 * ```
 */
export function saveSharedWithMeResult(entries: SharedWithMeEntry[]): Result<void, StorageError> {
  try {
    const data: SharedWithMeIndex = {
      version: '1.0',
      entries,
    };
    localStorage.setItem(SHARED_WITH_ME_KEY, JSON.stringify(data));
    return ok(undefined);
  } catch (error) {
    return err(classifyStorageError(error, 'localStorage'));
  }
}

/**
 * Load shared-with-me entries with Result-based error handling.
 * Returns Ok with entries on success (empty array if not found),
 * or Err with StorageError on parse/validation failure.
 *
 * @example
 * ```typescript
 * const result = loadSharedWithMeResult();
 * if (isOk(result)) {
 *   setEntries(result.value);
 * } else {
 *   console.error('Failed to load:', getUserMessage(result.error));
 * }
 * ```
 */
export function loadSharedWithMeResult(): Result<SharedWithMeEntry[], StorageError> {
  try {
    const raw = localStorage.getItem(SHARED_WITH_ME_KEY);
    if (!raw) return ok([]);

    const data = JSON.parse(raw) as SharedWithMeIndex;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- validate structure from localStorage
    if (!data.entries || !Array.isArray(data.entries)) {
      return err(
        storageCorrupted(SHARED_WITH_ME_KEY, ['Invalid data structure: missing entries array'])
      );
    }

    return ok(data.entries);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(storageCorrupted(SHARED_WITH_ME_KEY, [message], error));
  }
}

/**
 * Clear all shared-with-me entries with Result-based error handling.
 * Returns Ok on success, or Err with StorageError on failure.
 */
export function clearSharedWithMeResult(): Result<void, StorageError> {
  try {
    localStorage.removeItem(SHARED_WITH_ME_KEY);
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(storageCorrupted(SHARED_WITH_ME_KEY, [message], error));
  }
}
