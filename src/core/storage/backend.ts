/**
 * Unified storage backend abstraction.
 *
 * This module provides the primary interface for storage operations:
 * - Async operations: IndexedDB (primary, large capacity)
 * - Sync operations: localStorage only (for initialization)
 *
 * When IndexedDB is available, async saves go ONLY to IndexedDB to avoid
 * filling the ~5 MB localStorage quota. The sync init path reads from
 * localStorage for fast startup; if a layout is missing there but exists
 * in IndexedDB, useIndexedDBRecovery restores it asynchronously.
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
// IndexedDB only — no localStorage backup (saves ~5 MB quota for other uses)

/**
 * Save a layout asynchronously.
 * When IndexedDB is available, writes ONLY to IndexedDB.
 * Falls back to localStorage when IndexedDB is unavailable.
 */
export async function saveAsync(key: string, layout: Layout): Promise<void> {
  const backend = await getStorageBackend();

  if (backend === 'indexeddb') {
    try {
      await indexedDB.saveLayout(key, layout);
    } catch {
      // IndexedDB write failed — fall back to localStorage so data isn't lost
      const result = localStorage.saveLayout(key, layout);
      if (isErr(result)) {
        throw new Error('Storage full. Export your layout to save it.');
      }
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
export function saveSyncGeneric(key: string, data: unknown): Result<void, StorageError> {
  return localStorage.saveToLocalStorage(key, data);
}

/**
 * Load arbitrary data synchronously from localStorage.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T provides caller-side type safety
export function loadSyncGeneric<T>(key: string): T | null {
  const result = localStorage.loadFromLocalStorage<T>(key);
  return isOk(result) ? result.value : null;
}

// === Utility Exports ===

export { getStorageUsagePercent } from './backends/localStorage';
export { getAllLayoutIds as getLocalStorageLayoutIds } from './backends/localStorage';
export { getAllLayoutIds as getIndexedDBLayoutIds } from './backends/indexedDB';
export { isIndexedDBAvailable } from './backends/indexedDB';
