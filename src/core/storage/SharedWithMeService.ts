/**
 * Shared With Me Service - storage for layouts shared by other users.
 *
 * This module handles persistence for the "Shared with me" list - layouts
 * that other users have shared with you via cloud share links.
 *
 * All localStorage functions return Result<T, StorageError> for explicit
 * error handling. Callers that don't need error info can ignore the Result.
 *
 * Storage key: gridfinity-shared-with-me-v1
 */

import type { SharedWithMeEntry } from '@/core/types';
import type { Result } from '@/core/result';
import type { StorageError } from '@/core/result/errors';
import { ok, err, isOk, storageCorrupted } from '@/core/result';
import { classifyStorageError } from './errorUtils';
import * as indexedDB from './backends/indexedDB';

const SHARED_WITH_ME_KEY = 'gridfinity-shared-with-me-v1';

interface SharedWithMeIndex {
  version: '1.0';
  entries: SharedWithMeEntry[];
}

/**
 * Save shared-with-me entries to localStorage.
 * Returns Ok on success, or Err with specific StorageError on failure.
 *
 * @example
 * ```typescript
 * const result = saveSharedWithMe(entries);
 * if (isErr(result)) {
 *   if (result.error.code === 'STORAGE_QUOTA_EXCEEDED') {
 *     addToast('Storage full. Remove some shared layouts.', 'error');
 *   }
 * }
 * ```
 */
export function saveSharedWithMe(entries: SharedWithMeEntry[]): Result<void, StorageError> {
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
 * Load shared-with-me entries from localStorage.
 * Returns Ok with entries on success (empty array if not found),
 * or Err with StorageError on parse/validation failure.
 *
 * @example
 * ```typescript
 * const result = loadSharedWithMe();
 * if (isOk(result)) {
 *   setEntries(result.value);
 * } else {
 *   console.error('Failed to load:', getUserMessage(result.error));
 * }
 * ```
 */
export function loadSharedWithMe(): Result<SharedWithMeEntry[], StorageError> {
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
 * Clear all shared-with-me entries from localStorage.
 * Returns Ok on success, or Err with StorageError on failure.
 */
export function clearSharedWithMe(): Result<void, StorageError> {
  try {
    localStorage.removeItem(SHARED_WITH_ME_KEY);
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(storageCorrupted(SHARED_WITH_ME_KEY, [message], error));
  }
}

// === Async IDB-backed Operations ===
// These try IndexedDB first, falling back to localStorage.

/**
 * Save shared-with-me entries to IndexedDB (primary) with localStorage fallback.
 */
export async function saveSharedWithMeAsync(entries: SharedWithMeEntry[]): Promise<void> {
  try {
    await indexedDB.saveSharedWithMeEntries(entries);
  } catch {
    // Fall back to localStorage
    saveSharedWithMe(entries);
  }
}

/**
 * Load shared-with-me entries from IndexedDB (primary), falling back to localStorage.
 */
export async function loadSharedWithMeAsync(): Promise<SharedWithMeEntry[]> {
  try {
    const entries = await indexedDB.loadSharedWithMeEntries();
    if (entries !== null) return entries;
  } catch {
    // Fall back to localStorage
  }
  const result = loadSharedWithMe();
  return isOk(result) ? result.value : [];
}

/**
 * Clear shared-with-me entries from both IndexedDB and localStorage.
 */
export async function clearSharedWithMeAsync(): Promise<void> {
  try {
    await indexedDB.clearSharedWithMeEntries();
  } catch {
    /* ignore */
  }
  clearSharedWithMe();
}

// === Deprecated Aliases ===
// These are kept for backward compatibility during the Result migration.
// Prefer the non-suffixed versions above.

/** @deprecated Use saveSharedWithMe instead */
export const saveSharedWithMeResult = saveSharedWithMe;
/** @deprecated Use loadSharedWithMe instead */
export const loadSharedWithMeResult = loadSharedWithMe;
/** @deprecated Use clearSharedWithMe instead */
export const clearSharedWithMeResult = clearSharedWithMe;
