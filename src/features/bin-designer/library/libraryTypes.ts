/**
 * The cutout library: cutouts saved apart from any bin, to place in another.
 *
 * An item's content has the shape of the part of `BinParams` it came from, so
 * the mesh helpers and the server validators that read a design read an item
 * the same way.
 */

import type { BinParams } from '@/features/bin-designer/types';

export type LibraryParams = Pick<BinParams, 'cutouts' | 'cutoutGroupNames' | 'meshAssets'>;

export interface CutoutLibraryContent {
  readonly params: LibraryParams;
}

export interface CutoutLibraryItem {
  readonly id: string;
  readonly name: string;
  /** Absent or null at the top level. */
  readonly folderId: string | null;
  readonly createdAt: string;
  /** Bumped on every user edit, so sync takes the latest one. */
  readonly updatedAt: string;
  readonly content: CutoutLibraryContent;
}

export interface CutoutLibraryFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrored by the sync quota in `api/lib/quota.ts`. */
export const MAX_LIBRARY_ITEMS = 1000;
export const MAX_LIBRARY_FOLDERS = 200;
/** Mirrored in `api/lib/cutoutLibraryValidation.ts`. */
export const MAX_LIBRARY_NAME_LENGTH = 80;
/** Folders nest at most this deep, so a tree from another device stays drawable. */
export const MAX_LIBRARY_FOLDER_DEPTH = 6;

/** The prefix every item id starts with, so an id says what it names. */
export const LIBRARY_ITEM_ID_PREFIX = 'clib_';
export const LIBRARY_FOLDER_ID_PREFIX = 'cfold_';
