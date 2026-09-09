import type { LayoutId } from '@gridfinity/branded-types';
import type { CloudShareInfo } from './share';
import type { LayoutPreview } from './preview';
/**
 * Metadata entry for a layout in the library.
 * The actual layout data is stored separately by ID.
 */
export interface LayoutEntry {
  id: LayoutId; // UUID for identification and future sharing
  name: string; // Display name (max 64 chars)
  createdAt: number; // Unix timestamp
  modifiedAt: number; // Unix timestamp
  author?: string; // Optional author name for sharing
  forkedFrom?: {
    // If imported/forked from another layout
    name: string;
    author?: string;
  };
  preview: LayoutPreview; // Cached preview data
  cloudShare?: CloudShareInfo; // Cloud sharing metadata (if shared)
  /** Folder holding this layout; absent or null at the root. */
  folderId?: string | null;
}

/**
 * A folder in the layout library. Folders nest through `parentId`; the tree
 * is the user's rooms, units and drawers, so a layout's place in it is part
 * of the library and syncs with it.
 */
export interface LayoutFolder {
  id: string;
  name: string; // max FOLDER_NAME_MAX_LENGTH chars
  color?: string; // optional accent color
  /** Parent folder; absent or null at the root. */
  parentId?: string | null;
  createdAt: number;
  modifiedAt: number;
}

/**
 * The layout library index stored in localStorage.
 * Individual layouts are stored separately by their ID.
 */
export interface LayoutLibrary {
  version: '1.0';
  activeLayoutId: LayoutId; // Currently active layout ID
  settings: {
    authorName?: string; // Default author name for new layouts
  };
  entries: LayoutEntry[]; // All layout entries (metadata only)
  /** Folder tree the entries are filed into; absent on libraries that never made one. */
  folders?: LayoutFolder[];
}
