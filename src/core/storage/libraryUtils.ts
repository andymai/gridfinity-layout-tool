/**
 * Library Entry Utilities
 *
 * Centralizes library entry manipulation logic that was previously duplicated
 * across LayoutManager.ts functions (saveLayoutWithMetadata, updateCloudShare,
 * renameLayoutEntry, etc.).
 *
 * @module storage/libraryUtils
 */

import type { LayoutEntry, LayoutLibrary } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import { ok, err, storageNotFound } from '@/core/result';
import { getLayoutStorageKey } from './LayoutService';

/**
 * Find a library entry by layout ID.
 *
 * @param library - The layout library to search
 * @param layoutId - The ID of the layout to find
 * @returns The entry and its index, or null if not found
 */
export function findLibraryEntry(
  library: LayoutLibrary,
  layoutId: string
): { entry: LayoutEntry; index: number } | null {
  const index = library.entries.findIndex((e) => e.id === layoutId);
  if (index === -1) {
    return null;
  }
  return { entry: library.entries[index], index };
}

/**
 * Find a library entry by layout ID, returning a Result.
 *
 * @param library - The layout library to search
 * @param layoutId - The ID of the layout to find
 * @returns Result with entry and index, or StorageError if not found
 */
export function findLibraryEntryResult(
  library: LayoutLibrary,
  layoutId: string
): Result<{ entry: LayoutEntry; index: number }, StorageError> {
  const found = findLibraryEntry(library, layoutId);
  if (!found) {
    return err(storageNotFound(getLayoutStorageKey(layoutId)));
  }
  return ok(found);
}

/**
 * Update a single library entry immutably by its index.
 *
 * This replaces the common pattern:
 * ```ts
 * const updatedLibrary = {
 *   ...library,
 *   entries: [
 *     ...library.entries.slice(0, entryIndex),
 *     updatedEntry,
 *     ...library.entries.slice(entryIndex + 1),
 *   ],
 * };
 * ```
 *
 * @param library - The current library state
 * @param entryIndex - The index of the entry to update
 * @param updates - Partial updates to apply to the entry
 * @returns New library with the updated entry
 */
export function updateLibraryEntryAtIndex(
  library: LayoutLibrary,
  entryIndex: number,
  updates: Partial<LayoutEntry>
): LayoutLibrary {
  const existingEntry = library.entries[entryIndex];
  const updatedEntry: LayoutEntry = {
    ...existingEntry,
    ...updates,
  };

  return {
    ...library,
    entries: [
      ...library.entries.slice(0, entryIndex),
      updatedEntry,
      ...library.entries.slice(entryIndex + 1),
    ],
  };
}

/**
 * Update a library entry by its layout ID.
 *
 * Combines find + update into a single operation with Result-based error handling.
 * This is the preferred method for updating entries when you have the layout ID.
 *
 * @param library - The current library state
 * @param layoutId - The ID of the layout entry to update
 * @param updates - Partial updates to apply to the entry
 * @returns Result with updated library, or StorageError if not found
 *
 * @example
 * ```ts
 * const result = updateLibraryEntryById(library, layoutId, {
 *   name: newName,
 *   modifiedAt: Date.now(),
 * });
 *
 * if (isOk(result)) {
 *   await saveLibrary(result.value);
 * }
 * ```
 */
export function updateLibraryEntryById(
  library: LayoutLibrary,
  layoutId: string,
  updates: Partial<LayoutEntry>
): Result<LayoutLibrary, StorageError> {
  const found = findLibraryEntry(library, layoutId);
  if (!found) {
    return err(storageNotFound(getLayoutStorageKey(layoutId)));
  }

  return ok(updateLibraryEntryAtIndex(library, found.index, updates));
}

/**
 * Remove a library entry by its layout ID.
 *
 * @param library - The current library state
 * @param layoutId - The ID of the layout entry to remove
 * @returns Result with updated library (without the entry), or StorageError if not found
 */
export function removeLibraryEntry(
  library: LayoutLibrary,
  layoutId: string
): Result<LayoutLibrary, StorageError> {
  const found = findLibraryEntry(library, layoutId);
  if (!found) {
    return err(storageNotFound(getLayoutStorageKey(layoutId)));
  }

  return ok({
    ...library,
    entries: library.entries.filter((e) => e.id !== layoutId),
  });
}

/**
 * Add a new entry to the library.
 *
 * @param library - The current library state
 * @param entry - The new entry to add
 * @param position - Where to insert: 'start' (default) or 'end'
 * @returns New library with the added entry
 */
export function addLibraryEntry(
  library: LayoutLibrary,
  entry: LayoutEntry,
  position: 'start' | 'end' = 'start'
): LayoutLibrary {
  return {
    ...library,
    entries: position === 'start' ? [entry, ...library.entries] : [...library.entries, entry],
  };
}
