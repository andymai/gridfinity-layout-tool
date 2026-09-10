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

  return resolveCollabMode(sharedPreview, cloudShare);
}

/**
 * Non-reactive version of useCollabMode for use outside of React components.
 * Useful for conditional logic that doesn't need to re-render.
 */
export function getCollabMode(): CollabModeState {
  const { activeLayoutId, entries } = useLibraryStore.getState().library;
  const sharedPreview = useSharedPreviewStore.getState().sharedPreview;

  const activeEntry = entries.find((e) => e.id === activeLayoutId);
  return resolveCollabMode(sharedPreview, activeEntry?.cloudShare);
}

/**
 * A shared preview (viewer arrived through a share URL) outranks the owner's
 * own cloud share; either connects to Liveblocks only with edit permission.
 */
export function resolveCollabMode(
  sharedPreview:
    | { readonly cloudShareId?: string | null; readonly permission?: string | null }
    | null
    | undefined,
  cloudShare: { readonly id: string; readonly permission: string } | null | undefined
): CollabModeState {
  if (sharedPreview?.cloudShareId) {
    const canEdit = sharedPreview.permission === 'edit';
    return { isCollaborative: canEdit, canEdit, shareId: sharedPreview.cloudShareId };
  }
  if (cloudShare) {
    const canEdit = cloudShare.permission === 'edit';
    return { isCollaborative: canEdit, canEdit, shareId: cloudShare.id };
  }
  return { isCollaborative: false, canEdit: true, shareId: null };
}
