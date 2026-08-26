/**
 * Hook to detect if the current layout is in collaborative editing mode.
 *
 * A layout is collaborative (requires Liveblocks connection) when:
 * 1. The share permission is "edit" (not "view")
 * 2. EITHER:
 *    a. The active layout has a cloud share with edit permission, OR
 *    b. Viewing a shared layout with edit permission (from /s/{shareId} URL)
 *
 * View-only shares don't need Liveblocks - they just display static data.
 *
 * @example
 * ```tsx
 * const { isCollaborative, canEdit, shareId } = useCollabMode();
 * if (isCollaborative) {
 *   // Show collaboration UI, connect to Liveblocks
 * }
 * ```
 */

import { useLibraryStore } from '@/core/store';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';

export interface CollabModeState {
  /** Whether collaborative mode is active */
  isCollaborative: boolean;
  /** Whether the current user can edit (always true in local mode) */
  canEdit: boolean;
  /** The share ID if in collaborative mode, null otherwise */
  shareId: string | null;
}

/**
 * Determines if the current layout is in collaborative mode.
 *
 * Returns collaboration state based on the active layout's cloud share
 * permission OR the shared preview cloud share ID.
 */
export function useCollabMode(): CollabModeState {
  // Direct subscription to the cloud share of the active layout
  // This ensures re-render when cloudShare changes
  const cloudShare = useLibraryStore((state) => {
    const { activeLayoutId, entries } = state.library;
    const entry = entries.find((e) => e.id === activeLayoutId);
    return entry?.cloudShare ?? null;
  });

  // Check for shared layout preview (viewing via /s/{shareId} URL)
  const sharedPreview = useSharedPreviewStore((state) => state.sharedPreview);
  const sharedLayoutCloudShareId = sharedPreview?.cloudShareId ?? null;
  const sharedLayoutPermission = sharedPreview?.permission ?? null;

  // Check for shared preview mode first (viewer opened via /s/{shareId} URL)
  // Only connect to Liveblocks if permission is "edit"
  if (sharedLayoutCloudShareId) {
    const canEdit = sharedLayoutPermission === 'edit';
    return {
      // Only collaborative (Liveblocks) for edit permission
      isCollaborative: canEdit,
      canEdit,
      shareId: sharedLayoutCloudShareId,
    };
  }

  // Check for saved layout with cloud share (owner's layout)
  // Only connect to Liveblocks if permission is "edit"
  if (cloudShare) {
    const canEdit = cloudShare.permission === 'edit';
    return {
      // Only collaborative (Liveblocks) for edit permission
      isCollaborative: canEdit,
      canEdit,
      shareId: cloudShare.id,
    };
  }

  // No cloud share - local mode
  return {
    isCollaborative: false,
    canEdit: true,
    shareId: null,
  };
}

/**
 * Non-reactive version of useCollabMode for use outside of React components.
 * Useful for conditional logic that doesn't need to re-render.
 */
export function getCollabMode(): CollabModeState {
  const { activeLayoutId, entries } = useLibraryStore.getState().library;
  const sharedPreview = useSharedPreviewStore.getState().sharedPreview;
  const sharedLayoutCloudShareId = sharedPreview?.cloudShareId ?? null;
  const sharedLayoutPermission = sharedPreview?.permission ?? null;

  const activeEntry = entries.find((e) => e.id === activeLayoutId);
  const cloudShare = activeEntry?.cloudShare;

  // Check for shared preview mode first
  // Only connect to Liveblocks if permission is "edit"
  if (sharedLayoutCloudShareId) {
    const canEdit = sharedLayoutPermission === 'edit';
    return {
      isCollaborative: canEdit,
      canEdit,
      shareId: sharedLayoutCloudShareId,
    };
  }

  // Check for saved layout with cloud share
  // Only connect to Liveblocks if permission is "edit"
  if (cloudShare) {
    const canEdit = cloudShare.permission === 'edit';
    return {
      isCollaborative: canEdit,
      canEdit,
      shareId: cloudShare.id,
    };
  }

  return {
    isCollaborative: false,
    canEdit: true,
    shareId: null,
  };
}
