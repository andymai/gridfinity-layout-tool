import { create } from 'zustand';
import type { Layout } from '@/core/types';

/**
 * Shared Layout Preview Store
 *
 * Manages state for previewing shared layouts before importing.
 * When a user opens a share URL, the layout is loaded into this store
 * for preview. The user can then choose to import it to their library.
 *
 * Extracted from ui.ts as part of the god object decomposition.
 */

/** Consolidated shared preview data — all fields set together, cleared together. */
export interface SharedPreviewData {
  /** The layout being previewed */
  layout: Layout;
  /** Original name of the shared layout (for forkedFrom metadata) */
  originalName: string;
  /** Author name of the cloud-shared layout */
  authorName: string | null;
  /** Cloud share ID for collaborative editing */
  cloudShareId: string | null;
  /** Permission level of the shared layout */
  permission: 'view' | 'edit' | null;
}

interface SharedPreviewState {
  /** The shared preview data, or null if not in preview mode */
  sharedPreview: SharedPreviewData | null;

  // Legacy accessors for backward compatibility
  /** @deprecated Access via sharedPreview?.layout */
  sharedLayoutPreview: Layout | null;
  /** @deprecated Access via sharedPreview?.originalName */
  sharedLayoutOriginalName: string | null;
  /** @deprecated Access via sharedPreview?.authorName */
  sharedLayoutAuthorName: string | null;
  /** @deprecated Access via sharedPreview?.cloudShareId */
  sharedLayoutCloudShareId: string | null;
  /** @deprecated Access via sharedPreview?.permission */
  sharedLayoutPermission: 'view' | 'edit' | null;
}

interface SharedPreviewActions {
  /**
   * Set the shared layout preview.
   * Call this when loading a share URL to display the layout.
   */
  setSharedLayoutPreview: (
    layout: Layout | null,
    originalName?: string,
    authorName?: string,
    cloudShareId?: string,
    permission?: 'view' | 'edit'
  ) => void;

  /**
   * Clear the shared layout preview.
   * Call this after the user imports or dismisses the preview.
   */
  clearSharedLayoutPreview: () => void;
}

export type SharedPreviewStore = SharedPreviewState & SharedPreviewActions;

export const useSharedPreviewStore = create<SharedPreviewStore>((set) => ({
  // Initial state
  sharedPreview: null,
  sharedLayoutPreview: null,
  sharedLayoutOriginalName: null,
  sharedLayoutAuthorName: null,
  sharedLayoutCloudShareId: null,
  sharedLayoutPermission: null,

  // Actions
  setSharedLayoutPreview: (layout, originalName, authorName, cloudShareId, permission) => {
    if (layout) {
      const data: SharedPreviewData = {
        layout,
        originalName: originalName ?? layout.name,
        authorName: authorName ?? null,
        cloudShareId: cloudShareId ?? null,
        permission: permission ?? null,
      };
      set({
        sharedPreview: data,
        // Keep legacy fields in sync
        sharedLayoutPreview: data.layout,
        sharedLayoutOriginalName: data.originalName,
        sharedLayoutAuthorName: data.authorName,
        sharedLayoutCloudShareId: data.cloudShareId,
        sharedLayoutPermission: data.permission,
      });
    } else {
      set({
        sharedPreview: null,
        sharedLayoutPreview: null,
        sharedLayoutOriginalName: null,
        sharedLayoutAuthorName: null,
        sharedLayoutCloudShareId: null,
        sharedLayoutPermission: null,
      });
    }
  },

  clearSharedLayoutPreview: () =>
    set({
      sharedPreview: null,
      sharedLayoutPreview: null,
      sharedLayoutOriginalName: null,
      sharedLayoutAuthorName: null,
      sharedLayoutCloudShareId: null,
      sharedLayoutPermission: null,
    }),
}));
