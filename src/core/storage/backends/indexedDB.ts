/**
 * IndexedDB backend - thin wrapper around utils/indexedDB.
 *
 * This module provides a consistent interface for IndexedDB operations,
 * wrapping the lower-level utils/indexedDB.ts implementation.
 */

import {
  saveLayout as idbSaveLayout,
  loadLayout as idbLoadLayout,
  deleteLayout as idbDeleteLayout,
  getAllLayoutIds as idbGetAllLayoutIds,
  isIndexedDBAvailable as idbIsAvailable,
} from '@/utils/indexedDB';
import type { Layout } from '@/core/types';

/**
 * Check if IndexedDB is available in the current environment.
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
  return idbIsAvailable();
}

/**
 * Save a layout to IndexedDB with compression.
 */
export async function saveLayout(id: string, layout: Layout): Promise<void> {
  await idbSaveLayout(id, layout);
}

/**
 * Load a layout from IndexedDB.
 * @returns The layout or null if not found
 */
export async function loadLayout(id: string): Promise<Layout | null> {
  return idbLoadLayout(id);
}

/**
 * Delete a layout from IndexedDB.
 */
export async function deleteLayout(id: string): Promise<void> {
  await idbDeleteLayout(id);
}

/**
 * Get all stored layout IDs from IndexedDB.
 */
export async function getAllLayoutIds(): Promise<string[]> {
  return idbGetAllLayoutIds();
}
