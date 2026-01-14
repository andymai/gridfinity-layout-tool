/**
 * LocalStorage backend - single source of truth for localStorage operations.
 *
 * This module provides the canonical localStorage implementation used by
 * the storage layer. All localStorage access should go through this module
 * to eliminate code duplication and ensure consistent error handling.
 */

import type { Layout, LayoutLibrary } from '../../types';

/**
 * Save data to localStorage as JSON.
 * @throws Error if storage is full
 */
export function saveToLocalStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    throw new Error('Storage full. Export your layout to save it.');
  }
}

/**
 * Load and parse JSON data from localStorage.
 * @returns Parsed data or null if not found
 * @throws Error if JSON parsing fails (caller should handle)
 */
export function loadFromLocalStorage<T>(key: string): T | null {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  return JSON.parse(stored) as T;
}

/**
 * Delete a key from localStorage.
 */
export function deleteFromLocalStorage(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Check if a key exists in localStorage.
 */
export function existsInLocalStorage(key: string): boolean {
  return localStorage.getItem(key) !== null;
}

/**
 * Get all keys that start with a given prefix.
 */
export function getAllKeysWithPrefix(prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Get all layout IDs from localStorage keys.
 */
export function getAllLayoutIds(prefix: string): string[] {
  return getAllKeysWithPrefix(prefix).map(key => key.slice(prefix.length));
}

/**
 * Calculate localStorage usage percentage.
 * Assumes 5MB limit (standard for most browsers).
 */
export function getStorageUsagePercent(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          total += (key.length + value.length) * 2; // UTF-16
        }
      }
    }
    // Assume 5MB limit
    return Math.round((total / (5 * 1024 * 1024)) * 100);
  } catch {
    return 0;
  }
}

// Type-specific helpers for better type safety

/**
 * Save a layout to localStorage.
 */
export function saveLayout(key: string, layout: Layout): void {
  saveToLocalStorage(key, layout);
}

/**
 * Load a layout from localStorage.
 */
export function loadLayout(key: string): Layout | null {
  return loadFromLocalStorage<Layout>(key);
}

/**
 * Save the library index to localStorage.
 */
export function saveLibraryIndex(key: string, library: LayoutLibrary): void {
  saveToLocalStorage(key, library);
}

/**
 * Load the library index from localStorage.
 */
export function loadLibraryIndex(key: string): LayoutLibrary | null {
  return loadFromLocalStorage<LayoutLibrary>(key);
}
