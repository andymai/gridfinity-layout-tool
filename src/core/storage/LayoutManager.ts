/**
 * LayoutManager - Atomic layout operations with library synchronization.
 *
 * This is the primary API for layout CRUD operations. All operations:
 * - Save layout data atomically with library metadata
 * - Compute preview automatically
 * - Update timestamps automatically
 * - Return Result<T, E> for explicit error handling
 *
 * This module consolidates the previously scattered pattern of:
 *   saveLayoutResult() → updateEntry() → saveLibraryResult()
 * into single atomic operations that are easier to use correctly.
 *
 * @example Save current layout:
 * ```ts
 * const result = await saveLayoutWithMetadata(layoutId, layout, library);
 * if (isOk(result)) {
 *   setLibrary(result.value.library); // Sync store with persisted state
 * }
 * ```
 */

import * as backend from './backend';
import { validateImport } from '@/shared/utils/validation';
import { generateLayoutId } from '@/shared/utils';
import { STAGING_ID, CONSTRAINTS } from '@/core/constants';
import type {
  Layout,
  LayoutEntry,
  LayoutLibrary,
  LayoutPreview,
  ThumbnailBin,
  CloudShareInfo,
} from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import {
  ok,
  err,
  isErr,
  tryCatchAsync,
  storageNotFound,
  storageCorrupted,
  storageUnavailable,
} from '@/core/result';
import { classifyStorageError, createStorageErrorClassifier } from './errorUtils';
import { findLibraryEntry, updateLibraryEntryAtIndex } from './libraryUtils';

// === Storage Keys ===

const LIBRARY_STORAGE_KEY = 'gridfinity-library-v1';
const LAYOUT_KEY_PREFIX = 'gridfinity-layout-';

function getLayoutKey(id: string): string {
  return `${LAYOUT_KEY_PREFIX}${id}`;
}

// === Types ===

/** Options for saving a layout */
export interface SaveLayoutOptions {
  /** Custom name (defaults to layout.name) */
  name?: string;
  /** Skip preview computation (useful when preview is pre-computed) */
  skipPreview?: boolean;
  /** Pre-computed preview (use with skipPreview: true) */
  preview?: LayoutPreview;
}

/** Result of a successful save operation */
export interface SaveResult {
  layoutId: string;
  entry: LayoutEntry;
  library: LayoutLibrary;
}

/** Options for creating a new layout */
export interface CreateLayoutOptions extends SaveLayoutOptions {
  /** Author name for the entry */
  author?: string;
  /** ForkedFrom info for imports */
  forkedFrom?: { name: string; author?: string };
}

/** Result of creating a new layout */
export interface CreateResult extends SaveResult {
  layout: Layout;
}

/** Result of switching layouts */
export interface SwitchResult {
  library: LayoutLibrary;
  targetLayout: Layout;
  targetEntry: LayoutEntry;
}

/** Result of deleting a layout */
export interface DeleteResult {
  library: LayoutLibrary;
  /** New active ID if deleted layout was active */
  newActiveId?: string;
}

/** Result of duplicating a layout */
export interface DuplicateResult extends SaveResult {
  layout: Layout;
}

// === Preview Computation (Single Source of Truth) ===

/**
 * Compute preview data from a layout.
 * Includes binMap for thumbnail rendering (top-down view of all bins).
 *
 * This is the canonical implementation - use this instead of duplicating
 * preview computation logic elsewhere.
 */
export function computePreview(layout: Layout): LayoutPreview {
  const categoryColors = new Map<string, string>();
  for (const cat of layout.categories) {
    categoryColors.set(cat.id, cat.color);
  }

  const binMap: ThumbnailBin[] = layout.bins
    .filter((bin) => bin.layerId !== STAGING_ID)
    .map((bin) => ({
      x: bin.x,
      y: bin.y,
      w: bin.width,
      d: bin.depth,
      c: categoryColors.get(bin.category) || '#6B7280',
    }));

  return {
    drawerWidth: layout.drawer.width,
    drawerDepth: layout.drawer.depth,
    drawerHeight: layout.drawer.height,
    binCount: layout.bins.length,
    layerCount: layout.layers.length,
    binMap,
  };
}

// === Internal Helpers ===

/**
 * Save library to localStorage.
 */
function saveLibraryInternal(library: LayoutLibrary): Result<void, StorageError> {
  try {
    backend.saveSyncGeneric(LIBRARY_STORAGE_KEY, library);
    return ok(undefined);
  } catch (error) {
    return err(classifyStorageError(error, 'localStorage'));
  }
}

