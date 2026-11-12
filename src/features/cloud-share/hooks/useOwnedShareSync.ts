/**
 * Hook to automatically sync owned shared layouts to Blob storage.
 *
 * When the owner edits a layout that has an active cloud share, this hook
 * ensures changes are persisted to Blob storage (not just localStorage).
 * This keeps the shared version up-to-date for collaborators.
 *
 * This runs independently of CollabProvider - the owner doesn't need to be
 * in "collab mode" for their changes to sync. This makes the app behave
 * like Google Docs where the shared version is always current.
 *
 * While the share's collab room is loaded, the room's uploader
 * (useCloudShareAutoSync) saves the link and this hook saves nothing: the
 * editor's layout can lag the room.
 */

import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { updateShare } from '@/core/api/share';
import { isOk } from '@/core/result';
import { SHARED_PREVIEW_ID } from '@/core/constants';
import {
  createLayoutFingerprint,
  dropWaitingUpload,
  keepShareLayout,
  queueShareUpload,
  recordOwnCopyRevision,
  roomClaimCount,
  roomSavesShare,
  type ShareUpload,
} from '@/features/cloud-share/utils';
import type { CloudShareInfo } from '@/core/types';

/** Debounce delay for cloud share updates (5 seconds) */
const CLOUD_SYNC_DEBOUNCE_MS = 5000;

/**
 * This hook's last save. A room that claimed the share since then can have
 * saved other content, so the save no longer says what the link holds.
 */
interface LastSave {
  shareId: string;
  fingerprint: string;
  claimCount: number;
}

/**
 * Syncs owned shared layouts to Blob storage when edited locally.
 *
 * This ensures collaborators always see the latest version when they open
 * a share link, even if the owner is editing outside of collab mode.
 */
export function useOwnedShareSync(): void {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef = useRef<LastSave | null>(null);
  // Track cloud share info in a ref to avoid stale closures in cleanup
  const cloudShareRef = useRef<CloudShareInfo | null>(null);
  // Track sync function in a ref to always call the latest version
  const syncToCloudRef = useRef<() => void>(() => {});

  const { layout, activeLayoutId, lastEditSource } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
      lastEditSource: state.lastEditSource,
    }))
  );

  const entries = useLibraryStore((state) => state.library.entries);

  // Find cloudShare info for the active layout
  const cloudShare = entries.find((e) => e.id === activeLayoutId)?.cloudShare ?? null;

  const syncToCloud = useCallback(() => {
    if (!cloudShare) return;

    const { id: shareId, deleteToken } = cloudShare;
    if (!shareId || !deleteToken) return;
    if (roomSavesShare(shareId)) return;

    const layoutFingerprint = createLayoutFingerprint(layout);
    const claimCount = roomClaimCount(shareId);
    const upload: ShareUpload = {
      key: `local:${layoutFingerprint}`,
      // Silently ignore failures - this is background sync
      send: () =>
        updateShare(shareId, deleteToken, layout).then((result) =>
          isOk(result) ? result.value : null
        ),
      record: ({ lastUpdatedAt }) => {
        lastSyncedRef.current = { shareId, fingerprint: layoutFingerprint, claimCount };
        if (lastUpdatedAt) recordOwnCopyRevision(shareId, lastUpdatedAt, layout);
      },
    };

    // The link still holds this layout from this hook's last save, unless an
    // upload in flight replaces it.
    const last = lastSyncedRef.current;
    if (
      last?.shareId === shareId &&
      last.fingerprint === layoutFingerprint &&
      last.claimCount === claimCount
    ) {
      keepShareLayout(shareId, upload);
      return;
    }

    queueShareUpload(shareId, upload);
  }, [cloudShare, layout]);

  // Keep both refs aligned with the latest committed values. Uses
  // `useLayoutEffect` (not `useEffect`) so the refs update synchronously
  // during commit, before any subsequent unmount can fire its cleanup. With
  // a passive effect there's a window where a render commits, the parent
  // immediately unmounts this component, and the unmount cleanup reads
  // refs that the not-yet-flushed passive effect would have updated.
  // `react-hooks/refs` forbids `.current = ...` during render; this is the
  // canonical workaround.
  useLayoutEffect(() => {
    cloudShareRef.current = cloudShare;
    syncToCloudRef.current = syncToCloud;
  }, [cloudShare, syncToCloud]);

  // Debounced sync effect
  useEffect(() => {
    // Only sync if:
    if (!cloudShare) return;
    if (lastEditSource !== 'local') return;
    if (activeLayoutId === SHARED_PREVIEW_ID) return;
    // A newer local layout replaces what waits, unless a room saves the share.
    if (!roomSavesShare(cloudShare.id)) dropWaitingUpload(cloudShare.id);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Schedule new sync. Always go through `syncToCloudRef.current` — the
    // captured `syncToCloud` closure may have baked in a stale cloudShare
    // (e.g., the share was deleted between the timer scheduling and it
    // firing), which would then call `updateShare` with a stale delete token.
    // The ref always points at the latest `useCallback` result.
    debounceTimerRef.current = setTimeout(() => {
      syncToCloudRef.current();
    }, CLOUD_SYNC_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [cloudShare, layout, lastEditSource, activeLayoutId, syncToCloud]);

  // Sync on unmount (navigating away, closing tab)
  // Use refs to avoid stale closures - cloudShare might be null by cleanup time
  useEffect(() => {
    return () => {
      if (cloudShareRef.current && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        // Fire-and-forget sync before unmount using the latest sync function
        syncToCloudRef.current();
      }
    };
  }, []); // Empty deps - refs provide current values
}
