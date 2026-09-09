/**
 * The library's folder tree, as pure functions over `LayoutLibrary`.
 *
 * Every mutation returns a new library and leaves the input untouched, so the
 * store, the hook that persists, and the sync adapter that mirrors remote
 * changes all go through one set of rules: names are trimmed and capped, a
 * folder never becomes its own ancestor, and deleting a folder lifts what it
 * held to its parent rather than losing it.
 */

import type { LayoutEntry, LayoutFolder, LayoutId, LayoutLibrary } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import type { LayoutError, Result } from '@/core/result';
import { err, layoutInvalidOperation, ok } from '@/core/result';

export function generateFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function folders(library: LayoutLibrary): readonly LayoutFolder[] {
  return library.folders ?? [];
}

export function folderById(library: LayoutLibrary, id: string): LayoutFolder | undefined {
  return folders(library).find((f) => f.id === id);
}

function parentOf(folder: LayoutFolder): string | null {
  return folder.parentId ?? null;
}

/**
 * A reference to a folder that is not in the library reads as the root. It is
 * kept, not rewritten: on a fresh device a layout can arrive before the folder
 * it belongs to, and the placement must still resolve once the folder lands.
 */
function resolvedParent(library: LayoutLibrary, ref: string | null | undefined): string | null {
  return ref !== null && ref !== undefined && folderById(library, ref) ? ref : null;
}

/** Folders filed directly under `parentId` (null for the root), by name. */
export function childFolders(library: LayoutLibrary, parentId: string | null): LayoutFolder[] {
  return folders(library)
    .filter((f) => resolvedParent(library, parentOf(f)) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The folders from the root down to `id`; empty for the root. Stops on a cycle. */
export function folderPath(library: LayoutLibrary, id: string | null): LayoutFolder[] {
  const path: LayoutFolder[] = [];
  const seen = new Set<string>();
  let current = id;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const folder = folderById(library, current);
    if (!folder) break;
    path.unshift(folder);
    current = parentOf(folder);
  }
  return path;
}

export function isDescendantFolder(
  library: LayoutLibrary,
  id: string,
  ancestorId: string
): boolean {
  if (id === ancestorId) return false;
  return folderPath(library, id)
    .slice(0, -1)
    .some((f) => f.id === ancestorId);
}

/** Entries filed directly in `folderId` (null for the root). */
export function entriesInFolder(library: LayoutLibrary, folderId: string | null): LayoutEntry[] {
  return library.entries.filter((e) => resolvedParent(library, e.folderId) === folderId);
}

/** The folder an entry sits in, with a vanished folder reading as the root. */
export function entryFolderId(library: LayoutLibrary, entry: LayoutEntry): string | null {
  return resolvedParent(library, entry.folderId);
}

function cleanName(name: string): string {
  return name.trim().slice(0, CONSTRAINTS.FOLDER_NAME_MAX_LENGTH);
}

function requireParent(library: LayoutLibrary, parentId: string | null, op: string) {
  if (parentId !== null && !folderById(library, parentId)) {
    return err(layoutInvalidOperation(op, 'Parent folder not found'));
  }
  return null;
}

export function createFolder(
  library: LayoutLibrary,
  name: string,
  parentId: string | null = null,
  now: number = Date.now(),
  id: string = generateFolderId()
): Result<{ library: LayoutLibrary; folder: LayoutFolder }, LayoutError> {
  const clean = cleanName(name);
  if (clean === '') return err(layoutInvalidOperation('createFolder', 'Folder name is empty'));
  if (folders(library).length >= CONSTRAINTS.FOLDERS_MAX) {
    return err(layoutInvalidOperation('createFolder', 'Folder limit reached'));
  }
  const missingParent = requireParent(library, parentId, 'createFolder');
  if (missingParent) return missingParent;
  const folder: LayoutFolder = { id, name: clean, parentId, createdAt: now, modifiedAt: now };
  return ok({ library: { ...library, folders: [...folders(library), folder] }, folder });
}

export function renameFolder(
  library: LayoutLibrary,
  id: string,
  name: string,
  now: number = Date.now()
): Result<LayoutLibrary, LayoutError> {
  const clean = cleanName(name);
  if (clean === '') return err(layoutInvalidOperation('renameFolder', 'Folder name is empty'));
  if (!folderById(library, id)) {
    return err(layoutInvalidOperation('renameFolder', 'Folder not found'));
  }
  return ok({
    ...library,
    folders: folders(library).map((f) =>
      f.id === id ? { ...f, name: clean, modifiedAt: now } : f
    ),
  });
}

export function moveFolder(
  library: LayoutLibrary,
  id: string,
  parentId: string | null,
  now: number = Date.now()
): Result<LayoutLibrary, LayoutError> {
  if (!folderById(library, id)) {
    return err(layoutInvalidOperation('moveFolder', 'Folder not found'));
  }
  const missingParent = requireParent(library, parentId, 'moveFolder');
  if (missingParent) return missingParent;
  if (parentId !== null && (parentId === id || isDescendantFolder(library, parentId, id))) {
    return err(layoutInvalidOperation('moveFolder', 'A folder cannot move into itself'));
  }
  return ok({
    ...library,
    folders: folders(library).map((f) => (f.id === id ? { ...f, parentId, modifiedAt: now } : f)),
  });
}

/**
 * Remove a folder, lifting its subfolders and layouts to its parent. The moved
 * layouts get a fresh `modifiedAt` so their new place syncs like any edit.
 */
export function deleteFolder(
  library: LayoutLibrary,
  id: string,
  now: number = Date.now()
): Result<{ library: LayoutLibrary; movedLayoutIds: LayoutId[] }, LayoutError> {
  const folder = folderById(library, id);
  if (!folder) return err(layoutInvalidOperation('deleteFolder', 'Folder not found'));
  const parentId = parentOf(folder);
  const movedLayoutIds: LayoutId[] = [];
  const entries = library.entries.map((e) => {
    if ((e.folderId ?? null) !== id) return e;
    movedLayoutIds.push(e.id);
    return { ...e, folderId: parentId, modifiedAt: now };
  });
  const remaining = folders(library)
    .filter((f) => f.id !== id)
    .map((f) => (parentOf(f) === id ? { ...f, parentId, modifiedAt: now } : f));
  return ok({ library: { ...library, entries, folders: remaining }, movedLayoutIds });
}

export function setEntryFolder(
  library: LayoutLibrary,
  layoutId: LayoutId,
  folderId: string | null,
  now: number = Date.now()
): Result<LayoutLibrary, LayoutError> {
  if (!library.entries.some((e) => e.id === layoutId)) {
    return err(layoutInvalidOperation('setEntryFolder', 'Layout not found'));
  }
  const missingFolder = requireParent(library, folderId, 'setEntryFolder');
  if (missingFolder) return missingFolder;
  return ok({
    ...library,
    entries: library.entries.map((e) =>
      e.id === layoutId ? { ...e, folderId, modifiedAt: now } : e
    ),
  });
}