/**
 * Save layout to storage (IndexedDB + localStorage).
 */
async function saveLayoutInternal(
  layoutId: string,
  layout: Layout
): Promise<Result<void, StorageError>> {
  const key = getLayoutKey(layoutId);

  return tryCatchAsync(
    () => backend.saveAsync(key, layout),
    createStorageErrorClassifier('indexedDB')
  );
}

/**
 * Load layout from storage (IndexedDB with localStorage fallback).
 */
async function loadLayoutInternal(layoutId: string): Promise<Result<Layout, StorageError>> {
  const key = getLayoutKey(layoutId);

  let data: Layout | null;
  try {
    data = await backend.loadAsync(key);
  } catch (error) {
    return err(storageUnavailable('indexedDB', error));
  }

  if (!data) {
    return err(storageNotFound(key));
  }

  // Validate the loaded layout
  const validation = validateImport(data as unknown as Record<string, unknown>);
  if (!validation.valid) {
    return err(storageCorrupted(key, validation.errors));
  }

  return ok(data);
}

/**
 * Delete layout from storage (both IndexedDB and localStorage).
 */
async function deleteLayoutInternal(layoutId: string): Promise<Result<void, StorageError>> {
  const key = getLayoutKey(layoutId);

  return tryCatchAsync(
    () => backend.deleteAsync(key),
    (error): StorageError => storageUnavailable('indexedDB', error)
  );
}

// === Primary API ===

/**
 * Save a layout atomically with library metadata update.
 *
 * This is the PRIMARY method for saving existing layouts. It:
 * 1. Saves layout data to storage (IndexedDB + localStorage backup)
 * 2. Computes preview from layout data (unless skipPreview is true)
 * 3. Updates library entry with new metadata (name, modifiedAt, preview)
 * 4. Saves library index
 *
 * Returns the updated library for syncing with the store.
 *
 * @param layoutId - ID of the layout to save
 * @param layout - Layout data to save
 * @param library - Current library state (will be updated and persisted)
 * @param options - Optional name override, preview skip, etc.
 *
 * @example
 * ```ts
 * const result = await saveLayoutWithMetadata(activeLayoutId, layout, library);
 * if (isOk(result)) {
 *   setLibrary(result.value.library);
 * } else {
 *   addToast(getUserMessage(result.error), 'error');
 * }
 * ```
 */
export async function saveLayoutWithMetadata(
  layoutId: string,
  layout: Layout,
  library: LayoutLibrary,
  options: SaveLayoutOptions = {}
): Promise<Result<SaveResult, StorageError>> {
  // 1. Validate entry exists
  const found = findLibraryEntry(library, layoutId);
  if (!found) {
    return err(storageNotFound(getLayoutKey(layoutId)));
  }

  // 2. Save layout data
  const saveResult = await saveLayoutInternal(layoutId, layout);
  if (isErr(saveResult)) {
    return saveResult;
  }

  // 3. Compute updates
  const now = Date.now();
  const preview = options.skipPreview
    ? (options.preview ?? found.entry.preview)
    : computePreview(layout);

  // 4. Build updated library using helper
  const updatedLibrary = updateLibraryEntryAtIndex(library, found.index, {
    name: (options.name ?? layout.name).slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
    modifiedAt: now,
    preview,
  });
  const updatedEntry = updatedLibrary.entries[found.index];

  // 5. Save library
  const librarySaveResult = saveLibraryInternal(updatedLibrary);
  if (isErr(librarySaveResult)) {
    // Layout saved but library failed - data is preserved but metadata may be stale
    return librarySaveResult;
  }

  return ok({
    layoutId,
    entry: updatedEntry,
    library: updatedLibrary,
  });
}

/**
 * Create a new layout entry in the library.
 *
 * This is for creating NEW layouts (not updating existing ones). It:
 * 1. Generates a new layout ID (or uses provided one)
 * 2. Saves layout data to storage
 * 3. Creates a new library entry
 * 4. Saves the updated library
 *
 * @param layout - Layout data to save
 * @param library - Current library state
 * @param options - Author name, forkedFrom info, etc.
 *
 * @example
 * ```ts
 * const newLayout = createDefaultLayout();
 * const result = await createLayoutEntry(newLayout, library, { author: 'me' });
 * if (isOk(result)) {
 *   setLibrary(result.value.library);
 *   importLayout(result.value.layout, result.value.layoutId, 'init');
 * }
 * ```
 */
