/**
 * Hook to detect if the current layout is in collaborative editing mode.
 *
 * A layout is collaborative (requires Liveblocks connection) when:
 * 1. The collaborative_editing Labs feature flag is enabled
 * 2. The share permission is "edit" (not "view")
 * 3. EITHER:
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

import { useLabsStore, useLibraryStore, useUIStore } from '@/core/store';

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
 * Returns collaboration state based on:
 * - Labs feature flag status
 * - Active layout's cloud share permission OR shared preview cloud share ID
 */
export function useCollabMode(): CollabModeState {
  const isFeatureEnabled = useLabsStore((state) => state.isFeatureEnabled('collaborative_editing'));

  // Direct subscription to the cloud share of the active layout
  // This ensures re-render when cloudShare changes
  const cloudShare = useLibraryStore((state) => {
    const { activeLayoutId, entries } = state.library;
    const entry = entries.find((e) => e.id === activeLayoutId);
    return entry?.cloudShare ?? null;
  });

  // Check for shared layout preview (viewing via /s/{shareId} URL)
  const sharedLayoutCloudShareId = useUIStore((state) => state.sharedLayoutCloudShareId);
  const sharedLayoutPermission = useUIStore((state) => state.sharedLayoutPermission);

  // Not collaborative if feature flag is disabled
  if (!isFeatureEnabled) {
    return {
      isCollaborative: false,
      canEdit: true, // Always can edit in local mode
      shareId: null,
    };
  }

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
  const isFeatureEnabled = useLabsStore.getState().isFeatureEnabled('collaborative_editing');
  const { activeLayoutId, entries } = useLibraryStore.getState().library;
  const sharedLayoutCloudShareId = useUIStore.getState().sharedLayoutCloudShareId;
  const sharedLayoutPermission = useUIStore.getState().sharedLayoutPermission;

  const activeEntry = entries.find((e) => e.id === activeLayoutId);
  const cloudShare = activeEntry?.cloudShare;

  if (!isFeatureEnabled) {
    return {
      isCollaborative: false,
      canEdit: true,
      shareId: null,
    };
  }

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
