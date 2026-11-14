/**
 * Hook for bidirectional sync between Liveblocks and Zustand stores.
 *
 * This hook handles the synchronization of layout data between the local
 * Zustand store and Liveblocks storage when in collaborative mode.
 *
 * Sync Strategy:
 * - On initial connection: keep the room's layout, unless this browser's copy
 *   comes from a later share link revision and the room holds nothing the link
 *   lacks (`resolveJoin`)
 * - Local edits (lastEditSource === 'local') are pushed to Liveblocks
 * - Remote changes from Liveblocks are imported to Zustand with source: 'remote',
 *   whatever this browser's last edit was
 * - Loop prevention: a room layout equal to the one this browser last pushed or
 *   took is its own echo, and an imported layout is never pushed back
 * - A visitor's copy names the share's designs by its own ids; layouts cross
 *   into the room with the owner's ids (`RoomDesignIds`), and every comparison
 *   uses the room's ids
 *
 * @example
 * ```tsx
 * // Inside CollabProvider, after RoomProvider
 * function CollabSync({ children }: { children: ReactNode }) {
 *   useCollabSync(copySave);
 *   return <>{children}</>;
 * }
 * ```
 */

import { useEffect, useRef } from 'react';
import { useStorage, useMutation, type LiveblocksStorage } from '@/liveblocks.config';
import { useLayoutStore } from '@/core/store/layout';
import type { Layout } from '@/core/types';
import {
  resolveJoin,
  revisionOfCopy,
  stampFor,
  type RoomLinkStamp,
} from '@/shared/utils/roomLinkStamp';
import { roomDesignIds, type RoomDesignIds } from '@/shared/utils/roomDesignIds';

const OWNER_IDS = roomDesignIds(undefined);