export async function createLayoutEntry(
  layout: Layout,
  library: LayoutLibrary,
  options: CreateLayoutOptions = {}
): Promise<Result<CreateResult, StorageError>> {
  const layoutId = generateLayoutId();
  const now = Date.now();

  // 1. Save layout data first
  const saveResult = await saveLayoutInternal(layoutId, layout);
  if (isErr(saveResult)) {
    return saveResult;
  }

  // 2. Create entry
  const entry: LayoutEntry = {
    id: layoutId,
    name: (options.name ?? layout.name).slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
    createdAt: now,
    modifiedAt: now,
    author: options.author ?? library.settings.authorName,
    preview: options.skipPreview
      ? (options.preview ?? computePreview(layout))
      : computePreview(layout),
  };

  if (options.forkedFrom) {
    entry.forkedFrom = options.forkedFrom;
  }

  // 3. Build updated library
  const updatedLibrary: LayoutLibrary = {
    ...library,
    entries: [...library.entries, entry],
  };

  // 4. Save library
  const librarySaveResult = saveLibraryInternal(updatedLibrary);
  if (isErr(librarySaveResult)) {
    // Rollback: delete the layout we just saved
    await deleteLayoutInternal(layoutId).catch(() => {
      // Ignore rollback errors - layout data is orphaned but not harmful
    });
    return librarySaveResult;
  }

  return ok({
    layoutId,
    entry,
    library: updatedLibrary,
    layout,
  });
}

/**
 * Delete a layout and its library entry atomically.
 *
 * Handles switching active layout if needed.
 * Cannot delete the last layout (returns error).
 *
 * @param layoutId - ID of the layout to delete
 * @param library - Current library state
 *
 * @example
 * ```ts
 * const result = await deleteLayoutWithEntry(layoutId, library);
 * if (isOk(result)) {
 *   setLibrary(result.value.library);
 *   if (result.value.newActiveId) {
 *     // Need to switch to a different layout
 *     await switchToLayout(result.value.newActiveId);
 *   }
 * }
 * ```
 */
export async function deleteLayoutWithEntry(
  layoutId: string,
  library: LayoutLibrary
): Promise<Result<DeleteResult, StorageError>> {
  // 1. Validate we can delete
  if (library.entries.length <= 1) {
    return err(storageCorrupted('library', ['Cannot delete the last layout']));
  }

  const found = findLibraryEntry(library, layoutId);
  if (!found) {
    return err(storageNotFound(getLayoutKey(layoutId)));
  }

  // 2. Delete layout data
  const deleteResult = await deleteLayoutInternal(layoutId);
  if (isErr(deleteResult)) {
    return deleteResult;
  }

  // 3. Build updated library
  const remainingEntries = library.entries.filter((e) => e.id !== layoutId);
  let newActiveId: string | undefined;

  // If deleting active layout, switch to first remaining
  let activeLayoutId = library.activeLayoutId;
  if (activeLayoutId === layoutId) {
    activeLayoutId = remainingEntries[0].id;
    newActiveId = activeLayoutId;
  }

  const updatedLibrary: LayoutLibrary = {
    ...library,
    activeLayoutId,
    entries: remainingEntries,
  };

  // 4. Save library
  const librarySaveResult = saveLibraryInternal(updatedLibrary);
  if (isErr(librarySaveResult)) {
    // Layout already deleted, but library save failed
    // This leaves us in an inconsistent state, but the entry will be cleaned up on next load
    return librarySaveResult;
  }

  return ok({
    library: updatedLibrary,
    newActiveId,
  });
}

/**
 * Duplicate a layout atomically.
 *
 * Creates a new layout entry with "(copy)" suffix.
 *
 * @param sourceId - ID of the layout to duplicate
 * @param library - Current library state
 *
 * @example
 * ```ts
 * const result = await duplicateLayoutEntry(layoutId, library);
 * if (isOk(result)) {
 *   setLibrary(result.value.library);
 *   addToast(`Duplicated as "${result.value.entry.name}"`, 'success');
 * }
 * ```
 */
