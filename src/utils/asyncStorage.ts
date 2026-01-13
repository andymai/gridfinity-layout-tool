/**
 * Async storage layer for layout data.
 *
 * This module provides an async API for storing layouts, using IndexedDB
 * as the primary backend with localStorage fallback for environments
 * where IndexedDB is unavailable.
 *
 * Key features:
 * - Uses IndexedDB for large storage capacity (50MB+)
 * - Automatically compresses data (~60-70% size reduction)
 * - Falls back to localStorage if IndexedDB unavailable
 * - Transparent API regardless of backend
 */

import {
  saveLayout as idbSaveLayout,
  loadLayout as idbLoadLayout,
  deleteLayout as idbDeleteLayout,
  getAllLayoutIds as idbGetAllLayoutIds,
  isIndexedDBAvailable,
} from './indexedDB';
import type { Layout } from '../types';

// Storage key prefix for localStorage fallback
const LAYOUT_KEY_PREFIX = 'gridfinity-layout-';

// Cache the backend determination
let cachedBackend: 'indexeddb' | 'localstorage' | null = null;

/**
 * Determine which storage backend to use.
 */
export async function getStorageBackend(): Promise<'indexeddb' | 'localstorage'> {
  if (cachedBackend) {
    return cachedBackend;
  }

  if (await isIndexedDBAvailable()) {
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

// === LocalStorage fallback implementations ===

function saveLayoutToLocalStorage(layoutId: string, layout: Layout): void {
  const key = `${LAYOUT_KEY_PREFIX}${layoutId}`;
  localStorage.setItem(key, JSON.stringify(layout));
}

function loadLayoutFromLocalStorage(layoutId: string): Layout | null {
  const key = `${LAYOUT_KEY_PREFIX}${layoutId}`;
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Layout;
  } catch {
    return null;
  }
}

function deleteLayoutFromLocalStorage(layoutId: string): void {
  const key = `${LAYOUT_KEY_PREFIX}${layoutId}`;
  localStorage.removeItem(key);
}

function getAllLayoutIdsFromLocalStorage(): string[] {
  const ids: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LAYOUT_KEY_PREFIX)) {
      ids.push(key.slice(LAYOUT_KEY_PREFIX.length));
    }
  }

  return ids;
}

// === Public async API ===

/**
 * Save a layout asynchronously.
 * Uses IndexedDB if available, falls back to localStorage.
 */
export async function saveLayoutAsync(layoutId: string, layout: Layout): Promise<void> {
  const backend = await getStorageBackend();

  if (backend === 'indexeddb') {
    await idbSaveLayout(layoutId, layout);
  } else {
    saveLayoutToLocalStorage(layoutId, layout);
  }
}

/**
 * Load a layout asynchronously.
 * Uses IndexedDB if available, falls back to localStorage.
 */
export async function loadLayoutAsync(layoutId: string): Promise<Layout | null> {
  const backend = await getStorageBackend();

  if (backend === 'indexeddb') {
    return idbLoadLayout(layoutId);
  } else {
    return loadLayoutFromLocalStorage(layoutId);
  }
}

/**
 * Delete a layout asynchronously.
 * Uses IndexedDB if available, falls back to localStorage.
 */
export async function deleteLayoutAsync(layoutId: string): Promise<void> {
  const backend = await getStorageBackend();

  if (backend === 'indexeddb') {
    await idbDeleteLayout(layoutId);
  } else {
    deleteLayoutFromLocalStorage(layoutId);
  }
}

/**
 * Get all layout IDs asynchronously.
 * Uses IndexedDB if available, falls back to localStorage.
 */
export async function getAllLayoutIdsAsync(): Promise<string[]> {
  const backend = await getStorageBackend();

  if (backend === 'indexeddb') {
    return idbGetAllLayoutIds();
  } else {
    return getAllLayoutIdsFromLocalStorage();
  }
}

/**
 * Check if async storage is ready.
 * Can be used to show loading state during initialization.
 */
export async function isStorageReady(): Promise<boolean> {
  try {
    await getStorageBackend();
    return true;
  } catch {
    return false;
  }
}
