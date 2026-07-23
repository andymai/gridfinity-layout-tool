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
  /** Optional folder ID for organization. null/undefined = root level (future feature) */
  folderId?: string | null;
}

/**
 * Folder definition for layout organization.
 * @future Implement folder creation/management UI
 */
export interface LayoutFolder {
  id: string;
  name: string; // max 32 chars
  color?: string; // optional accent color
  parentId?: string | null; // for nested folders (future)
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
  /** Folder definitions for layout organization (future feature) */
  folders?: LayoutFolder[];
}
