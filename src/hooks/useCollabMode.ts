/**
 * Hook to detect if the current layout is in collaborative editing mode.
 *
 * A layout is collaborative when:
 * 1. The collaborative_editing Labs feature flag is enabled
 * 2. EITHER:
 *    a. The active layout has a cloud share, OR
 *    b. Viewing a shared layout in preview mode (from /s/{shareId} URL)
 *
 * @example
 * ```tsx
 * const { isCollaborative, canEdit, shareId } = useCollabMode();
 * if (isCollaborative) {
 *   // Show collaboration UI
 * }
 * ```
 */

import { useLabsStore } from '../store/labs';
import { useLibraryStore } from '../store/library';
import { useUIStore } from '../store/ui';

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
  const isFeatureEnabled = useLabsStore((state) =>
    state.isFeatureEnabled('collaborative_editing')
  );

  // Direct subscription to the cloud share of the active layout
  // This ensures re-render when cloudShare changes
  const cloudShare = useLibraryStore((state) => {
    const { activeLayoutId, entries } = state.library;
    const entry = entries.find((e) => e.id === activeLayoutId);
    return entry?.cloudShare ?? null;
  });

  // Check for shared layout preview (viewing via /s/{shareId} URL)
  const sharedLayoutCloudShareId = useUIStore((state) => state.sharedLayoutCloudShareId);

  // Not collaborative if feature flag is disabled
  if (!isFeatureEnabled) {
    return {
      isCollaborative: false,
      canEdit: true, // Always can edit in local mode
      shareId: null,
    };
  }

  // Check for shared preview mode first (viewer opened via /s/{shareId} URL)
  if (sharedLayoutCloudShareId) {
    return {
      isCollaborative: true,
      canEdit: true, // TODO Phase 3: Check server-side permission for non-owners
      shareId: sharedLayoutCloudShareId,
    };
  }

  // Check for saved layout with cloud share (owner's layout)
  if (cloudShare) {
    return {
      isCollaborative: true,
      canEdit: true, // TODO Phase 3: Check server-side permission for non-owners
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
  if (sharedLayoutCloudShareId) {
    return {
      isCollaborative: true,
      canEdit: true,
      shareId: sharedLayoutCloudShareId,
    };
  }

  // Check for saved layout with cloud share
  if (cloudShare) {
    return {
      isCollaborative: true,
      canEdit: true,
      shareId: cloudShare.id,
    };
  }

  return {
    isCollaborative: false,
    canEdit: true,
    shareId: null,
  };
}
