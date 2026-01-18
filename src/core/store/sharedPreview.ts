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

interface SharedPreviewState {
  /** The layout being previewed (null if not in preview mode) */
  sharedLayoutPreview: Layout | null;

  /** Original name of the shared layout (for forkedFrom metadata) */
  sharedLayoutOriginalName: string | null;

  /** Author name of the cloud-shared layout */
  sharedLayoutAuthorName: string | null;

  /** Cloud share ID for collaborative editing */
  sharedLayoutCloudShareId: string | null;

  /** Permission level of the shared layout */
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
  sharedLayoutPreview: null,
  sharedLayoutOriginalName: null,
  sharedLayoutAuthorName: null,
  sharedLayoutCloudShareId: null,
  sharedLayoutPermission: null,

  // Actions
  setSharedLayoutPreview: (
    layout,
    originalName,
    authorName,
    cloudShareId,
    permission
  ) =>
    set({
      sharedLayoutPreview: layout,
      sharedLayoutOriginalName: originalName ?? layout?.name ?? null,
      sharedLayoutAuthorName: authorName ?? null,
      sharedLayoutCloudShareId: cloudShareId ?? null,
      sharedLayoutPermission: permission ?? null,
    }),

  clearSharedLayoutPreview: () =>
    set({
      sharedLayoutPreview: null,
      sharedLayoutOriginalName: null,
      sharedLayoutAuthorName: null,
      sharedLayoutCloudShareId: null,
      sharedLayoutPermission: null,
    }),
}));
