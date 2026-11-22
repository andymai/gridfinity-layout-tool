/**
 * A library item, or a folder with everything in it, as a `.json` file to keep
 * or to hand to someone else.
 *
 * The file holds its meshes inline, so it opens on a device that never saw
 * them. Import checks the content the way a design import does: wrapped in a
 * bin, migrated, then validated, so one set of rules reads both files.
 */

import type { BinParams } from '@/features/bin-designer/types';
import {
  MAX_MESH_TRIANGLES_PER_DESIGN,
  decodeMeshData,
  hasOversizedMeshAsset,
  isMeshAssetRef,
  meshTrianglesTotal,
} from '@/shared/generation/meshAsset';
import type { TFunction } from '@/i18n';
import type { Result, StorageMeshMissingError, StorageNotSavedError } from '@/core/result';
import { err, isErr, isOk, OK, ok, storageNotSaved } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { migrateParams } from '@/features/bin-designer/constants/paramMigration';
import { validateImportedBinParams } from '@/features/bin-designer/utils/designJson';
import { sanitizeFileName } from '@/features/bin-designer/utils/fileNaming';
import { inlineHolderMeshes } from '@/shared/generation/meshRefs';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import { isPlaceableCutout } from './libraryCutoutCheck';
import {
  MAX_LIBRARY_FOLDERS,
  MAX_LIBRARY_FOLDER_DEPTH,
  MAX_LIBRARY_ITEMS,
  MAX_LIBRARY_NAME_LENGTH,
  type CutoutLibraryContent,
  type CutoutLibraryFolder,
  type CutoutLibraryItem,
} from './libraryTypes';

export const LIBRARY_FILE_TYPE = 'gridfinity-cutout-library-item';
export const LIBRARY_FOLDER_FILE_TYPE = 'gridfinity-cutout-library-folder';
const LIBRARY_FILE_VERSION = '1.0';

/** A folder inside an exported folder. A null parent is the exported folder itself. */
export interface LibraryFileFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

/** An item inside an exported folder. A null folder is the exported folder itself. */
export interface LibraryFileItem {
  readonly name: string;
  readonly folderId: string | null;
  readonly content: CutoutLibraryContent;
}

/** An exported folder: its subfolders, parents first, and every item they hold. */
export interface LibraryFolderTree {
  readonly name: string;
  readonly folders: readonly LibraryFileFolder[];
  readonly items: readonly LibraryFileItem[];
}

export type LibraryLimit = 'items' | 'folders' | 'depth';

/** Levels of subfolders under the exported folder. `folders` lists parents first. */
function treeDepth(folders: readonly LibraryFileFolder[]): number {
  const level = new Map<string | null, number>([[null, 0]]);
  let deepest = 0;
  for (const folder of folders) {
    const at = (level.get(folder.parentId) ?? 0) + 1;
    level.set(folder.id, at);
    deepest = Math.max(deepest, at);
  }
  return deepest;
}

/**
 * The limit a folder tree would pass as a new top-level folder in a library
 * that holds `have`, or null when it fits.
 */
export function treeLimit(
  tree: { readonly folders: readonly LibraryFileFolder[]; readonly items: readonly unknown[] },
  have: { readonly items: number; readonly folders: number }
): LibraryLimit | null {
  if (have.items + tree.items.length > MAX_LIBRARY_ITEMS) return 'items';
  if (have.folders + tree.folders.length + 1 > MAX_LIBRARY_FOLDERS) return 'folders';
  if (treeDepth(tree.folders) + 1 > MAX_LIBRARY_FOLDER_DEPTH) return 'depth';
  return null;
}

const meta = () => ({
  exportedFrom: 'https://gridfinitylayouttool.com',
  exportedAt: new Date().toISOString(),
});

export function exportLibraryItemJSON(name: string, content: CutoutLibraryContent): string {
  return JSON.stringify(
    {
      type: LIBRARY_FILE_TYPE,
      version: LIBRARY_FILE_VERSION,
      name,
      params: content.params,
      _meta: meta(),
    },
    null,
    2
  );
}

export function exportLibraryFolderJSON(tree: LibraryFolderTree): string {
  return JSON.stringify(
    {
      type: LIBRARY_FOLDER_FILE_TYPE,
      version: LIBRARY_FILE_VERSION,
      name: tree.name,
      folders: tree.folders,
      items: tree.items.map(({ name, folderId, content }) => ({
        name,
        folderId,
        params: content.params,
      })),
      _meta: meta(),
    },
    null,
    2
  );
}