// The layout stays the active library entry, so the owner's autosave also
// saves what collaborators change.
function importRoomLayout(layout: Layout): void {
  const { importLayout, activeLayoutId } = useLayoutStore.getState();
  importLayout(layout, activeLayoutId ?? undefined, 'remote');
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
 *
 * @param copySave - The share link save that this browser's copy of the layout
 *   came from, when known: its `lastUpdatedAt` and the saved layout's
 *   fingerprint. The revision counts only if the copy is still that layout.
 * @param designIds - Moves layouts between the room's design ids and this
 *   browser's. The owner's ids are the room's.
 */
export function useCollabSync(
  copySave?: RoomLinkStamp,
  designIds: RoomDesignIds = OWNER_IDS
): void {
  const { toLocal, toRoom } = designIds;
  // Sync state machine
  const syncStateRef = useRef<SyncState>('pending');
  const lastSyncedLayoutRef = useRef<Layout | null>(null);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set once the room refuses a write. From then on the room's copy is the only
  // one that counts: an edit it refused was never sent, so it must neither
  // survive the join nor hold back the updates the room does send.
  const writeRefusedRef = useRef(false);
  const latestRemoteRef = useRef<Layout | null>(null);

  // Get layout from Liveblocks storage
  const remoteLayout = useStorage((root) => root.layout);
  const linkUpdatedAt = useStorage((root) => root.metadata?.linkUpdatedAt);
  const linkFingerprint = useStorage((root) => root.metadata?.linkFingerprint);

  const localLayout = useLayoutStore((state) => state.layout);
  const lastEditSource = useLayoutStore((state) => state.lastEditSource);

  // The client joins on the permission it last saw, but the room grants the
  // share's current one, so a stale 'edit' lands here read-only. Liveblocks
  // throws on a write from a read-only connection, taking the provider down.
  const updateRemoteLayout = useMutation(
    ({ storage, self }, layout: Layout, stamp?: RoomLinkStamp): boolean => {
      if (!self.canWrite) return false;
      storage.set('layout', layout);
      if (stamp) {
        const metadata = storage.get('metadata') as LiveblocksStorage['metadata'] | undefined;
        storage.set('metadata', { ...metadata, ...stamp });
      }
      return true;
    },
    []
  );

  // Effect: Remote → Local sync
  // When remote layout changes, update local store.
  //
  // `localLayout` is intentionally NOT in the deps: it's only read during the
  // one-time `pending` branch, and including it caused the effect to re-fire
  // on every keystroke. That re-fire captured a possibly-stale `lastEditSource`
  // snapshot from the previous render, which could race with a freshly-arrived
  // remote update and overwrite an in-flight local edit. In the `pending`
  // branch below we read `localLayout` directly from the store so we always
  // get the freshest value.
  useEffect(() => {
    latestRemoteRef.current = remoteLayout ?? null;
    if (!remoteLayout) {
      return;
    }

    // State: pending → initializing
    // First time we receive remote data, handle initial sync
    if (syncStateRef.current === 'pending') {
      syncStateRef.current = 'initializing';

      // Read local layout fresh from the store, not from closure — that way
      // this branch doesn't need `localLayout` in the effect's dep array.
      const storeLayout = useLayoutStore.getState().layout;
      const copy = toRoom(storeLayout);
      const copyRevision = revisionOfCopy(copy, copySave);
      const outcome = resolveJoin({
        copy,
        copyRevision,
        room: remoteLayout,
        stamp: {
          linkUpdatedAt: linkUpdatedAt ?? undefined,
          linkFingerprint: linkFingerprint ?? undefined,
        },
      });

      if (outcome === 'push-copy') {
        // A copy without a known revision goes in unrecorded, so the owner
        // uploads it: it can hold edits that never reached the link.
        writeRefusedRef.current = !updateRemoteLayout(
          copy,
          copyRevision ? stampFor(copy, copyRevision) : undefined
        );
      }
      if (outcome === 'push-copy' && !writeRefusedRef.current) {
        lastSyncedLayoutRef.current = copy;
        // Move to ready state after a brief delay to let the push complete
        // Store timeout ID for cleanup on unmount
        initTimeoutRef.current = setTimeout(() => {
          syncStateRef.current = 'ready';
          initTimeoutRef.current = null;
        }, 500);
        return;
      }

      // The room's layout wins, including when the room refused ours
      lastSyncedLayoutRef.current = remoteLayout;
      const roomCopy = toLocal(remoteLayout);
      if (JSON.stringify(roomCopy) !== JSON.stringify(storeLayout)) {
        importRoomLayout(roomCopy);
      }
      syncStateRef.current = 'ready';
      return;
    }

    // State: initializing
    // Don't accept remote updates while initial sync is in progress
    if (syncStateRef.current === 'initializing') {
      return;
    }

    // State: ready - normal bidirectional sync

    // Skip this browser's own push, or a layout it already took, coming back
    if (
      lastSyncedLayoutRef.current &&
      JSON.stringify(remoteLayout) === JSON.stringify(lastSyncedLayoutRef.current)
    ) {
      return;
    }

    // An edit of this browser's own that the room has not received yet (one
    // that lands in the same render as the room's change) goes out now rather
    // than be dropped. The room syncs whole layouts, so this later write is
    // what every browser ends up with.
    const { layout: storeLayout, lastEditSource: storeEditSource } = useLayoutStore.getState();
    const storeCopy = toRoom(storeLayout);
    if (
      !writeRefusedRef.current &&
      storeEditSource === 'local' &&
      JSON.stringify(storeCopy) !== JSON.stringify(lastSyncedLayoutRef.current)
    ) {
      writeRefusedRef.current = !updateRemoteLayout(storeCopy);
      if (!writeRefusedRef.current) {
        lastSyncedLayoutRef.current = storeCopy;
        return;
      }
    }

    // Another browser's change, whatever this browser's last edit was
    lastSyncedLayoutRef.current = remoteLayout;
    importRoomLayout(toLocal(remoteLayout));
  }, [remoteLayout, updateRemoteLayout, copySave, linkUpdatedAt, linkFingerprint, toLocal, toRoom]);

  // Effect: Local → Remote sync
  // When local layout changes, push to Liveblocks
  useEffect(() => {
    // The remote effect runs first in a commit and can take a room change that
    // replaces this render's layout. Read the store as it is now, so a local
    // action that left the layout unchanged never pushes the replaced layout.
    const { layout: storeLayout, lastEditSource: currentEditSource } = useLayoutStore.getState();

    // Only sync local edits
    if (currentEditSource !== 'local') {
      return;
    }

    // Wait until initial sync is complete
    if (syncStateRef.current !== 'ready') {
      return;
    }

    // Skip if this is the same layout we just received
    const currentLayout = toRoom(storeLayout);
    if (
      lastSyncedLayoutRef.current &&
      JSON.stringify(currentLayout) === JSON.stringify(lastSyncedLayoutRef.current)
    ) {
      return;
    }

    // Push local changes to Liveblocks
    writeRefusedRef.current = !updateRemoteLayout(currentLayout);
    if (!writeRefusedRef.current) {
      lastSyncedLayoutRef.current = currentLayout;
      return;
    }
    // The remote effect runs first in a commit, so a room update that landed
    // alongside this edit was skipped as ours before the refusal was known.
    const remote = latestRemoteRef.current;
    if (
      remote &&
      lastSyncedLayoutRef.current &&
      JSON.stringify(remote) !== JSON.stringify(lastSyncedLayoutRef.current)
    ) {
      lastSyncedLayoutRef.current = remote;
      importRoomLayout(toLocal(remote));
    }
  }, [localLayout, lastEditSource, updateRemoteLayout, toLocal, toRoom]);

  // Cleanup effect: clear pending timeout on unmount only
  // Using empty deps [] ensures this only runs on unmount, not on re-renders
  // This is intentional - we don't want to cancel the init timeout when deps change
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, []);
}
