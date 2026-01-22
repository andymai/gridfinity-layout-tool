/**
 * Hook for bidirectional sync between Liveblocks and Zustand stores.
 *
 * This hook handles the synchronization of layout data between the local
 * Zustand store and Liveblocks storage when in collaborative mode.
 *
 * Sync Strategy:
 * - On initial connection: prefer local state (API-fetched) over potentially stale remote
 * - Local edits (lastEditSource === 'local') are pushed to Liveblocks
 * - Remote changes from Liveblocks are imported to Zustand with source: 'remote'
 * - Loop prevention via lastEditSource tracking and sync state machine
 *
 * @example
 * ```tsx
 * // Inside CollabProvider, after RoomProvider
 * function CollabSync({ children }: { children: ReactNode }) {
 *   useCollabSync();
 *   return <>{children}</>;
 * }
 * ```
 */

import { useEffect, useRef } from 'react';
import { useStorage, useMutation } from '@/liveblocks.config';
import { useLayoutStore } from '@/core/store/layout';
import type { Layout } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

/**
 * Check if a layout has actual content (bins on the grid, not just staging).
 * Used to determine if a layout is "empty" for sync purposes.
 */
function layoutHasContent(layout: Layout): boolean {
  return layout.bins.some((bin) => bin.layerId !== STAGING_ID);
}

/**
 * Sync state machine states.
 * - 'pending': Waiting for initial remote data
 * - 'initializing': Processing initial sync, don't accept remote updates yet
 * - 'ready': Normal bidirectional sync
 */
type SyncState = 'pending' | 'initializing' | 'ready';

/**
 * Synchronizes layout data between Zustand and Liveblocks storage.
 *
 * Must be used inside a Liveblocks RoomProvider context.
 */
export function useCollabSync(): void {
  // Sync state machine
  const syncStateRef = useRef<SyncState>('pending');
  const lastSyncedLayoutRef = useRef<Layout | null>(null);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get layout from Liveblocks storage
  const remoteLayout = useStorage((root) => root?.layout) as Layout | null;

  // Get local store state
  const localLayout = useLayoutStore((state) => state.layout);
  const lastEditSource = useLayoutStore((state) => state.lastEditSource);
  const importLayout = useLayoutStore((state) => state.importLayout);

  // Liveblocks mutation to update storage
  const updateRemoteLayout = useMutation(({ storage }, layout: Layout) => {
    storage.set('layout', layout);
  }, []);

  // Effect: Remote → Local sync
  // When remote layout changes, update local store
  useEffect(() => {
    if (!remoteLayout) {
      return;
    }

    // State: pending → initializing
    // First time we receive remote data, handle initial sync
    if (syncStateRef.current === 'pending') {
      syncStateRef.current = 'initializing';

      const remoteHasContent = layoutHasContent(remoteLayout);
      const localHasContent = layoutHasContent(localLayout);

      // If local has content (from API fetch), push it to remote
      // This ensures API-fetched data takes precedence over potentially stale remote
      if (localHasContent) {
        lastSyncedLayoutRef.current = localLayout;
        updateRemoteLayout(localLayout);
        // Move to ready state after a brief delay to let the push complete
        // Store timeout ID for cleanup on unmount
        initTimeoutRef.current = setTimeout(() => {
          syncStateRef.current = 'ready';
          initTimeoutRef.current = null;
        }, 500);
        return;
      }

      // If only remote has content, use it
      if (remoteHasContent) {
        lastSyncedLayoutRef.current = remoteLayout;
        importLayout(remoteLayout, undefined, 'remote');
        syncStateRef.current = 'ready';
        return;
      }

      // Both empty - ready for normal sync
      lastSyncedLayoutRef.current = remoteLayout;
      syncStateRef.current = 'ready';
      return;
    }

    // State: initializing
    // Don't accept remote updates while initial sync is in progress
    if (syncStateRef.current === 'initializing') {
      return;
    }

    // State: ready - normal bidirectional sync

    // Skip if this is the same layout we just synced
    if (
      lastSyncedLayoutRef.current &&
      JSON.stringify(remoteLayout) === JSON.stringify(lastSyncedLayoutRef.current)
    ) {
      return;
    }

    // Skip if last edit was local (we're the source of this change)
    if (lastEditSource === 'local') {
      return;
    }

    // Remote change detected - update local store
    lastSyncedLayoutRef.current = remoteLayout;
    importLayout(remoteLayout, undefined, 'remote');
  }, [remoteLayout, lastEditSource, importLayout, localLayout, updateRemoteLayout]);

  // Effect: Local → Remote sync
  // When local layout changes, push to Liveblocks
  useEffect(() => {
    // Only sync local edits
    if (lastEditSource !== 'local') {
      return;
    }

    // Wait until initial sync is complete
    if (syncStateRef.current !== 'ready') {
      return;
    }

    // Skip if this is the same layout we just received
    if (
      lastSyncedLayoutRef.current &&
      JSON.stringify(localLayout) === JSON.stringify(lastSyncedLayoutRef.current)
    ) {
      return;
    }

    // Push local changes to Liveblocks
    lastSyncedLayoutRef.current = localLayout;
    updateRemoteLayout(localLayout);
  }, [localLayout, lastEditSource, updateRemoteLayout]);

  // Cleanup effect: clear pending timeout on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, []);
}