/**
 * `folder` and everything under it. A folder that a loop keeps from hanging
 * under `folder` is left out, with its items.
 */
export function folderTree(
  folder: CutoutLibraryFolder,
  folders: readonly CutoutLibraryFolder[],
  items: readonly CutoutLibraryItem[]
): LibraryFolderTree {
  const inside = [folder.id];
  const seen = new Set(inside);
  const subfolders: LibraryFileFolder[] = [];
  for (let i = 0; i < inside.length; i++) {
    const parent = inside[i];
    for (const child of folders) {
      if (child.parentId !== parent || seen.has(child.id)) continue;
      seen.add(child.id);
      inside.push(child.id);
      subfolders.push({
        id: child.id,
        name: child.name,
        parentId: parent === folder.id ? null : parent,
      });
    }
  }
  return {
    name: folder.name,
    folders: subfolders,
    items: items
      .filter((item) => item.folderId !== null && seen.has(item.folderId))
      .map((item) => ({
        name: item.name,
        folderId: item.folderId === folder.id ? null : item.folderId,
        content: item.content,
      })),
  };
}

function fileBase(name: string, fallback: string): string {
  const sanitized = sanitizeFileName(name);
  return !sanitized || /^_+$/.test(sanitized) ? fallback : sanitized;
}

/** Save the item as a file. Fails, saving nothing, when one of its meshes is not on this device. */
export async function downloadLibraryItem(
  item: CutoutLibraryItem
): Promise<Result<void, StorageMeshMissingError | StorageNotSavedError>> {
  primeExportFolder();
  const inline = await inlineHolderMeshes(item.content);
  if (isErr(inline)) return inline;
  const saved = await deliverExport(
    new Blob([exportLibraryItemJSON(item.name, inline.value)], { type: 'application/json' }),
    `${fileBase(item.name, 'cutout')}.cutouts.json`
  );
  return saved ? OK : err(storageNotSaved());
}

/**
 * Save the folder and everything under it as one file, and return what it
 * held. Fails, saving nothing, when a mesh is not on this device.
 */
export async function downloadLibraryFolder(
  folder: CutoutLibraryFolder,
  folders: readonly CutoutLibraryFolder[],
  items: readonly CutoutLibraryItem[]
): Promise<Result<LibraryFolderTree, StorageMeshMissingError | StorageNotSavedError>> {
  primeExportFolder();
  const tree = folderTree(folder, folders, items);
  const inlined: LibraryFileItem[] = [];
  for (const item of tree.items) {
    const inline = await inlineHolderMeshes(item.content);
    if (isErr(inline)) return inline;
    inlined.push({ ...item, content: inline.value });
  }
  const saved = await deliverExport(
    new Blob([exportLibraryFolderJSON({ ...tree, items: inlined })], {
      type: 'application/json',
    }),
    `${fileBase(folder.name, 'cutouts')}.cutouts.json`
  );
  return saved ? ok(tree) : err(storageNotSaved());
}

export type ParsedLibraryFile =
  | { readonly kind: 'item'; readonly name: string; readonly content: CutoutLibraryContent }
  | { readonly kind: 'folder'; readonly tree: LibraryFolderTree }
  /** A folder file too large for even an empty library, refused before its items are read. */
  | { readonly kind: 'tooLarge'; readonly limit: LibraryLimit };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const fileName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, MAX_LIBRARY_NAME_LENGTH) : '';

/**
 * The item or folder in `json`, or null when it is neither, or when any part
 * of it would not import. A folder file imports whole or not at all.
 */
export function parseLibraryFileJSON(json: string, t: TFunction): ParsedLibraryFile | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;
  if (data.type === LIBRARY_FILE_TYPE) {
    const content = parseLibraryParams(data.params, t);
    return content ? { kind: 'item', name: fileName(data.name), content } : null;
  }
  if (data.type === LIBRARY_FOLDER_FILE_TYPE) return parseFolderFile(data, t);
  return null;
}

const EMPTY_LIBRARY = { items: 0, folders: 0 };

