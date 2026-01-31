/**
 * Unified storage backend with dual-write strategy.
 *
 * This module provides the primary interface for storage operations,
 * implementing a dual-write pattern:
 * - Async operations: IndexedDB primary + localStorage backup
 * - Sync operations: localStorage only (for initialization)
 *
 * The dual-write pattern ensures:
 * - Large layouts work (IndexedDB has 50MB+ capacity)
 * - Fast sync initialization (localStorage is synchronous)
 * - Resilience (if one backend fails, the other still works)
 */

import * as localStorage from './backends/localStorage';
import * as indexedDB from './backends/indexedDB';
import type { Layout } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import { isErr, isOk } from '@/core/result';

// Cache the backend determination for async operations
let cachedBackend: 'indexeddb' | 'localstorage' | null = null;

/**
 * Determine which storage backend to use for async operations.
 * Result is cached for the session.
 */
export async function getStorageBackend(): Promise<'indexeddb' | 'localstorage'> {
  if (cachedBackend) {
    return cachedBackend;
  }

  if (await indexedDB.isIndexedDBAvailable()) {
    cachedBackend = 'indexeddb';
  } else {
    cachedBackend = 'localstorage';
  }

  return cachedBackend;
}

/**
 * Reset the cached backend (for testing).
 */
export function resetStorageBackendCache(): void {
  cachedBackend = null;
}

// === Async Operations (Primary API) ===
// Use IndexedDB as primary with localStorage backup

/**
 * Save a layout asynchronously using dual-write pattern.
 * Primary: IndexedDB (large capacity)
 * Backup: localStorage (may fail for large layouts, that's OK)
 */
export async function saveAsync(key: string, layout: Layout): Promise<void> {
  const backend = await getStorageBackend();

  if (backend === 'indexeddb') {
    // Primary: IndexedDB
    await indexedDB.saveLayout(key, layout);

    // Backup: localStorage (ignore errors - IndexedDB has it)
    const backupResult = localStorage.saveLayout(key, layout);
    if (isErr(backupResult)) {
      console.warn(`[Storage] localStorage backup failed for ${key} - using IndexedDB only`);
    }
  } else {
    // Fallback: localStorage only
    const result = localStorage.saveLayout(key, layout);
    if (isErr(result)) {
      throw new Error('Storage full. Export your layout to save it.');
    }
  }
}

/**
 * Load a layout asynchronously with fallback.
 * Tries IndexedDB first, falls back to localStorage.
 */
export async function loadAsync(key: string): Promise<Layout | null> {
  const backend = await getStorageBackend();

  if (backend === 'indexeddb') {
    // Try IndexedDB first
    let layout = await indexedDB.loadLayout(key);

    // Fall back to localStorage if not in IndexedDB
    if (!layout) {
      const result = localStorage.loadLayout(key);
      layout = isOk(result) ? result.value : null;
    }

    return layout;
  } else {
    // localStorage only
    const result = localStorage.loadLayout(key);
    return isOk(result) ? result.value : null;
  }
}

/**
 * Delete a layout asynchronously from both backends.
 */
export async function deleteAsync(key: string): Promise<void> {
  const backend = await getStorageBackend();

  if (backend === 'indexeddb') {
    await indexedDB.deleteLayout(key);
  }

  // Always clean up localStorage
  localStorage.deleteFromLocalStorage(key);
}

// === Sync Operations (Initialization Only) ===
// Use localStorage only - fast and synchronous

/**
 * Save a layout synchronously to localStorage.
 * Used only during initialization when async is not available.
 * Returns Result with StorageError if storage is full.
 */
export function saveSync(key: string, layout: Layout): Result<void, StorageError> {
  return localStorage.saveLayout(key, layout);
}

/**
 * Load a layout synchronously from localStorage.
 * Used only during initialization.
 */
export function loadSync(key: string): Layout | null {
  const result = localStorage.loadLayout(key);
  return isOk(result) ? result.value : null;
}

/**
 * Delete a layout synchronously from localStorage.
 */
export function deleteSync(key: string): void {
  localStorage.deleteFromLocalStorage(key);
}

// === Generic Sync Operations (for non-Layout data like library index) ===

/**
 * Save arbitrary data synchronously to localStorage.
 * Returns Result with StorageError if storage is full.
 */
export function saveSyncGeneric<T>(key: string, data: T): Result<void, StorageError> {
  return localStorage.saveToLocalStorage(key, data);
}

/**
 * Load arbitrary data synchronously from localStorage.
 */
export function loadSyncGeneric<T>(key: string): T | null {
  const result = localStorage.loadFromLocalStorage<T>(key);
  return isOk(result) ? result.value : null;
}

// === Utility Exports ===

export { getStorageUsagePercent } from './backends/localStorage';
export { getAllLayoutIds as getLocalStorageLayoutIds } from './backends/localStorage';
export { getAllLayoutIds as getIndexedDBLayoutIds } from './backends/indexedDB';
export { isIndexedDBAvailable } from './backends/indexedDB';