export async function duplicateLayoutEntry(
  sourceId: string,
  library: LayoutLibrary
): Promise<Result<DuplicateResult, StorageError>> {
  // 1. Find source entry
  const sourceEntry = library.entries.find((e) => e.id === sourceId);
  if (!sourceEntry) {
    return err(storageNotFound(getLayoutKey(sourceId)));
  }

  // 2. Load source layout
  const loadResult = await loadLayoutInternal(sourceId);
  if (isErr(loadResult)) {
    return loadResult;
  }
  const sourceLayout = loadResult.value;

  // 3. Create duplicated layout
  const newLayout: Layout = {
    ...sourceLayout,
    name: `${sourceLayout.name} (copy)`.slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
  };

  // 4. Use createLayoutEntry for the rest
  const createResult = await createLayoutEntry(newLayout, library, {
    author: library.settings.authorName,
  });

  if (isErr(createResult)) {
    return createResult;
  }

  return ok({
    ...createResult.value,
    layout: newLayout,
  });
}

/**
 * Switch active layout atomically.
 *
 * Saves the current layout with metadata, updates activeLayoutId,
 * and loads the target layout.
 *
 * @param fromId - Current layout ID
 * @param fromLayout - Current layout data to save
 * @param toId - Target layout ID to switch to
 * @param library - Current library state
 *
 * @example
 * ```ts
 * const result = await switchActiveLayout(activeLayoutId, layout, targetId, library);
 * if (isOk(result)) {
 *   setLibrary(result.value.library);
 *   importLayout(result.value.targetLayout, toId, 'init');
 *   clearHistory();
 *   clearSelection();
 * }
 * ```
 */
export async function switchActiveLayout(
  fromId: string,
  fromLayout: Layout,
  toId: string,
  library: LayoutLibrary
): Promise<Result<SwitchResult, StorageError>> {
  // 1. Validate target exists
  const targetEntry = library.entries.find((e) => e.id === toId);
  if (!targetEntry) {
    return err(storageNotFound(getLayoutKey(toId)));
  }

  // 2. Save current layout (skip if it's a shared preview or was deleted)
  let updatedLibrary = library;
  const fromEntry = library.entries.find((e) => e.id === fromId);
  if (fromId !== '__shared_preview__' && fromEntry) {
    const saveResult = await saveLayoutWithMetadata(fromId, fromLayout, library);
    if (isErr(saveResult)) {
      // Current layout save failed - don't proceed with switch
      return saveResult;
    }
    updatedLibrary = saveResult.value.library;
  }

  // 3. Load target layout
  const loadResult = await loadLayoutInternal(toId);
  if (isErr(loadResult)) {
    return loadResult;
  }

  // 4. Update active layout ID
  updatedLibrary = {
    ...updatedLibrary,
    activeLayoutId: toId,
  };

  // 5. Save library with new active ID
  const librarySaveResult = saveLibraryInternal(updatedLibrary);
  if (isErr(librarySaveResult)) {
    return librarySaveResult;
  }

  return ok({
    library: updatedLibrary,
    targetLayout: loadResult.value,
    targetEntry,
  });
}

/**
 * Update cloud share info for a layout entry atomically.
 *
 * @param layoutId - Layout ID to update
 * @param cloudShare - Cloud share info to set (or undefined to clear)
 * @param library - Current library state
 */
export function updateCloudShare(
  layoutId: string,
  cloudShare: CloudShareInfo | undefined,
  library: LayoutLibrary
): Result<LayoutLibrary, StorageError> {
  const found = findLibraryEntry(library, layoutId);
  if (!found) {
    return err(storageNotFound(getLayoutKey(layoutId)));
  }

  const updatedLibrary = updateLibraryEntryAtIndex(library, found.index, {
    cloudShare,
  });

  const saveResult = saveLibraryInternal(updatedLibrary);
  if (isErr(saveResult)) {
    return saveResult;
  }

  return ok(updatedLibrary);
}

/**
 * Rename a layout entry atomically.
 *
 * @param layoutId - Layout ID to rename
 * @param newName - New name for the layout
 * @param library - Current library state
 */
export function renameLayoutEntry(
  layoutId: string,
  newName: string,
  library: LayoutLibrary
): Result<LayoutLibrary, StorageError> {
  const found = findLibraryEntry(library, layoutId);
  if (!found) {
    return err(storageNotFound(getLayoutKey(layoutId)));
  }

  const updatedLibrary = updateLibraryEntryAtIndex(library, found.index, {
    name: newName.slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
    modifiedAt: Date.now(),
  });

  const saveResult = saveLibraryInternal(updatedLibrary);
  if (isErr(saveResult)) {
    return saveResult;
  }

  return ok(updatedLibrary);
}