function parseFolderFile(data: Record<string, unknown>, t: TFunction): ParsedLibraryFile | null {
  const rawFolders = data.folders ?? [];
  if (!Array.isArray(rawFolders) || !Array.isArray(data.items)) return null;
  const folders = orderFolders(rawFolders);
  if (!folders) return null;
  // Each item costs a full check, so a file no library could take stops here.
  const limit = treeLimit({ folders, items: data.items }, EMPTY_LIBRARY);
  if (limit) return { kind: 'tooLarge', limit };
  const ids = new Set(folders.map((f) => f.id));
  const items: LibraryFileItem[] = [];
  for (const raw of data.items) {
    if (!isObject(raw)) return null;
    const folderId = raw.folderId ?? null;
    if (folderId !== null && (typeof folderId !== 'string' || !ids.has(folderId))) return null;
    const content = parseLibraryParams(raw.params, t);
    if (!content) return null;
    items.push({ name: fileName(raw.name), folderId, content });
  }
  return { kind: 'folder', tree: { name: fileName(data.name), folders, items } };
}

/**
 * The folders with each parent before its children, or null when an id
 * repeats, a parent is not in the file, or the parents form a loop.
 */
function orderFolders(raw: readonly unknown[]): LibraryFileFolder[] | null {
  const byId = new Map<string, LibraryFileFolder>();
  for (const folder of raw) {
    if (!isObject(folder) || typeof folder.id !== 'string' || folder.id === '') return null;
    if (byId.has(folder.id)) return null;
    const parentId = folder.parentId ?? null;
    if (parentId !== null && typeof parentId !== 'string') return null;
    byId.set(folder.id, { id: folder.id, name: fileName(folder.name), parentId });
  }
  const children = new Map<string | null, LibraryFileFolder[]>();
  for (const folder of byId.values()) {
    if (folder.parentId !== null && !byId.has(folder.parentId)) return null;
    const siblings = children.get(folder.parentId);
    if (siblings) siblings.push(folder);
    else children.set(folder.parentId, [folder]);
  }
  const ordered: LibraryFileFolder[] = [];
  const queue: (string | null)[] = [null];
  for (let i = 0; i < queue.length; i++) {
    for (const child of children.get(queue[i]) ?? []) {
      ordered.push(child);
      queue.push(child.id);
    }
  }
  // A folder that no walk from the top reaches sits in a loop.
  return ordered.length === byId.size ? ordered : null;
}

function parseLibraryParams(params: unknown, t: TFunction): CutoutLibraryContent | null {
  if (!isObject(params)) return null;
  const { cutouts, cutoutGroupNames, meshAssets } = params;
  if (!Array.isArray(cutouts) || cutouts.length === 0) return null;
  if (!cutouts.every((c) => isPlaceableCutout(c, meshAssets))) return null;
  const wrapped: Record<string, unknown> = {
    ...DEFAULT_BIN_PARAMS,
    style: 'solid',
    cutouts,
    ...(cutoutGroupNames === undefined ? {} : { cutoutGroupNames }),
    ...(meshAssets === undefined ? {} : { meshAssets }),
  };
  if (!validateImportedBinParams(wrapped, t).valid) return null;
  let migrated: BinParams;
  try {
    migrated = migrateParams(wrapped);
  } catch {
    // A hand-written cutout can still be the wrong shape inside.
    return null;
  }
  if (migrated.cutouts.length === 0) return null;
  if (
    migrated.meshAssets &&
    meshTrianglesTotal(migrated.meshAssets) > MAX_MESH_TRIANGLES_PER_DESIGN
  ) {
    return null;
  }
  return {
    params: {
      cutouts: migrated.cutouts.map(({ locked: _locked, libraryItemId: _id, ...c }) => c),
      ...(migrated.cutoutGroupNames ? { cutoutGroupNames: migrated.cutoutGroupNames } : {}),
      ...(migrated.meshAssets ? { meshAssets: migrated.meshAssets } : {}),
    },
  };
}

/**
 * Whether every mesh in an imported item is inline and decodes. A file must
 * carry its meshes: a ref names a file this device may never have, and a mesh
 * that does not decode would save an item that can never be placed.
 */
export async function importedMeshesUsable(content: CutoutLibraryContent): Promise<boolean> {
  const { meshAssets } = content.params;
  if (!meshAssets) return true;
  if (hasOversizedMeshAsset(content.params)) return false;
  for (const asset of Object.values(meshAssets)) {
    if (isMeshAssetRef(asset)) return false;
    if (!isOk(await decodeMeshData(asset.data, asset.triangleCount))) return false;
  }
  return true;
}
